"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  CalendarClock,
  ClipboardList,
  Mail,
  MessageSquare,
  Phone,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

import { RiskBadge } from "@/components/risk-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MemberDirectoryRow } from "@/lib/data";
import { formatDate, formatRelativeDays } from "@/lib/format";

const tierActionMap: Record<string, string> = {
  Healthy: "No action needed",
  Watch: "Friendly check-in",
  "At Risk": "Personal email or call",
  Critical: "Pastor or ministry leader follow-up",
};

const tierPlainEnglishMap: Record<string, string> = {
  Healthy:
    "This member shows healthy consistency and is currently engaged in church rhythms.",
  Watch:
    "This member is starting to drift from regular rhythms and may benefit from a gentle personal touchpoint.",
  "At Risk":
    "This member has meaningful disengagement signals and should receive timely personal follow-up.",
  Critical:
    "This member has sustained disengagement indicators and likely needs direct leadership outreach this week.",
};

type MemberDetailPanelProps = {
  row: MemberDirectoryRow;
};

function buildAttendanceBuckets(attendanceHistory: Date[]) {
  const now = new Date();
  const days = 90;
  const bucketSize = 15;
  const bucketCount = Math.ceil(days / bucketSize);

  return Array.from({ length: bucketCount }).map((_, index) => {
    const rangeEnd = days - index * bucketSize;
    const rangeStart = Math.max(rangeEnd - bucketSize, 0);

    const count = attendanceHistory.filter((date) => {
      const dayDiff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
      return dayDiff >= rangeStart && dayDiff < rangeEnd;
    }).length;

    return {
      label: `${rangeStart}-${rangeEnd}d`,
      count,
    };
  }).reverse();
}

function getAttendanceTrend(attendanceHistory: Date[]) {
  const now = new Date();
  const currentWindowStart = new Date(now);
  currentWindowStart.setDate(now.getDate() - 30);

  const previousWindowStart = new Date(now);
  previousWindowStart.setDate(now.getDate() - 60);

  const current = attendanceHistory.filter((date) => date >= currentWindowStart).length;
  const previous = attendanceHistory.filter(
    (date) => date < currentWindowStart && date >= previousWindowStart,
  ).length;

  if (current === 0 && previous === 0) return "No recent activity";
  if (current > previous) return "Improving";
  if (current < previous) return "Declining";
  return "Stable";
}

function buildEmailTemplate(row: MemberDirectoryRow) {
  return [
    `Hi ${row.member.name.split(" ")[0]},`,
    "",
    "I wanted to check in and let you know we have been thinking about you.",
    "If there’s anything our church family can pray for or support, we would love to connect.",
    "",
    "Grace and peace,",
    "Shepherd Care Team",
  ].join("\n");
}

function buildSmsTemplate(row: MemberDirectoryRow) {
  return `Hi ${row.member.name.split(" ")[0]} — just checking in from Shepherd. We’ve missed seeing you recently. How can we support you this week?`;
}

function buildCallScriptTemplate(row: MemberDirectoryRow) {
  return [
    `Call Script for ${row.member.name}`,
    "",
    "1) Start warmly and thank them for their time.",
    "2) Ask how they have been doing recently.",
    "3) Share that the church has missed them and wants to support them.",
    "4) Offer prayer and ask about practical needs.",
    "5) Close with a clear follow-up step.",
  ].join("\n");
}

export function MemberDetailPanel({ row }: MemberDetailPanelProps) {
  const [outreachDraft, setOutreachDraft] = useState<string>("");
  const [actionStatus, setActionStatus] = useState<string>("");

  const attendanceTrend = useMemo(() => getAttendanceTrend(row.attendance_history), [row.attendance_history]);
  const attendanceBuckets = useMemo(
    () => buildAttendanceBuckets(row.attendance_history),
    [row.attendance_history],
  );

  const recentAttendance = row.attendance_history.slice(0, 6);
  const recommendedAction = tierActionMap[row.risk.tier] ?? "Friendly check-in";

  const onGenerateEmail = () => {
    setOutreachDraft(buildEmailTemplate(row));
    setActionStatus("Email template generated.");
  };

  const onGenerateSms = () => {
    setOutreachDraft(buildSmsTemplate(row));
    setActionStatus("SMS template generated.");
  };

  const onGenerateCallScript = () => {
    setOutreachDraft(buildCallScriptTemplate(row));
    setActionStatus("Call script generated.");
  };

  const onCreateGmailDraft = () => {
    if (!row.member.email) {
      setActionStatus("No email available for this member.");
      return;
    }

    setOutreachDraft(buildEmailTemplate(row));
    setActionStatus("Mock Gmail draft prepared locally (API not connected).");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-4"
    >
      <Card>
        <CardHeader className="pb-3">
          <p className="shepherd-kicker">Member 360</p>
          <CardTitle className="text-xl">{row.member.name}</CardTitle>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p className="inline-flex items-center gap-2">
              <Mail className="size-4" />
              {row.member.email || "No email on file"}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-border/80 bg-[#EFE6C7] px-2.5 py-1 text-xs font-medium text-foreground">
                {row.member.status}
              </span>
              <RiskBadge tier={row.risk.tier} />
              <span className="rounded-full border border-border/80 bg-[#EFE6C7] px-2.5 py-1 text-xs font-semibold text-foreground">
                Risk {row.risk.score}
              </span>
              <span className="rounded-full border border-border/80 bg-[#EFE6C7] px-2.5 py-1 text-xs font-medium text-muted-foreground">
                Last attended {formatDate(row.last_attended)}
              </span>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <p className="shepherd-kicker">Risk Analysis</p>
          <CardTitle>Why this member is in {row.risk.tier}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border/80 bg-[#F2EBD0] p-3">
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Risk score</p>
              <p className="mt-1 font-heading text-2xl font-semibold">{row.risk.score}</p>
            </div>
            <div className="rounded-lg border border-border/80 bg-[#F2EBD0] p-3">
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Tier</p>
              <div className="mt-1">
                <RiskBadge tier={row.risk.tier} />
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-border/80 bg-[#F8F2DA] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Reasons</p>
            {row.risk.reasons.length ? (
              <ul className="mt-2 space-y-1 text-sm text-foreground">
                {row.risk.reasons.map((reason) => (
                  <li key={reason}>• {reason}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">No risk reasons available yet.</p>
            )}
          </div>
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm leading-6 text-foreground">
            <p className="inline-flex items-center gap-2 font-semibold">
              <Sparkles className="size-4 text-primary" />
              Plain-English explanation
            </p>
            <p className="mt-2 text-muted-foreground">{tierPlainEnglishMap[row.risk.tier]}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <p className="shepherd-kicker">Attendance Timeline</p>
          <CardTitle>Last 90 days activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border/80 bg-[#F2EBD0] p-3">
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Total attendance</p>
              <p className="mt-1 font-heading text-2xl font-semibold">{row.attendance_count}</p>
            </div>
            <div className="rounded-lg border border-border/80 bg-[#F2EBD0] p-3">
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Last attended</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{formatDate(row.last_attended)}</p>
            </div>
          </div>

          <div className="rounded-lg border border-border/80 bg-card p-4">
            <div className="flex items-end gap-2">
              {attendanceBuckets.map((bucket) => (
                <div key={bucket.label} className="flex flex-1 flex-col items-center gap-2">
                  <div className="flex h-24 w-full items-end rounded-md bg-[#EFE6C6] p-1">
                    <div
                      className="w-full rounded-sm bg-primary"
                      style={{
                        height: `${Math.max(8, bucket.count * 18)}px`,
                        opacity: bucket.count ? 0.9 : 0.25,
                      }}
                    />
                  </div>
                  <span className="text-[11px] text-muted-foreground">{bucket.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Recent attendance dates
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {recentAttendance.length ? (
                recentAttendance.map((date) => (
                  <span
                    key={date.toISOString()}
                    className="rounded-full border border-border/80 bg-[#F2EBD0] px-2.5 py-1 text-xs text-foreground"
                  >
                    {formatDate(date)}
                  </span>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">No recent attendance dates.</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <p className="shepherd-kicker">Engagement Summary</p>
            <CardTitle>Current engagement snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-lg border border-border/80 bg-[#F8F2DA] px-3 py-2">
              <span className="text-muted-foreground">Attendance count</span>
              <span className="font-semibold">{row.attendance_count}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/80 bg-[#F8F2DA] px-3 py-2">
              <span className="text-muted-foreground">Days since last attendance</span>
              <span className="font-semibold">{formatRelativeDays(row.days_since_last_attendance)}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/80 bg-[#F8F2DA] px-3 py-2">
              <span className="text-muted-foreground">Attendance trend</span>
              <span className="font-semibold">{attendanceTrend}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <p className="shepherd-kicker">Recommended Action</p>
            <CardTitle>Next best follow-up step</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
                <ShieldAlert className="size-4" />
                Tier-based action
              </p>
              <p className="mt-2 text-sm text-foreground">{recommendedAction}</p>
            </div>
            <div className="rounded-lg border border-border/80 bg-[#F8F2DA] p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Operational note</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Coordinate outreach through the member’s ministry lead to preserve relationship continuity.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <p className="shepherd-kicker">Outreach Actions</p>
          <CardTitle>Generate communication drafts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Button onClick={onGenerateEmail} className="justify-start gap-2">
              <Mail className="size-4" />
              Generate Email
            </Button>
            <Button variant="secondary" onClick={onGenerateSms} className="justify-start gap-2">
              <MessageSquare className="size-4" />
              Generate SMS
            </Button>
            <Button variant="secondary" onClick={onGenerateCallScript} className="justify-start gap-2">
              <Phone className="size-4" />
              Generate Call Script
            </Button>
            <Button variant="secondary" onClick={onCreateGmailDraft} className="justify-start gap-2">
              <ClipboardList className="size-4" />
              Create Gmail Draft
            </Button>
          </div>

          <div className="rounded-lg border border-border/80 bg-[#F8F2DA] p-4">
            <p className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-foreground">
              <Activity className="size-4 text-primary" />
              Draft preview
            </p>
            {outreachDraft ? (
              <pre className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{outreachDraft}</pre>
            ) : (
              <p className="text-sm text-muted-foreground">
                Generate Email, SMS, or Call Script to preview outreach content.
              </p>
            )}
          </div>

          {actionStatus ? (
            <div className="rounded-md border border-border/80 bg-[#EEE5C6] px-3 py-2 text-sm text-foreground">
              {actionStatus}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <p className="shepherd-kicker">Outreach History</p>
          <CardTitle>Past communications</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed border-border bg-[#F8F2DA] p-6 text-center">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
              <CalendarClock className="size-4" />
              No outreach history yet.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Outreach activity will appear here once logging is enabled.
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
