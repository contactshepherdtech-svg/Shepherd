"use client";

import type { ComponentType, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import { motion } from "framer-motion";
import { AlertTriangle, Cable, CheckCircle2, Circle, Loader2, Mail, RefreshCcw, Settings2, Unplug } from "lucide-react";

import {
  getSyncHistory,
  isGmailConnected,
  isPlanningCenterConnected,
  updateChurchSettings,
  type ChurchSettingsRecord,
  type EditableChurchSettings,
  type GmailConnection,
  type PlanningCenterConnection,
  type SyncHistoryRecord,
} from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";

const SLIDER_MAX = 12;

const cardVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0 },
};

// ─── Threshold Slider ─────────────────────────────────────────────────────────

type ThresholdSliderProps = {
  label: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  badgeColor: string;
  description: string;
};

function ThresholdSlider({ label, value, onChange, disabled, badgeColor, description }: ThresholdSliderProps) {
  const pct = Math.round((value / SLIDER_MAX) * 100);
  return (
    <div className="space-y-3 rounded-xl border border-border/80 bg-[#FAFBFA] p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </span>
        <span className={`min-w-[2.2rem] rounded-full px-2.5 py-0.5 text-center text-sm font-bold ${badgeColor}`}>
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
        <span className="text-center opacity-75">{description}</span>
        <span>{SLIDER_MAX} missed</span>
      </div>
    </div>
  );
}

// ─── Panel shell ─────────────────────────────────────────────────────────────

type SettingsPanelProps = {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  children: ReactNode;
  actions?: ReactNode;
};

type SharedPanelProps = {
  loading?: boolean;
};

type PlanningCenterConnectionPanelProps = SharedPanelProps & {
  churchId: number | null;
  connection: PlanningCenterConnection | null;
  churchName: string;
};

type GmailConnectionPanelProps = SharedPanelProps & {
  churchId: number | null;
  connection: GmailConnection | null;
};

type SyncStatusPanelProps = SharedPanelProps & {
  churchId: number | null;
  connection: PlanningCenterConnection | null;
  onSyncComplete: () => Promise<void> | void;
};

type ChurchSettingsPanelProps = SharedPanelProps & {
  churchId: number | null;
  churchName: string;
  settings: ChurchSettingsRecord | null;
  onSettingsSaved: (settings: ChurchSettingsRecord) => void;
};

export type ConnectionChecklistPanelProps = SharedPanelProps & {
  planningCenterConnected: boolean;
  gmailConnected: boolean;
  hasSynced: boolean;
};

function Panel({ title, description, icon: Icon, children, actions }: SettingsPanelProps) {
  return (
    <motion.div
      variants={cardVariants}
      transition={{ duration: 0.4 }}
      whileHover={{ y: -2, transition: { duration: 0.18 } }}
    >
      <Card className="transition-shadow duration-200 hover:shadow-[0_12px_32px_rgba(11,95,74,0.12)]">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="shepherd-kicker">Settings</p>
              <CardTitle className="mt-1 text-[15px]">{title}</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            </div>
            <span className="shrink-0 rounded-lg border border-border/80 bg-[#F3F5F4] p-2">
              <Icon className="size-4 text-primary" />
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {children}
          {actions ? <div className="grid gap-2 sm:grid-cols-2">{actions}</div> : null}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Connection Checklist ─────────────────────────────────────────────────────

export function ConnectionChecklistPanel({
  planningCenterConnected,
  gmailConnected,
  hasSynced,
  loading = false,
}: ConnectionChecklistPanelProps) {
  const items = [
    {
      label: "Workspace created",
      done: true,
      description: "Your Shepherd workspace is active.",
    },
    {
      label: "Connect Planning Center",
      done: planningCenterConnected,
      description: "Import your congregation's attendance data.",
    },
    {
      label: "Connect Gmail",
      done: gmailConnected,
      description: "Send outreach drafts directly from Shepherd.",
    },
    {
      label: "Run first sync",
      done: hasSynced,
      description: "Pull members and attendance into your workspace.",
    },
  ];

  const doneCount = items.filter((i) => i.done).length;
  const allDone = doneCount === items.length;
  const progress = Math.round((doneCount / items.length) * 100);

  return (
    <motion.div variants={cardVariants}>
      <Card className="transition-shadow duration-200 hover:shadow-[0_12px_32px_rgba(11,95,74,0.12)]">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="shepherd-kicker">Getting Started</p>
              <CardTitle className="mt-1 text-[15px]">Setup Checklist</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {allDone
                  ? "You're all set — Shepherd is fully connected."
                  : "Complete these steps to unlock the full Shepherd experience."}
              </p>
            </div>
            <span className="shrink-0 rounded-full border border-border/80 bg-[#F3F5F4] px-2.5 py-1 text-xs font-semibold text-primary">
              {doneCount}/{items.length}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-2 overflow-hidden rounded-full bg-[#EEF1F0]">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="h-full rounded-full bg-primary shadow-[0_0_18px_rgba(0,107,85,0.20)]"
            />
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {items.map((item, i) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.08 + i * 0.07, duration: 0.32 }}
                className={`flex items-start gap-3 rounded-xl border p-3.5 transition-colors ${
                  item.done
                    ? "border-primary/22 bg-primary/6"
                    : "border-border/70 bg-[#FAFBFA]"
                }`}
              >
                {loading ? (
                  <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground/40" />
                ) : item.done ? (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                ) : (
                  <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground/50" />
                )}
                <div>
                  <p className={`text-sm font-medium ${item.done ? "text-primary" : "text-foreground"}`}>
                    {item.label}
                  </p>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Planning Center Connection ───────────────────────────────────────────────

export function PlanningCenterConnectionPanel({
  churchId,
  connection,
  churchName,
  loading = false,
}: PlanningCenterConnectionPanelProps) {
  const connected = isPlanningCenterConnected(connection);
  const [startingOAuth, setStartingOAuth] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);

  const startPlanningCenterOAuth = async () => {
    if (!churchId || !supabase || startingOAuth) return;

    setStartingOAuth(true);
    setOauthError(null);

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (sessionError || !accessToken) {
        throw new Error("Sign in again before connecting Planning Center.");
      }

      const response = await fetch(`/api/planning-center/connect?church_id=${churchId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const result = (await response.json().catch(() => null)) as { url?: string; error?: string } | null;

      if (!response.ok || !result?.url) {
        throw new Error(result?.error || "Could not start Planning Center OAuth.");
      }

      window.location.assign(result.url);
    } catch (error) {
      console.error("Failed to start Planning Center OAuth", error);
      setOauthError(error instanceof Error ? error.message : "Could not start Planning Center OAuth.");
    } finally {
      setStartingOAuth(false);
    }
  };

  return (
    <Panel
      title="Planning Center"
      description={
        connected
          ? "Your Planning Center account is connected and syncing attendance data."
          : "Connect Planning Center to import your members and attendance."
      }
      icon={Cable}
      actions={
        <>
          <Button
            variant="secondary"
            onClick={() => void startPlanningCenterOAuth()}
            disabled={!churchId || loading || startingOAuth}
          >
            {startingOAuth ? <Loader2 className="size-4 animate-spin" /> : null}
            Reconnect
          </Button>
          <Button onClick={() => void startPlanningCenterOAuth()} disabled={!churchId || loading || startingOAuth}>
            {startingOAuth ? <Loader2 className="size-4 animate-spin" /> : null}
            {startingOAuth
              ? "Opening Planning Center…"
              : connected
                ? "Update Authorization"
                : "Connect Planning Center"}
          </Button>
        </>
      }
    >
      <div className="rounded-xl border border-border/80 bg-[#FAFBFA] p-3.5 text-sm">
        <p className="inline-flex items-center gap-2 font-semibold text-foreground">
          {connected ? (
            <CheckCircle2 className="size-4 text-primary" />
          ) : (
            <Unplug className="size-4 text-muted-foreground" />
          )}
          {loading
            ? "Checking connection…"
            : connected
              ? "Planning Center Connected"
              : "Not connected"}
        </p>
        <p className="mt-1 text-muted-foreground">
          {loading ? "Loading…" : `Workspace: ${churchName}`}
        </p>
      </div>
      {oauthError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {oauthError}
        </div>
      ) : null}
    </Panel>
  );
}

// ─── Gmail Connection ─────────────────────────────────────────────────────────

export function GmailConnectionPanel({ churchId, connection, loading = false }: GmailConnectionPanelProps) {
  const connected = isGmailConnected(connection);
  const [startingOAuth, setStartingOAuth] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);

  const startGmailOAuth = async () => {
    if (!churchId || !supabase || startingOAuth) return;

    setStartingOAuth(true);
    setOauthError(null);

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (sessionError || !accessToken) {
        throw new Error("Sign in again before connecting Gmail.");
      }

      const response = await fetch(`/api/gmail/connect?church_id=${churchId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const result = (await response.json().catch(() => null)) as { url?: string; error?: string } | null;

      if (!response.ok || !result?.url) {
        throw new Error(result?.error ?? "Could not start Gmail OAuth.");
      }

      window.location.assign(result.url);
    } catch (error) {
      console.error("Failed to start Gmail OAuth", error);
      setOauthError(error instanceof Error ? error.message : "Could not start Gmail OAuth.");
    } finally {
      setStartingOAuth(false);
    }
  };

  return (
    <Panel
      title="Gmail"
      description={
        connected
          ? "Gmail is connected. Shepherd can create outreach drafts in your inbox."
          : "Connect Gmail to send outreach drafts directly from Shepherd."
      }
      icon={Mail}
      actions={
        <Button
          onClick={() => void startGmailOAuth()}
          disabled={!churchId || loading || startingOAuth}
          className="sm:col-span-2"
        >
          {startingOAuth ? <Loader2 className="size-4 animate-spin" /> : null}
          {startingOAuth
            ? "Opening Google…"
            : connected
              ? "Reconnect Gmail"
              : "Connect Gmail"}
        </Button>
      }
    >
      <div className="rounded-xl border border-border/80 bg-[#FAFBFA] p-3.5 text-sm">
        <p className="inline-flex items-center gap-2 font-semibold text-foreground">
          {connected ? (
            <CheckCircle2 className="size-4 text-primary" />
          ) : (
            <Unplug className="size-4 text-muted-foreground" />
          )}
          {loading ? "Checking connection…" : connected ? "Gmail Connected" : "Gmail not connected"}
        </p>
        {!loading && connected && connection?.connected_email ? (
          <p className="mt-1 text-muted-foreground">{connection.connected_email}</p>
        ) : null}
        {!loading && !connected ? (
          <p className="mt-1 text-muted-foreground">
            Connect Gmail to create outreach drafts directly in your inbox.
          </p>
        ) : null}
      </div>
      {oauthError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {oauthError}
        </div>
      ) : null}
    </Panel>
  );
}

// ─── Sync Status ──────────────────────────────────────────────────────────────

export function SyncStatusPanel({ churchId, connection, loading = false, onSyncComplete }: SyncStatusPanelProps) {
  const { syncStatus, syncError, triggerSync, planningCenterConnection } = useAuth();
  const [history, setHistory] = useState<SyncHistoryRecord[]>([]);

  // Prefer the context connection (kept live by the sync poll) so counts and
  // last-sync update during/after a run; fall back to the page-loaded prop.
  const liveConnection = planningCenterConnection ?? connection;
  const syncing = syncStatus === "syncing";

  // Load recent runs on mount and whenever a sync finishes (syncStatus flips out
  // of "syncing" to success/error), so the latest run shows immediately.
  useEffect(() => {
    if (!churchId) {
      setHistory([]);
      return;
    }
    let active = true;
    void getSyncHistory(churchId, 5).then((rows) => {
      if (active) setHistory(rows);
    });
    return () => {
      active = false;
    };
  }, [churchId, syncStatus]);

  const hasLastSync = Boolean(liveConnection?.last_sync_at);
  const lastSync = hasLastSync ? new Date(liveConnection!.last_sync_at as string) : null;
  const lastSyncLabel =
    hasLastSync && lastSync && !Number.isNaN(lastSync.getTime())
      ? lastSync.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      : "Not synced yet";

  // Manual sync routes through the shared trigger so it honors the in-flight
  // guard and server-side lock. onSyncComplete refreshes the page-level data.
  const onRunSyncNow = async () => {
    await triggerSync();
    await onSyncComplete();
  };

  const syncMessage =
    syncStatus === "success"
      ? { tone: "success" as const, text: "Sync completed successfully." }
      : syncStatus === "error"
        ? { tone: "error" as const, text: syncError || "Sync failed." }
        : null;

  // null = the run never reached that step; show "—" rather than a misleading 0.
  const fmtCount = (n: number | null) => (n === null || n === undefined ? "—" : n);

  return (
    <Panel
      title="Sync Status"
      description="View your last import summary and trigger a new sync cycle."
      icon={RefreshCcw}
      actions={
        <Button
          onClick={onRunSyncNow}
          disabled={loading || syncing || !churchId}
          className="sm:col-span-2"
        >
          {syncing ? <Loader2 className="size-4 animate-spin" /> : null}
          {syncing ? "Syncing…" : "Run Sync Now"}
        </Button>
      }
    >
      <div className="space-y-2 text-sm text-foreground">
        <div className="flex items-center justify-between rounded-xl border border-border/80 bg-[#FAFBFA] px-3.5 py-2.5">
          <span className="text-muted-foreground">Last Sync</span>
          <span className="font-medium">{loading ? "Loading…" : lastSyncLabel}</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl border border-border/80 bg-[#FAFBFA] px-3.5 py-2.5">
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Members Imported</p>
            <p className="mt-1 text-lg font-semibold">{loading ? "—" : (liveConnection?.members_imported ?? 0)}</p>
          </div>
          <div className="rounded-xl border border-border/80 bg-[#FAFBFA] px-3.5 py-2.5">
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Attendance Imported</p>
            <p className="mt-1 text-lg font-semibold">{loading ? "—" : (liveConnection?.attendance_imported ?? 0)}</p>
          </div>
        </div>
        {syncMessage ? (
          <div
            className={`rounded-xl border px-3 py-2 text-sm ${
              syncMessage.tone === "success"
                ? "border-primary/25 bg-primary/8 text-primary"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {syncMessage.text}
          </div>
        ) : null}

        {history.length ? (
          <div className="space-y-2 pt-1">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Recent Syncs
            </p>
            <ul className="space-y-1.5">
              {history.map((run) => {
                const finished = run.finished_at ? new Date(run.finished_at) : null;
                const whenLabel =
                  finished && !Number.isNaN(finished.getTime())
                    ? finished.toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })
                    : "Unknown time";
                const isSuccess = run.status === "success";
                return (
                  <li key={run.id} className="rounded-xl border border-border/80 bg-[#FAFBFA] px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                        {isSuccess ? (
                          <CheckCircle2 className="size-3.5 text-primary" />
                        ) : (
                          <AlertTriangle className="size-3.5 text-red-600" />
                        )}
                        {isSuccess ? "Success" : "Failed"}
                      </span>
                      <span className="text-xs text-muted-foreground">{whenLabel}</span>
                    </div>
                    {isSuccess ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {fmtCount(run.members_imported)} members · {fmtCount(run.attendance_imported)} attendance ·{" "}
                        {fmtCount(run.risk_scores_updated)} risk · {fmtCount(run.lifecycle_updated)} lifecycle
                      </p>
                    ) : run.error_message ? (
                      <p className="mt-1 break-words text-xs text-red-600">{run.error_message}</p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}

// ─── Church Settings ──────────────────────────────────────────────────────────

const DEFAULT_MAIN_SERVICE_FREQUENCY = "weekly";
const DEFAULT_WATCH_MISSED_SERVICES = 2;
const DEFAULT_AT_RISK_MISSED_SERVICES = 4;
const DEFAULT_CRITICAL_MISSED_SERVICES = 6;
const DEFAULT_FOLLOWUP_STYLE = "soft and friendly";

function buildDefaultSettings(churchName: string): EditableChurchSettings {
  return {
    church_name: churchName || "Unknown Church",
    main_service_frequency: DEFAULT_MAIN_SERVICE_FREQUENCY,
    watch_missed_services: DEFAULT_WATCH_MISSED_SERVICES,
    at_risk_missed_services: DEFAULT_AT_RISK_MISSED_SERVICES,
    critical_missed_services: DEFAULT_CRITICAL_MISSED_SERVICES,
    preferred_followup_style: DEFAULT_FOLLOWUP_STYLE,
  };
}

function buildSettingsForm(settings: ChurchSettingsRecord | null, churchName: string): EditableChurchSettings {
  const defaults = buildDefaultSettings(churchName);
  return {
    church_name: settings?.church_name ?? defaults.church_name,
    main_service_frequency: settings?.main_service_frequency ?? defaults.main_service_frequency,
    watch_missed_services: settings?.watch_missed_services ?? defaults.watch_missed_services,
    at_risk_missed_services: settings?.at_risk_missed_services ?? defaults.at_risk_missed_services,
    critical_missed_services: settings?.critical_missed_services ?? defaults.critical_missed_services,
    preferred_followup_style: settings?.preferred_followup_style ?? defaults.preferred_followup_style,
  };
}

function normalizeSettingsForm(values: EditableChurchSettings): EditableChurchSettings {
  return {
    church_name: values.church_name?.trim() || "Unknown Church",
    main_service_frequency: values.main_service_frequency?.trim() || DEFAULT_MAIN_SERVICE_FREQUENCY,
    watch_missed_services: Math.max(Number(values.watch_missed_services ?? DEFAULT_WATCH_MISSED_SERVICES), 0),
    at_risk_missed_services: Math.max(Number(values.at_risk_missed_services ?? DEFAULT_AT_RISK_MISSED_SERVICES), 0),
    critical_missed_services: Math.max(Number(values.critical_missed_services ?? DEFAULT_CRITICAL_MISSED_SERVICES), 0),
    preferred_followup_style: values.preferred_followup_style?.trim() || DEFAULT_FOLLOWUP_STYLE,
  };
}

export function ChurchSettingsPanel({
  churchId,
  churchName,
  settings,
  loading = false,
  onSettingsSaved,
}: ChurchSettingsPanelProps) {
  const initialForm = useMemo(() => buildSettingsForm(settings, churchName), [settings, churchName]);
  const [formValues, setFormValues] = useState<EditableChurchSettings>(initialForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    setFormValues(initialForm);
    setMessage(null);
  }, [initialForm]);

  const onFieldChange = (field: keyof EditableChurchSettings, value: string | number) => {
    setFormValues((currentValues) => ({ ...currentValues, [field]: value }));
  };

  const setWatch = (v: number) => {
    setFormValues((cur) => ({
      ...cur,
      watch_missed_services: v,
      at_risk_missed_services: Math.max(cur.at_risk_missed_services ?? v + 1, v + 1),
      critical_missed_services: Math.max(cur.critical_missed_services ?? v + 2, v + 2),
    }));
  };

  const setAtRisk = (v: number) => {
    setFormValues((cur) => ({
      ...cur,
      watch_missed_services: Math.min(cur.watch_missed_services ?? v - 1, v - 1),
      at_risk_missed_services: v,
      critical_missed_services: Math.max(cur.critical_missed_services ?? v + 1, v + 1),
    }));
  };

  const setCritical = (v: number) => {
    setFormValues((cur) => ({
      ...cur,
      watch_missed_services: Math.min(cur.watch_missed_services ?? v - 2, v - 2),
      at_risk_missed_services: Math.min(cur.at_risk_missed_services ?? v - 1, v - 1),
      critical_missed_services: v,
    }));
  };

  const saveValues = async (values: EditableChurchSettings, successMessage: string) => {
    if (!churchId) {
      setMessage({ tone: "error", text: "No active church found." });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const savedSettings = await updateChurchSettings(churchId, normalizeSettingsForm(values));
      setFormValues(buildSettingsForm(savedSettings, churchName));
      onSettingsSaved(savedSettings);
      setMessage({ tone: "success", text: successMessage });
    } catch (error) {
      console.error("Failed to save church settings", error);
      setMessage({ tone: "error", text: "Could not save settings. Check Supabase permissions and try again." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel
      title="Church Settings"
      description="Review risk thresholds and communication posture for your congregation."
      icon={Settings2}
      actions={
        <>
          <Button
            variant="secondary"
            onClick={() => void saveValues(buildDefaultSettings(churchName), "Defaults restored.")}
            disabled={loading || saving || !churchId}
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Reset Defaults
          </Button>
          <Button onClick={() => void saveValues(formValues, "Settings saved.")} disabled={loading || saving || !churchId}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            {saving ? "Saving…" : "Save Settings"}
          </Button>
        </>
      }
    >
      <div className="space-y-2 text-sm text-foreground">
        <div className="grid gap-2 rounded-xl border border-border/80 bg-[#FAFBFA] px-3.5 py-2.5 sm:grid-cols-[160px_1fr] sm:items-center">
          <span className="text-muted-foreground">Church Name</span>
          <Input
            value={loading ? "" : (formValues.church_name ?? "")}
            onChange={(event) => onFieldChange("church_name", event.target.value)}
            placeholder={loading ? "Loading…" : "Church name"}
            disabled={loading || saving}
          />
        </div>
        <div className="grid gap-2 rounded-xl border border-border/80 bg-[#FAFBFA] px-3.5 py-2.5 sm:grid-cols-[160px_1fr] sm:items-center">
          <span className="text-muted-foreground">Service Frequency</span>
          <select
            value={loading ? DEFAULT_MAIN_SERVICE_FREQUENCY : (formValues.main_service_frequency ?? DEFAULT_MAIN_SERVICE_FREQUENCY)}
            onChange={(event) => onFieldChange("main_service_frequency", event.target.value)}
            disabled={loading || saving}
            className="flex h-10 w-full rounded-lg border border-border/90 bg-card px-3 py-2 text-sm text-foreground shadow-xs transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="weekly">Weekly</option>
            <option value="twice_weekly">Twice weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>

        {/* Threshold sliders */}
        <div className="space-y-2 pt-1">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Engagement Thresholds (missed services)
          </p>
          <div className="space-y-2">
            <ThresholdSlider
              label="Watch"
              value={loading ? DEFAULT_WATCH_MISSED_SERVICES : (formValues.watch_missed_services ?? DEFAULT_WATCH_MISSED_SERVICES)}
              onChange={setWatch}
              disabled={loading || saving}
              badgeColor="bg-yellow-100 text-yellow-800"
              description="Early monitoring"
            />
            <ThresholdSlider
              label="At Risk"
              value={loading ? DEFAULT_AT_RISK_MISSED_SERVICES : (formValues.at_risk_missed_services ?? DEFAULT_AT_RISK_MISSED_SERVICES)}
              onChange={setAtRisk}
              disabled={loading || saving}
              badgeColor="bg-orange-100 text-orange-800"
              description="Needs outreach"
            />
            <ThresholdSlider
              label="Critical"
              value={loading ? DEFAULT_CRITICAL_MISSED_SERVICES : (formValues.critical_missed_services ?? DEFAULT_CRITICAL_MISSED_SERVICES)}
              onChange={setCritical}
              disabled={loading || saving}
              badgeColor="bg-red-100 text-red-800"
              description="Urgent follow-up"
            />
          </div>
        </div>

        <div className="grid gap-2 rounded-xl border border-border/80 bg-[#FAFBFA] px-3.5 py-2.5 sm:grid-cols-[160px_1fr] sm:items-center">
          <span className="text-muted-foreground">Follow-up Style</span>
          <Input
            value={loading ? "" : (formValues.preferred_followup_style ?? "")}
            onChange={(event) => onFieldChange("preferred_followup_style", event.target.value)}
            placeholder={loading ? "Loading…" : "e.g. soft and friendly"}
            disabled={loading || saving}
          />
        </div>
        {message ? (
          <div
            className={`rounded-xl border px-3 py-2 text-sm ${
              message.tone === "success"
                ? "border-primary/25 bg-primary/8 text-primary"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {message.text}
          </div>
        ) : null}
      </div>
    </Panel>
  );
}
