"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";

export type PendingInvite = {
  id: number;
  role: string;
  token: string;
  church_name: string;
  expires_at: string | null;
};

function roleLabel(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

// Renders pending invitations with Accept / Decline. Used on the onboarding
// screen: while any invite is pending it takes over (the create-church form is
// suppressed upstream), so "invite wins". Accept joins the church and leaves
// onboarding; declining the last invite calls onAllResolved so the parent can
// fall through to the normal create-workspace flow.
export function InviteBanner({
  invites,
  onAllResolved,
}: {
  invites: PendingInvite[];
  onAllResolved?: () => void;
}) {
  const router = useRouter();
  const { refreshWorkspace } = useAuth();
  const [list, setList] = useState<PendingInvite[]>(invites);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function authHeaders(): Promise<Record<string, string> | null> {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : null;
  }

  async function act(invite: PendingInvite, action: "accept" | "decline") {
    setBusyId(invite.id);
    setError(null);
    const headers = await authHeaders();
    if (!headers) {
      setError("Your session expired. Please sign in again.");
      setBusyId(null);
      return;
    }
    const res = await fetch(`/api/staff/${action}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ token: invite.token }),
    });
    const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
    if (!res.ok || !json.success) {
      setError(json.error ?? `Could not ${action} the invitation.`);
      setBusyId(null);
      return;
    }

    if (action === "accept") {
      await refreshWorkspace();
      router.replace("/dashboard");
      return;
    }

    const next = list.filter((i) => i.id !== invite.id);
    setList(next);
    setBusyId(null);
    if (next.length === 0) onAllResolved?.();
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1 text-center">
        <p className="shepherd-kicker">Invitation</p>
        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
          You&apos;ve been invited
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Accept to join the church team, or decline to set up your own workspace.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      ) : null}

      <div className="space-y-3">
        {list.map((invite) => (
          <div
            key={invite.id}
            className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm"
          >
            <p className="text-[15px] font-semibold text-foreground">{invite.church_name}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Role: <span className="font-medium text-foreground">{roleLabel(invite.role)}</span>
            </p>
            <div className="mt-4 flex gap-3">
              <Button
                type="button"
                className="flex-1"
                disabled={busyId !== null}
                onClick={() => void act(invite, "accept")}
              >
                {busyId === invite.id ? "Joining…" : "Accept"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                disabled={busyId !== null}
                onClick={() => void act(invite, "decline")}
              >
                Decline
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
