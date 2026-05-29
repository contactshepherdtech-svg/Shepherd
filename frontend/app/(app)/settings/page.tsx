"use client";

import { useCallback, useEffect, useState } from "react";
import { Database, HeartHandshake } from "lucide-react";

import {
  ChurchSettingsPanel,
  PlanningCenterConnectionPanel,
  SyncStatusPanel,
} from "@/components/settings-panel";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getChurchSettings,
  getDefaultChurch,
  getPlanningCenterConnection,
  type ChurchSettingsRecord,
  type PlanningCenterConnection,
} from "@/lib/data";

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [churchId, setChurchId] = useState<number | null>(null);
  const [churchName, setChurchName] = useState("Unknown Church");
  const [settings, setSettings] = useState<ChurchSettingsRecord | null>(null);
  const [connection, setConnection] = useState<PlanningCenterConnection | null>(null);

  const loadSettings = useCallback(async () => {
    setLoading(true);

    const church = await getDefaultChurch();
    if (!church) {
      setChurchId(null);
      setChurchName("Unknown Church");
      setSettings(null);
      setConnection(null);
      setLoading(false);
      return;
    }

    const [churchSettings, planningCenterConnection] = await Promise.all([
      getChurchSettings(church.id),
      getPlanningCenterConnection(church.id),
    ]);

    setChurchId(church.id);
    setChurchName(church.name?.trim() || "Unknown Church");
    setSettings(churchSettings);
    setConnection(planningCenterConnection);
    setLoading(false);
  }, []);

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
        <PlanningCenterConnectionPanel connection={connection} churchName={churchName} loading={loading} />
        <SyncStatusPanel connection={connection} loading={loading} onSyncComplete={loadSettings} />
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
            This frontend reads live churches, members, attendance, risk scores, settings, and integration
            connection data using the public Supabase client. No write operations are executed from this UI.
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
