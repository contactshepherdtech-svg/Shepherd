"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

  const updateField = (field: keyof OnboardingWorkspaceInput, value: string | number) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || saving) return;

    const churchName = form.church_name.trim();
    if (!churchName) {
      setError("Church name is required.");
      return;
    }

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

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-2xl space-y-6">
        <div className="flex justify-center">
          <div className="relative overflow-hidden rounded-2xl border border-[#116a54] bg-[#095440] p-3 shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
            <Image
              src="/shepherd-logo.png"
              alt="Shepherd"
              width={96}
              height={96}
              className="h-auto w-[80px]"
              priority
            />
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <p className="shepherd-kicker">Workspace setup</p>
            <CardTitle className="text-2xl">Create your church workspace</CardTitle>
            <p className="text-sm text-muted-foreground">
              These settings define your default engagement thresholds before connecting Planning Center.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={(event) => void onSubmit(event)} className="space-y-4">
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

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Main Service Frequency
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

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Follow-up Style
                  </label>
                  <Input
                    value={form.preferred_followup_style}
                    onChange={(event) => updateField("preferred_followup_style", event.target.value)}
                    placeholder="soft and friendly"
                    disabled={saving}
                  />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1.5 rounded-lg border border-border/80 bg-[#F8F2DA] p-3">
                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Watch
                  </label>
                  <Input
                    type="number"
                    min={0}
                    value={form.watch_missed_services}
                    onChange={(event) => updateField("watch_missed_services", Number(event.target.value))}
                    disabled={saving}
                  />
                </div>
                <div className="space-y-1.5 rounded-lg border border-border/80 bg-[#F8F2DA] p-3">
                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    At Risk
                  </label>
                  <Input
                    type="number"
                    min={0}
                    value={form.at_risk_missed_services}
                    onChange={(event) => updateField("at_risk_missed_services", Number(event.target.value))}
                    disabled={saving}
                  />
                </div>
                <div className="space-y-1.5 rounded-lg border border-border/80 bg-[#F8F2DA] p-3">
                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Critical
                  </label>
                  <Input
                    type="number"
                    min={0}
                    value={form.critical_missed_services}
                    onChange={(event) => updateField("critical_missed_services", Number(event.target.value))}
                    disabled={saving}
                  />
                </div>
              </div>

              {error ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? "Creating workspace…" : "Create workspace"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
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
