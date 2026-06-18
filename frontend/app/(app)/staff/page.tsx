"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";

type Role = "admin" | "pastor" | "viewer";
const ROLES: Role[] = ["admin", "pastor", "viewer"];

type StaffMember = {
  user_id: string;
  email: string | null;
  role: string;
  created_at: string | null;
  is_self: boolean;
};

type PendingInvitation = {
  id: number;
  email: string;
  role: string;
  token: string;
  created_at: string | null;
  expires_at: string | null;
};

type ListResponse = {
  success: boolean;
  caller_role: string | null;
  caller_user_id: string;
  staff: StaffMember[];
  invitations: PendingInvitation[];
  error?: string;
};

const ROLE_BADGE: Record<string, string> = {
  admin: "bg-primary/12 text-primary",
  pastor: "bg-blue-100 text-blue-800",
  viewer: "bg-muted text-muted-foreground",
};

function roleLabel(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

async function authHeaders(): Promise<Record<string, string> | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : null;
}

export default function StaffPage() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("viewer");
  const [createdLink, setCreatedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const isAdmin = data?.caller_role === "admin";

  const load = useCallback(async () => {
    // Await first (no synchronous setState when called from the mount effect).
    const headers = await authHeaders();
    if (!headers) {
      setLoadError("Your session expired. Please sign in again.");
      return;
    }
    setLoadError(null);
    const res = await fetch("/api/staff/list", { headers });
    const json = (await res.json().catch(() => null)) as ListResponse | null;
    if (!res.ok || !json?.success) {
      setLoadError(json?.error ?? "Could not load staff.");
      return;
    }
    setData(json);
  }, []);

  useEffect(() => {
    // Await inside the effect so there's an await boundary before any setState
    // (load() only updates state after its own awaits).
    void (async () => {
      await load();
    })();
  }, [load]);

  const post = useCallback(
    async (path: string, body: Record<string, unknown>): Promise<{ ok: boolean; json: Record<string, unknown> }> => {
      const headers = await authHeaders();
      if (!headers) {
        setActionError("Your session expired. Please sign in again.");
        return { ok: false, json: {} };
      }
      const res = await fetch(path, { method: "POST", headers, body: JSON.stringify(body) });
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      return { ok: res.ok && json.success === true, json };
    },
    [],
  );

  const onInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setActionError(null);
    setCreatedLink(null);
    const { ok, json } = await post("/api/staff/invite", { email: inviteEmail.trim(), role: inviteRole });
    if (!ok) {
      setActionError((json.error as string) ?? "Could not create the invitation.");
    } else {
      setCreatedLink((json.invite_link as string) ?? null);
      setInviteEmail("");
      await load();
    }
    setBusy(false);
  };

  const onChangeRole = async (member: StaffMember, role: Role) => {
    if (busy || member.role === role) return;
    setBusy(true);
    setActionError(null);
    const { ok, json } = await post("/api/staff/update-role", { target_user_id: member.user_id, role });
    if (!ok) setActionError((json.error as string) ?? "Could not change the role.");
    else await load();
    setBusy(false);
  };

  const onRemove = async (member: StaffMember) => {
    if (busy) return;
    setBusy(true);
    setActionError(null);
    const { ok, json } = await post("/api/staff/remove", { target_user_id: member.user_id });
    if (!ok) setActionError((json.error as string) ?? "Could not remove the staff member.");
    else await load();
    setBusy(false);
  };

  const onRevoke = async (invitationId: number) => {
    if (busy) return;
    setBusy(true);
    setActionError(null);
    const { ok, json } = await post("/api/staff/revoke", { invitation_id: invitationId });
    if (!ok) setActionError((json.error as string) ?? "Could not revoke the invitation.");
    else await load();
    setBusy(false);
  };

  const copyLink = async (link: string, key: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1800);
    } catch {
      setActionError("Could not copy to clipboard.");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">Staff</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage who can access this church and what they can do.
        </p>
      </div>

      {loadError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{loadError}</div>
      ) : null}
      {actionError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</div>
      ) : null}

      {/* Team list */}
      <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">Team</h2>
        <div className="mt-3 divide-y divide-border/60">
          {(data?.staff ?? []).map((member) => (
            <div key={member.user_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {member.email ?? "Unknown user"}
                  {member.is_self ? <span className="ml-2 text-xs text-muted-foreground">(you)</span> : null}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {isAdmin ? (
                  <>
                    <select
                      value={member.role}
                      disabled={busy}
                      onChange={(e) => void onChangeRole(member, e.target.value as Role)}
                      className="h-9 rounded-lg border border-border/90 bg-card px-2 text-sm text-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:outline-none disabled:opacity-50"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {roleLabel(r)}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void onRemove(member)}
                    >
                      Remove
                    </Button>
                  </>
                ) : (
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${ROLE_BADGE[member.role] ?? ROLE_BADGE.viewer}`}>
                    {roleLabel(member.role)}
                  </span>
                )}
              </div>
            </div>
          ))}
          {data && data.staff.length === 0 ? (
            <p className="py-3 text-sm text-muted-foreground">No staff yet.</p>
          ) : null}
        </div>
      </section>

      {/* Invite (admin only) */}
      {isAdmin ? (
        <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">Invite staff</h2>
          <form onSubmit={(e) => void onInvite(e)} className="mt-3 flex flex-wrap items-end gap-3">
            <div className="min-w-[220px] flex-1 space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Email</label>
              <Input
                type="email"
                placeholder="person@church.org"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
                disabled={busy}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Role</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as Role)}
                disabled={busy}
                className="flex h-10 rounded-lg border border-border/90 bg-card px-3 text-sm text-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:outline-none disabled:opacity-50"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {roleLabel(r)}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" disabled={busy}>
              {busy ? "Working…" : "Create invite"}
            </Button>
          </form>

          {createdLink ? (
            <div className="mt-4 rounded-lg border border-primary/20 bg-primary/[0.06] p-3">
              <p className="text-xs font-medium text-muted-foreground">
                Invite created. Send this link to the person (no email is sent automatically):
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded bg-card px-2 py-1.5 text-xs text-foreground">
                  {createdLink}
                </code>
                <Button type="button" variant="outline" onClick={() => void copyLink(createdLink, "new")}>
                  {copied === "new" ? "Copied!" : "Copy"}
                </Button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Pending invitations (admin only) */}
      {isAdmin && (data?.invitations.length ?? 0) > 0 ? (
        <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">Pending invitations</h2>
          <div className="mt-3 divide-y divide-border/60">
            {data!.invitations.map((inv) => {
              const link = typeof window !== "undefined" ? `${window.location.origin}/invite/${inv.token}` : "";
              return (
                <div key={inv.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{inv.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {roleLabel(inv.role)}
                      {inv.expires_at ? ` · expires ${new Date(inv.expires_at).toLocaleDateString()}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" disabled={busy} onClick={() => void copyLink(link, `inv-${inv.id}`)}>
                      {copied === `inv-${inv.id}` ? "Copied!" : "Copy link"}
                    </Button>
                    <Button type="button" variant="outline" disabled={busy} onClick={() => void onRevoke(inv.id)}>
                      Revoke
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
