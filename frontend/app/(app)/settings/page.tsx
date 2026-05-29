"use client";

import { useCallback, useEffect, useState } from "react";
import { Database, HeartHandshake } from "lucide-react";

import {
  ChurchSettingsPanel,
  GmailConnectionPanel,
  PlanningCenterConnectionPanel,
  SyncStatusPanel,
} from "@/components/settings-panel";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getChurchSettings,
  getGmailConnection,
  getPlanningCenterConnection,
  type ChurchSettingsRecord,
  type GmailConnection,
  type PlanningCenterConnection,
} from "@/lib/data";
import { useAuth } from "@/lib/auth-context";

export default function SettingsPage() {
  const { churchId, churchName: activeChurchName, refreshWorkspace } = useAuth();
  const [loading, setLoading] = useState(true);
  const [churchName, setChurchName] = useState("Unknown Church");
  const [settings, setSettings] = useState<ChurchSettingsRecord | null>(null);
  const [connection, setConnection] = useState<PlanningCenterConnection | null>(null);
  const [gmailConnection, setGmailConnection] = useState<GmailConnection | null>(null);

  const loadSettings = useCallback(async () => {
    setLoading(true);

    if (!churchId) {
      setChurchName(activeChurchName ?? "Unknown Church");
      setSettings(null);
      setConnection(null);
      setLoading(false);
      return;
    }

    const [churchSettings, planningCenterConnection, gmailConn] = await Promise.all([
      getChurchSettings(churchId),
      getPlanningCenterConnection(churchId),
      getGmailConnection(churchId),
    ]);

    setChurchName(activeChurchName ?? churchSettings?.church_name?.trim() ?? "Unknown Church");
    setSettings(churchSettings);
    setConnection(planningCenterConnection);
    setGmailConnection(gmailConn);
    await refreshWorkspace();
    setLoading(false);
  }, [activeChurchName, churchId, refreshWorkspace]);

  useEffect(() => {
    let active = true;

    const loadActiveSettings = async () => {
      try {
        await loadSettings();
      } finally {
        if (!active) {
          return;
        }
      }
    };

    void loadActiveSettings();

    return () => {
      active = false;
    };
  }, [loadSettings]);

  return (
    <PageShell>
      <section className="grid gap-4 xl:grid-cols-2">
        <PlanningCenterConnectionPanel
          churchId={churchId}
          connection={connection}
          churchName={churchName}
          loading={loading}
        />
        <SyncStatusPanel
          churchId={churchId}
          connection={connection}
          loading={loading}
          onSyncComplete={loadSettings}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <GmailConnectionPanel
          churchId={churchId}
          connection={gmailConnection}
          loading={loading}
        />
      </section>

      <section>
        <ChurchSettingsPanel
          churchId={churchId}
          churchName={churchName}
          settings={settings}
          loading={loading}
          onSettingsSaved={setSettings}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <p className="shepherd-kicker">Data Readiness</p>
            <CardTitle className="inline-flex items-center gap-2">
              <Database className="size-4 text-primary" />
              Read-only Supabase Scope
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-6 text-muted-foreground">
            This workspace reads live churches, members, attendance, risk scores, settings, and integration
            connection data scoped to the authenticated church. Editable settings are saved only for this workspace.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <p className="shepherd-kicker">Care Operations</p>
            <CardTitle className="inline-flex items-center gap-2">
              <HeartHandshake className="size-4 text-primary" />
              Follow-up Guidelines
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-6 text-muted-foreground">
            Keep communications warm and personal. Route critical members to pastoral follow-up,
            and use watch-tier check-ins to reconnect members before disengagement deepens.
          </CardContent>
        </Card>
      </section>
    </PageShell>
  );
}
