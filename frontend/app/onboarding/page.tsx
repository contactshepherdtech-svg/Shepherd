"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InviteBanner, type PendingInvite } from "@/components/invite-banner";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import type { OnboardingWorkspaceInput } from "@/lib/data";
import { supabase } from "@/lib/supabase";

const DEFAULT_FORM: OnboardingWorkspaceInput = {
  church_name: "",
  main_service_frequency: "weekly",
  watch_missed_services: 2,
  at_risk_missed_services: 4,
  critical_missed_services: 6,
  preferred_followup_style: "soft and friendly",
};

const SLIDER_MAX = 12;

type ThresholdSliderProps = {
  label: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  badgeColor: string;
  helperText: string;
};

function ThresholdSlider({ label, value, onChange, disabled, badgeColor, helperText }: ThresholdSliderProps) {
  const pct = Math.round((value / SLIDER_MAX) * 100);
  return (
    <div className="space-y-3 rounded-xl border border-border/80 bg-[#FAFBFA] p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </span>
        <span
          className={`min-w-[2.2rem] rounded-full px-2.5 py-0.5 text-center text-sm font-bold ${badgeColor}`}
        >
          {value}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={SLIDER_MAX}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className="shepherd-slider"
        style={{
          background: `linear-gradient(to right, #006b55 0%, #006b55 ${pct}%, rgba(11,95,74,0.14) ${pct}%)`,
        }}
      />
      <div className="flex justify-between text-[11px] text-muted-foreground">
        <span>0 missed</span>
        <span className="text-center opacity-75">{helperText}</span>
        <span>{SLIDER_MAX} missed</span>
      </div>
    </div>
  );
}

function OnboardingContent() {
  const router = useRouter();
  const {
    user,
    churchUser,
    churchId,
    loading,
    planningCenterConnected,
    refreshWorkspace,
  } = useAuth();
  const [form, setForm] = useState<OnboardingWorkspaceInput>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Pending-invite gate. "checking" until we know; church-creation UI only ever
  // renders when this is "none". See the render branches below.
  const [inviteState, setInviteState] = useState<"checking" | "none" | "has_invites" | "error">("checking");
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const inviteCheckedRef = useRef(false);
  // Synchronous lock — `saving` is read from a stale closure on a fast
  // double-click, so it can't reliably block a second submit. A ref updates
  // immediately and prevents firing two create-workspace requests at once.
  const submitLock = useRef(false);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    if (churchUser && churchId) {
      router.replace(planningCenterConnected ? "/dashboard" : "/settings");
    }
  }, [churchId, churchUser, loading, planningCenterConnected, router, user]);

  // Pending-invite check. Runs once, only for a signed-in user who has NO church
  // yet, and BEFORE the create-workspace form is ever rendered or submittable
  // (the form is gated on inviteState === "none" below). If the user has a
  // pending invite, the InviteBanner takes over and the create path is
  // unreachable — invite always wins. The server (create-workspace) enforces the
  // same rule, so this client gate is UX, not the security boundary.
  useEffect(() => {
    if (loading || !user) return;
    if (churchUser && churchId) return; // handled by the redirect effect above
    if (inviteCheckedRef.current) return;
    inviteCheckedRef.current = true;

    void (async () => {
      try {
        if (!supabase) {
          setInviteState("none");
          return;
        }
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        if (!accessToken) {
          setInviteState("none");
          return;
        }
        const res = await fetch("/api/staff/my-invitations", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const json = (await res.json().catch(() => null)) as
          | { success?: boolean; invitations?: PendingInvite[] }
          | null;
        if (!res.ok || !json?.success) {
          // Fail safe: do NOT fall through to church creation on an unknown
          // state — show a retry instead, so a missed invite can't slip past.
          setInviteState("error");
          return;
        }
        const invites = json.invitations ?? [];
        if (invites.length > 0) {
          setPendingInvites(invites);
          setInviteState("has_invites");
        } else {
          setInviteState("none");
        }
      } catch {
        setInviteState("error");
      }
    })();
  }, [loading, user, churchUser, churchId]);

  const retryInviteCheck = () => {
    inviteCheckedRef.current = false;
    setInviteState("checking");
  };

  const updateField = (field: keyof OnboardingWorkspaceInput, value: string | number) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const setWatch = (v: number) => {
    setForm((cur) => ({
      ...cur,
      watch_missed_services: v,
      at_risk_missed_services: Math.max(cur.at_risk_missed_services, v + 1),
      critical_missed_services: Math.max(cur.critical_missed_services, v + 2),
    }));
  };

  const setAtRisk = (v: number) => {
    setForm((cur) => ({
      ...cur,
      watch_missed_services: Math.min(cur.watch_missed_services, v - 1),
      at_risk_missed_services: v,
      critical_missed_services: Math.max(cur.critical_missed_services, v + 1),
    }));
  };

  const setCritical = (v: number) => {
    setForm((cur) => ({
      ...cur,
      watch_missed_services: Math.min(cur.watch_missed_services, v - 2),
      at_risk_missed_services: Math.min(cur.at_risk_missed_services, v - 1),
      critical_missed_services: v,
    }));
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || saving || submitLock.current) return;
    // Defensive: the form is only rendered when inviteState === "none", but never
    // allow a submit while a pending invite exists. The server guards this too.
    if (inviteState !== "none") return;

    const churchName = form.church_name.trim();
    if (!churchName) {
      setError("Church name is required.");
      return;
    }

    if (form.watch_missed_services >= form.at_risk_missed_services) {
      setError("Watch threshold must be less than At Risk.");
      return;
    }
    if (form.at_risk_missed_services >= form.critical_missed_services) {
      setError("At Risk threshold must be less than Critical.");
      return;
    }

    submitLock.current = true;
    setSaving(true);
    setError(null);

    try {
      if (!supabase) {
        throw new Error("Supabase is not configured.");
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (sessionError || !accessToken) {
        throw new Error("Sign in again before creating your workspace.");
      }

      const response = await fetch("/api/onboarding/create-workspace", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          church_name: churchName,
          watch_missed_services: Math.max(Number(form.watch_missed_services), 0),
          at_risk_missed_services: Math.max(Number(form.at_risk_missed_services), 0),
          critical_missed_services: Math.max(Number(form.critical_missed_services), 0),
          preferred_followup_style: form.preferred_followup_style.trim() || "soft and friendly",
        }),
      });
      const result = (await response.json().catch(() => null)) as { success?: boolean; error?: string } | null;

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Could not create your workspace.");
      }

      await refreshWorkspace();
      router.replace("/settings");
    } catch (workspaceError) {
      console.error("Failed to create church workspace", workspaceError);
      setError(
        workspaceError instanceof Error
          ? workspaceError.message
          : "Could not create your workspace. Check Supabase permissions and try again.",
      );
    } finally {
      setSaving(false);
      submitLock.current = false;
    }
  };

  if (loading || (churchUser && churchId)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading Shepherd…</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  // ---- Pending-invite gate (renders before the create-workspace form) ----
  if (inviteState === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Checking for invitations…</p>
        </div>
      </div>
    );
  }

  if (inviteState === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm space-y-4 rounded-2xl border border-border/60 bg-card p-6 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">
            We couldn&apos;t check whether you have a pending invitation. Please try again before continuing.
          </p>
          <Button type="button" className="w-full" onClick={retryInviteCheck}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  if (inviteState === "has_invites") {
    return (
      <div className="relative flex min-h-screen items-start justify-center overflow-hidden bg-background px-4 py-10 sm:items-center">
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden
          style={{
            background: "radial-gradient(ellipse 80% 60% at 50% 30%, rgba(0,107,85,0.08) 0%, transparent 70%)",
          }}
        />
        <div className="relative z-10 w-full max-w-md space-y-7">
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
          <InviteBanner invites={pendingInvites} onAllResolved={() => setInviteState("none")} />
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-start justify-center overflow-hidden bg-background px-4 py-10 sm:items-center">
      {/* Radial background glow */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 30%, rgba(0,107,85,0.08) 0%, transparent 70%)",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-xl space-y-7"
      >
        {/* Logo — no container */}
        <div className="flex flex-col items-center gap-5">
          <div style={{ filter: "drop-shadow(0 10px 28px rgba(0,107,85,0.28))" }}>
            <Image
              src="/shepherd-logo.png"
              alt="Shepherd"
              width={380}
              height={253}
              className="h-auto w-[340px] max-w-full"
              priority
            />
          </div>
          <div className="space-y-1 text-center">
            <p className="shepherd-kicker">Step 1 of 3 · Workspace Setup</p>
            <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
              Create your church workspace
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Configure your engagement thresholds — you can adjust these any time in Settings.
            </p>
          </div>
        </div>

        {/* Form card */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-2xl border border-border/60 bg-card/92 p-6 shadow-[0_24px_70px_rgba(17,24,39,0.10)] backdrop-blur-sm"
        >
          <form onSubmit={(event) => void onSubmit(event)} className="space-y-5">
            {/* Church name + frequency row */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Church Name
                </label>
                <Input
                  type="text"
                  autoComplete="organization"
                  placeholder="Grace Community Church"
                  value={form.church_name}
                  onChange={(event) => updateField("church_name", event.target.value)}
                  required
                  disabled={saving}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Service Frequency
                </label>
                <select
                  value={form.main_service_frequency}
                  onChange={(event) => updateField("main_service_frequency", event.target.value)}
                  disabled={saving}
                  className="flex h-10 w-full rounded-lg border border-border/90 bg-card px-3 py-2 text-sm text-foreground shadow-xs transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="weekly">Weekly</option>
                  <option value="twice_weekly">Twice weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            </div>

            {/* Threshold sliders */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Engagement Thresholds
              </p>
              <p className="text-[12px] text-muted-foreground">
                These control when a member is flagged as Watch, At Risk, or Critical based on missed services.
              </p>
              <div className="space-y-3 pt-1">
                <ThresholdSlider
                  label="Watch"
                  value={form.watch_missed_services}
                  onChange={setWatch}
                  disabled={saving}
                  badgeColor="bg-yellow-100 text-yellow-800"
                  helperText="Early monitoring"
                />
                <ThresholdSlider
                  label="At Risk"
                  value={form.at_risk_missed_services}
                  onChange={setAtRisk}
                  disabled={saving}
                  badgeColor="bg-orange-100 text-orange-800"
                  helperText="Needs outreach"
                />
                <ThresholdSlider
                  label="Critical"
                  value={form.critical_missed_services}
                  onChange={setCritical}
                  disabled={saving}
                  badgeColor="bg-red-100 text-red-800"
                  helperText="Urgent follow-up"
                />
              </div>
            </div>

            {/* Follow-up style */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Follow-up Style
              </label>
              <Input
                value={form.preferred_followup_style}
                onChange={(event) => updateField("preferred_followup_style", event.target.value)}
                placeholder="e.g. soft and friendly"
                disabled={saving}
              />
            </div>

            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <motion.div whileTap={{ scale: 0.985 }}>
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? "Creating workspace…" : "Continue to integrations →"}
              </Button>
            </motion.div>
          </form>
        </motion.div>
      </motion.div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <AuthProvider>
      <OnboardingContent />
    </AuthProvider>
  );
}
