"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, TrendingUp, Users } from "lucide-react";

import { ChurchHealthGauge } from "@/components/church-health-gauge";
import { MetricCard } from "@/components/metric-card";
import { PageShell } from "@/components/page-shell";
import { PriorityOutreachCard } from "@/components/priority-outreach-card";
import { RiskBadge } from "@/components/risk-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  buildMemberDirectoryRows,
  getAtRiskCount,
  getAttendance,
  getAttendanceTrend,
  getChurchHealthScore,
  getEngagementOverview,
  getMembers,
  getPriorityOutreachRows,
  getRiskDistribution,
  getRiskScores,
  type AttendanceRecord,
  type MemberDirectoryRow,
  type RiskScoreRecord,
} from "@/lib/data";
import { useAuth } from "@/lib/auth-context";

export default function DashboardPage() {
  const { churchId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [totalMembers, setTotalMembers] = useState(0);
  const [memberRows, setMemberRows] = useState<MemberDirectoryRow[]>([]);
  const [attendanceRows, setAttendanceRows] = useState<AttendanceRecord[]>([]);
  const [riskRows, setRiskRows] = useState<RiskScoreRecord[]>([]);

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      setLoading(true);

      if (!churchId) {
        if (active) {
          setTotalMembers(0);
          setMemberRows([]);
          setAttendanceRows([]);
          setRiskRows([]);
          setLoading(false);
        }
        return;
      }

      const [members, attendance, riskScores] = await Promise.all([
        getMembers(churchId),
        getAttendance(churchId),
        getRiskScores(churchId),
      ]);

      if (active) {
        setTotalMembers(members.length);
        setMemberRows(buildMemberDirectoryRows(members, riskScores, attendance));
        setAttendanceRows(attendance);
        setRiskRows(riskScores);
        setLoading(false);
      }
    };

    void loadData();

    return () => {
      active = false;
    };
  }, [churchId]);

  const priorityRows = useMemo(() => getPriorityOutreachRows(memberRows).slice(0, 4), [memberRows]);
  const healthScore = useMemo(() => getChurchHealthScore(riskRows), [riskRows]);
  const atRiskCount = useMemo(() => getAtRiskCount(riskRows), [riskRows]);
  const riskDistribution = useMemo(() => getRiskDistribution(riskRows), [riskRows]);
  const engagementOverview = useMemo(() => getEngagementOverview(memberRows), [memberRows]);
  const attendanceTrend = useMemo(() => getAttendanceTrend(attendanceRows, 12), [attendanceRows]);

  const recentWindow = attendanceTrend.slice(-4).reduce((sum, row) => sum + row.records, 0);
  const previousWindow = attendanceTrend.slice(-8, -4).reduce((sum, row) => sum + row.records, 0);
  const trendDelta = previousWindow ? Math.round(((recentWindow - previousWindow) / previousWindow) * 100) : 0;

  if (loading) {
    return (
      <PageShell>
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">Loading data...</CardContent>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <section className="grid gap-4 xl:grid-cols-[1.15fr_1fr_1fr_1fr]">
        <ChurchHealthGauge score={healthScore} />
        <MetricCard
          label="Total Members"
          value={totalMembers}
          supporting="Active member records in Shepherd"
          icon={Users}
          tone="evergreen"
        />
        <MetricCard
          label="At Risk"
          value={atRiskCount}
          supporting="Members in At Risk or Critical"
          icon={AlertTriangle}
          tone="critical"
        />
        <MetricCard
          label="Attendance Trend"
          value={`${trendDelta >= 0 ? "+" : ""}${trendDelta}%`}
          supporting="Compared to previous 4-week window"
          icon={TrendingUp}
          tone={trendDelta >= 0 ? "evergreen" : "gold"}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="shepherd-elevate">
          <CardHeader>
            <p className="shepherd-kicker">Risk Distribution</p>
            <CardTitle>Member risk mix</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!riskRows.length ? (
              <p className="rounded-lg border border-dashed border-border bg-[#FAFBFA] p-4 text-sm text-muted-foreground">
                No risk scores found.
              </p>
            ) : null}
            {riskDistribution.map((item) => (
              <div key={item.tier} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <RiskBadge tier={item.tier} />
                    <span className="text-sm text-muted-foreground">{item.count} members</span>
                  </div>
                  <span className="text-sm font-semibold text-foreground">{item.percent}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[#E5E7EB]">
                  <div
                    className="h-full rounded-full bg-primary shadow-[0_0_16px_rgba(0,107,85,0.22)]"
                    style={{ width: `${item.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="shepherd-elevate">
          <CardHeader>
            <p className="shepherd-kicker">Attendance Trend</p>
            <CardTitle>Last 12 weeks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid h-[168px] grid-cols-12 items-end gap-1.5 rounded-xl border border-border bg-[#FAFBFA] p-3">
              {attendanceTrend.map((point) => (
                <div key={point.label} className="flex h-full flex-col justify-end gap-1">
                  <div
                    className="rounded-md bg-primary/90 transition-all duration-200 hover:bg-primary"
                    style={{ height: `${Math.max(6, point.records * 12)}px` }}
                    title={`${point.label}: ${point.records} records`}
                  />
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{attendanceTrend[0]?.label}</span>
              <span>{attendanceTrend[attendanceTrend.length - 1]?.label}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="shepherd-elevate">
          <CardHeader>
            <p className="shepherd-kicker">Engagement Overview</p>
            <CardTitle>Current participation status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-xl border border-border bg-[#FAFBFA] p-3">
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Active (0-14d)</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{engagementOverview.active}</p>
            </div>
            <div className="rounded-xl border border-border bg-[#FAFBFA] p-3">
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Slipping (15-35d)</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{engagementOverview.slipping}</p>
            </div>
            <div className="rounded-xl border border-border bg-[#FAFBFA] p-3">
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Disengaged (35d+)</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{engagementOverview.disengaged}</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section>
        <Card className="shepherd-elevate">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="shepherd-kicker">Priority Outreach Queue</p>
                <CardTitle>Members needing timely follow-up</CardTitle>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-[#F3F5F4] px-3 py-1 text-xs font-medium text-foreground">
                <Activity className="size-3.5 text-primary" />
                {priorityRows.length} queued
              </span>
            </div>
          </CardHeader>
          <CardContent>
            {!memberRows.length ? (
              <div className="rounded-lg border border-dashed border-border bg-[#FAFBFA] p-6 text-center text-sm text-muted-foreground">
                No members found.
              </div>
            ) : !riskRows.length ? (
              <div className="rounded-lg border border-dashed border-border bg-[#FAFBFA] p-6 text-center text-sm text-muted-foreground">
                No risk scores found.
              </div>
            ) : (
              <div className="grid gap-3 xl:grid-cols-2">
                {priorityRows.map((row) => (
                  <PriorityOutreachCard
                    key={row.member.id}
                    row={row}
                    churchId={churchId ?? 0}
                    onStatusChange={() => undefined}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </PageShell>
  );
}
