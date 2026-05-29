"use client";

import type { ComponentType, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import { motion } from "framer-motion";
import { Cable, CheckCircle2, RefreshCcw, Settings2, Unplug } from "lucide-react";

import {
  isPlanningCenterConnected,
  updateChurchSettings,
  type ChurchSettingsRecord,
  type EditableChurchSettings,
  type PlanningCenterConnection,
} from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

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
  connection: PlanningCenterConnection | null;
  churchName: string;
};

type SyncStatusPanelProps = SharedPanelProps & {
  connection: PlanningCenterConnection | null;
};

type ChurchSettingsPanelProps = SharedPanelProps & {
  churchId: number | null;
  churchName: string;
  settings: ChurchSettingsRecord | null;
  onSettingsSaved: (settings: ChurchSettingsRecord) => void;
};

function Panel({ title, description, icon: Icon, children, actions }: SettingsPanelProps) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -1 }}>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="shepherd-kicker">Settings</p>
              <CardTitle className="mt-1">{title}</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            </div>
            <span className="rounded-lg border border-border/80 bg-[#F0E7C7] p-2">
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

export function PlanningCenterConnectionPanel({
  connection,
  churchName,
  loading = false,
}: PlanningCenterConnectionPanelProps) {
  const connected = isPlanningCenterConnected(connection);

  return (
    <Panel
      title="Planning Center Connection"
      description="Manage integration connection and authorize account access."
      icon={Cable}
      actions={
        <>
          <Button variant="secondary">Reconnect Planning Center</Button>
          <Button>Open OAuth Flow</Button>
        </>
      }
    >
      <div className="rounded-lg border border-border/80 bg-[#F8F2DA] p-3 text-sm">
        <p className="inline-flex items-center gap-2 font-semibold text-foreground">
          {connected ? (
            <CheckCircle2 className="size-4 text-primary" />
          ) : (
            <Unplug className="size-4 text-primary" />
          )}
          {loading
            ? "Loading data..."
            : connected
              ? "Planning Center Connected"
              : "Not connected to Planning Center"}
        </p>
        <p className="mt-1 text-muted-foreground">
          {loading ? "Checking connection status..." : `Workspace: ${churchName}`}
        </p>
      </div>
    </Panel>
  );
}

export function SyncStatusPanel({ connection, loading = false }: SyncStatusPanelProps) {
  const hasLastSync = Boolean(connection?.last_sync_at);
  const lastSync = hasLastSync ? new Date(connection!.last_sync_at as string) : null;
  const lastSyncLabel =
    hasLastSync && lastSync && !Number.isNaN(lastSync.getTime())
      ? lastSync.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "Not synced yet";

  return (
    <Panel
      title="Sync Status"
      description="View recent import summary and trigger a new sync cycle."
      icon={RefreshCcw}
      actions={
        <>
          <Button variant="secondary">Reconnect</Button>
          <Button>Run Sync Now</Button>
        </>
      }
    >
      <div className="space-y-2 text-sm text-foreground">
        <div className="flex items-center justify-between rounded-lg border border-border/80 bg-[#F8F2DA] px-3 py-2">
          <span className="text-muted-foreground">Last Sync</span>
          <span className="font-medium">{loading ? "Loading data..." : lastSyncLabel}</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg border border-border/80 bg-[#F8F2DA] px-3 py-2">
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Members Imported</p>
            <p className="mt-1 text-lg font-semibold">{loading ? "—" : connection?.members_imported ?? 0}</p>
          </div>
          <div className="rounded-lg border border-border/80 bg-[#F8F2DA] px-3 py-2">
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Attendance Imported</p>
            <p className="mt-1 text-lg font-semibold">{loading ? "—" : connection?.attendance_imported ?? 0}</p>
          </div>
        </div>
      </div>
    </Panel>
  );
}

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
    setFormValues((currentValues) => ({
      ...currentValues,
      [field]: value,
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

  const onSaveSettings = () => {
    void saveValues(formValues, "Settings saved.");
  };

  const onResetDefaults = () => {
    const defaults = buildDefaultSettings(churchName);
    setFormValues(defaults);
    void saveValues(defaults, "Defaults restored.");
  };

  return (
    <Panel
      title="Church Settings"
      description="Review risk thresholds and communication posture."
      icon={Settings2}
      actions={
        <>
          <Button variant="secondary" onClick={onResetDefaults} disabled={loading || saving || !churchId}>
            Reset Defaults
          </Button>
          <Button onClick={onSaveSettings} disabled={loading || saving || !churchId}>
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </>
      }
    >
      <div className="space-y-2 text-sm text-foreground">
        <div className="grid gap-2 rounded-lg border border-border/80 bg-[#F8F2DA] px-3 py-2 sm:grid-cols-[180px_1fr] sm:items-center">
          <span className="text-muted-foreground">Church</span>
          <Input
            value={loading ? "" : formValues.church_name ?? ""}
            onChange={(event) => onFieldChange("church_name", event.target.value)}
            placeholder={loading ? "Loading data..." : "Church name"}
            disabled={loading || saving}
          />
        </div>
        <div className="grid gap-2 rounded-lg border border-border/80 bg-[#F8F2DA] px-3 py-2 sm:grid-cols-[180px_1fr] sm:items-center">
          <span className="text-muted-foreground">Service Frequency</span>
          <select
            value={loading ? DEFAULT_MAIN_SERVICE_FREQUENCY : formValues.main_service_frequency ?? DEFAULT_MAIN_SERVICE_FREQUENCY}
            onChange={(event) => onFieldChange("main_service_frequency", event.target.value)}
            disabled={loading || saving}
            className="flex h-10 w-full rounded-lg border border-border/90 bg-card px-3 py-2 text-sm text-foreground shadow-xs transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="weekly">Weekly</option>
            <option value="twice_weekly">Twice weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg border border-border/80 bg-[#F8F2DA] px-3 py-2">
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Watch</p>
            <Input
              type="number"
              min={0}
              value={loading ? "" : formValues.watch_missed_services ?? 0}
              onChange={(event) => onFieldChange("watch_missed_services", Number(event.target.value))}
              disabled={loading || saving}
              className="mt-1"
            />
          </div>
          <div className="rounded-lg border border-border/80 bg-[#F8F2DA] px-3 py-2">
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">At Risk</p>
            <Input
              type="number"
              min={0}
              value={loading ? "" : formValues.at_risk_missed_services ?? 0}
              onChange={(event) => onFieldChange("at_risk_missed_services", Number(event.target.value))}
              disabled={loading || saving}
              className="mt-1"
            />
          </div>
          <div className="rounded-lg border border-border/80 bg-[#F8F2DA] px-3 py-2">
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Critical</p>
            <Input
              type="number"
              min={0}
              value={loading ? "" : formValues.critical_missed_services ?? 0}
              onChange={(event) => onFieldChange("critical_missed_services", Number(event.target.value))}
              disabled={loading || saving}
              className="mt-1"
            />
          </div>
        </div>
        <div className="grid gap-2 rounded-lg border border-border/80 bg-[#F8F2DA] px-3 py-2 sm:grid-cols-[180px_1fr] sm:items-center">
          <span className="text-muted-foreground">Follow-up Style</span>
          <Input
            value={loading ? "" : formValues.preferred_followup_style ?? ""}
            onChange={(event) => onFieldChange("preferred_followup_style", event.target.value)}
            placeholder={loading ? "Loading data..." : "Preferred follow-up style"}
            disabled={loading || saving}
          />
        </div>
        {message ? (
          <div
            className={`rounded-lg border px-3 py-2 text-sm ${
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
