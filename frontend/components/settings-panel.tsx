"use client";

import type { ComponentType, ReactNode } from "react";

import { motion } from "framer-motion";
import { Cable, CheckCircle2, RefreshCcw, Settings2, Unplug } from "lucide-react";

import { isPlanningCenterConnected, type ChurchSettingsRecord, type PlanningCenterConnection } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
  settings: ChurchSettingsRecord | null;
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

export function ChurchSettingsPanel({ settings, loading = false }: ChurchSettingsPanelProps) {
  return (
    <Panel
      title="Church Settings"
      description="Review risk thresholds and communication posture."
      icon={Settings2}
      actions={
        <>
          <Button variant="secondary">Reset Defaults</Button>
          <Button>Save Settings</Button>
        </>
      }
    >
      <div className="space-y-2 text-sm text-foreground">
        <div className="flex items-center justify-between rounded-lg border border-border/80 bg-[#F8F2DA] px-3 py-2">
          <span className="text-muted-foreground">Church</span>
          <span className="font-medium">
            {loading ? "Loading data..." : settings?.church_name?.trim() || "Unknown Church"}
          </span>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg border border-border/80 bg-[#F8F2DA] px-3 py-2">
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Watch</p>
            <p className="mt-1 font-semibold">
              {loading ? "—" : settings?.watch_missed_services ?? 0} misses
            </p>
          </div>
          <div className="rounded-lg border border-border/80 bg-[#F8F2DA] px-3 py-2">
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">At Risk</p>
            <p className="mt-1 font-semibold">
              {loading ? "—" : settings?.at_risk_missed_services ?? 0} misses
            </p>
          </div>
          <div className="rounded-lg border border-border/80 bg-[#F8F2DA] px-3 py-2">
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Critical</p>
            <p className="mt-1 font-semibold">
              {loading ? "—" : settings?.critical_missed_services ?? 0} misses
            </p>
          </div>
        </div>
      </div>
    </Panel>
  );
}
