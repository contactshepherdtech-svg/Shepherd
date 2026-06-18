"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";

type InviteInfo = {
  role: string;
  status: string;
  expired: boolean;
  valid: boolean;
  church_name: string;
};

function roleLabel(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background: "radial-gradient(ellipse 70% 60% at 50% 40%, rgba(0,107,85,0.09) 0%, transparent 70%)",
        }}
      />
      <div className="relative z-10 w-full max-w-[400px] space-y-7">
        <div className="flex flex-col items-center">
          <div style={{ filter: "drop-shadow(0 10px 28px rgba(0,107,85,0.28))" }}>
            <Image
              src="/shepherd-logo.png"
              alt="Shepherd"
              width={380}
              height={253}
              className="h-auto w-[300px] max-w-full"
              priority
            />
          </div>
        </div>
        <div className="rounded-2xl border border-border/60 bg-card/92 p-6 shadow-[0_24px_70px_rgba(17,24,39,0.10)] backdrop-blur-sm">
          {children}
        </div>
      </div>
    </div>
  );
}

function InviteContent() {
  const params = useParams<{ token: string }>();
  const token = typeof params.token === "string" ? params.token : Array.isArray(params.token) ? params.token[0] : "";
  const router = useRouter();
  const { user, loading, refreshWorkspace } = useAuth();

  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [infoLoading, setInfoLoading] = useState(true);
  const [infoError, setInfoError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      if (!token) {
        setInfoError("This invitation link is missing its token.");
        setInfoLoading(false);
        return;
      }
      try {
        const res = await fetch(`/api/staff/invite-info?token=${encodeURIComponent(token)}`);
        const json = (await res.json().catch(() => null)) as ({ success?: boolean; error?: string } & InviteInfo) | null;
        if (!res.ok || !json?.success) {
          setInfoError(json?.error ?? "This invitation link is not valid.");
        } else {
          setInfo(json);
        }
      } catch {
        setInfoError("Could not load this invitation. Please try again.");
      } finally {
        setInfoLoading(false);
      }
    })();
  }, [token]);

  const act = useCallback(
    async (action: "accept" | "decline") => {
      setActing(true);
      setActionError(null);
      try {
        if (!supabase) {
          setActionError("Supabase is not configured.");
          return;
        }
        const { data } = await supabase.auth.getSession();
        const accessToken = data.session?.access_token;
        if (!accessToken) {
          setActionError("Your session expired. Please sign in again.");
          return;
        }
        const res = await fetch(`/api/staff/${action}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
        if (!res.ok || !json.success) {
          setActionError(json.error ?? `Could not ${action} the invitation.`);
          return;
        }
        if (action === "accept") {
          await refreshWorkspace();
          router.replace("/dashboard");
        } else {
          router.replace("/login");
        }
      } catch {
        setActionError(`Could not ${action} the invitation. Please try again.`);
      } finally {
        setActing(false);
      }
    },
    [token, refreshWorkspace, router],
  );

  if (infoLoading || loading) {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3 py-4">
          <div className="size-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading invitation…</p>
        </div>
      </Shell>
    );
  }

  if (infoError || !info) {
    return (
      <Shell>
        <div className="space-y-3 text-center">
          <h1 className="font-heading text-xl font-bold text-foreground">Invitation unavailable</h1>
          <p className="text-sm text-muted-foreground">{infoError ?? "This invitation is not valid."}</p>
          <Link href="/login" className="inline-block text-sm font-medium text-primary hover:underline">
            Go to sign in
          </Link>
        </div>
      </Shell>
    );
  }

  if (!info.valid) {
    return (
      <Shell>
        <div className="space-y-3 text-center">
          <h1 className="font-heading text-xl font-bold text-foreground">
            {info.expired ? "This invitation has expired" : "This invitation is no longer available"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Ask an admin at {info.church_name} to send you a new invitation.
          </p>
          <Link href="/login" className="inline-block text-sm font-medium text-primary hover:underline">
            Go to sign in
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="space-y-5">
        <div className="space-y-1.5 text-center">
          <p className="shepherd-kicker">Invitation</p>
          <h1 className="font-heading text-xl font-bold tracking-tight text-foreground">
            Join {info.church_name}
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            You&apos;ve been invited as <span className="font-medium text-foreground">{roleLabel(info.role)}</span>.
          </p>
        </div>

        {actionError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</div>
        ) : null}

        {user ? (
          <div className="space-y-3">
            <p className="text-center text-xs text-muted-foreground">
              Signed in as {user.email}
            </p>
            <Button type="button" className="w-full" disabled={acting} onClick={() => void act("accept")}>
              {acting ? "Joining…" : `Accept & join ${info.church_name}`}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={acting}
              onClick={() => void act("decline")}
            >
              Decline
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-center text-sm text-muted-foreground">
              Sign in or create an account with the email this invite was sent to.
            </p>
            <Link href={`/signup?invite=${encodeURIComponent(token)}`} className="block">
              <Button type="button" className="w-full">
                Create an account
              </Button>
            </Link>
            <Link href={`/login?invite=${encodeURIComponent(token)}`} className="block">
              <Button type="button" variant="outline" className="w-full">
                Sign in
              </Button>
            </Link>
          </div>
        )}
      </div>
    </Shell>
  );
}

export default function InvitePage() {
  return (
    <AuthProvider>
      <InviteContent />
    </AuthProvider>
  );
}
