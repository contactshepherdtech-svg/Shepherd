"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  BellOff,
  Check,
  CheckCircle2,
  ClipboardList,
  Copy,
  Mail,
  MessageSquare,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

import { RiskBadge } from "@/components/risk-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getVisitorLifecycleLabel,
  getGmailConnection,
  getOutreachStatuses,
  isVisitorFollowUpDue,
  isVisitorFollowUpLifecycle,
  isGmailConnected,
  markVisitorFollowedUp,
  upsertOutreachStatus,
  type MemberDirectoryRow,
  type OutreachStatusRecord,
} from "@/lib/data";
import { formatDate, formatRelativeDays } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";

type OutreachType = "email" | "sms";

type DraftResult =
  | { type: "email"; subject: string; body: string; source: "openrouter" | "fallback"; model: string | null }
  | { type: "sms"; body: string; source: "openrouter" | "fallback"; model: string | null };

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

const missingRiskExplanation = "No risk score available for this member yet.";

type MemberDetailPanelProps = {
  row: MemberDirectoryRow;
  churchId: number | null;
  autoGenerateEmail?: boolean;
  onAutoEmailTriggered?: () => void;
  onVisitorFollowedUp?: (memberPcoId: string, followedUpAt: string) => void;
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

type GmailDraftStatus = "idle" | "creating" | "success" | "error";
type OutreachActionState = "idle" | "loading" | "success" | "error";

export function MemberDetailPanel({
  row,
  churchId,
  autoGenerateEmail,
  onAutoEmailTriggered,
  onVisitorFollowedUp,
}: MemberDetailPanelProps) {
  const [generating, setGenerating] = useState<OutreachType | null>(null);
  const [draft, setDraft] = useState<DraftResult | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [gmailStatus, setGmailStatus] = useState<GmailDraftStatus>("idle");
  const [gmailError, setGmailError] = useState<string | null>(null);
  const [gmailConnected, setGmailConnected] = useState<boolean | null>(null);
  const [outreachStatus, setOutreachStatus] = useState<OutreachStatusRecord | null>(null);
  const [outreachActionState, setOutreachActionState] = useState<OutreachActionState>("idle");
  const [outreachMessage, setOutreachMessage] = useState<string | null>(null);
  const [outreachError, setOutreachError] = useState<string | null>(null);
  const [visitorFollowUpAt, setVisitorFollowUpAt] = useState<Date | null>(row.member.last_followup_at);
  const [visitorFollowUpState, setVisitorFollowUpState] = useState<OutreachActionState>("idle");
  const [visitorFollowUpMessage, setVisitorFollowUpMessage] = useState<string | null>(null);
  const [visitorFollowUpError, setVisitorFollowUpError] = useState<string | null>(null);

  // Outreach is a WRITE surface — only admins/pastors may use it. Server routes
  // (outreach generate, gmail draft, mark-followed-up) already enforce this; here
  // we hide the whole action surface so viewers never see controls that only error.
  const { churchUser } = useAuth();
  const canWriteOutreach = churchUser?.role === "admin" || churchUser?.role === "pastor";

  // Load outreach status and Gmail connection whenever churchId changes
  useEffect(() => {
    setOutreachStatus(null);
    setOutreachActionState("idle");
    setOutreachMessage(null);
    setOutreachError(null);

    if (!churchId || !row.member.pco_id) return;

    let active = true;
    void getOutreachStatuses(churchId).then((all) => {
      if (!active) return;
      setOutreachStatus(all.find((s) => s.member_pco_id === row.member.pco_id) ?? null);
    });

    return () => { active = false; };
  }, [churchId, row.member.pco_id]);

  useEffect(() => {
    if (!churchId) return;
    let active = true;
    void getGmailConnection(churchId).then((conn) => {
      if (!active) return;
      setGmailConnected(isGmailConnected(conn));
    });
    return () => { active = false; };
  }, [churchId]);

  // Auto-trigger email generation when navigated from "Draft Email" button.
  // Skipped for viewers — they have no generate surface and the API would 403.
  useEffect(() => {
    if (!autoGenerateEmail) return;
    if (!canWriteOutreach) return;
    onAutoEmailTriggered?.();
    void onGenerate("email");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoGenerateEmail]);

  useEffect(() => {
    setVisitorFollowUpAt(row.member.last_followup_at);
    setVisitorFollowUpState("idle");
    setVisitorFollowUpMessage(null);
    setVisitorFollowUpError(null);
  }, [row.member.id, row.member.last_followup_at]);

  const handleOutreachAction = async (
    action: () => Promise<void>,
    successMessage: string,
  ) => {
    setOutreachActionState("loading");
    setOutreachMessage(null);
    setOutreachError(null);
    try {
      await action();
      // Re-fetch the fresh status
      if (churchId && row.member.pco_id) {
        const all = await getOutreachStatuses(churchId);
        setOutreachStatus(all.find((s) => s.member_pco_id === row.member.pco_id) ?? null);
      }
      setOutreachMessage(successMessage);
      setOutreachActionState("success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Action failed. Try again.";
      setOutreachError(msg);
      setOutreachActionState("idle");
    }
  };

  const onMarkContacted = () => {
    if (!churchId || !row.member.pco_id) return;
    void handleOutreachAction(
      () => upsertOutreachStatus(churchId, row.member.pco_id!, {
        status: "contacted",
        contacted_at: new Date().toISOString(),
      }),
      "Marked as contacted.",
    );
  };

  const onSnooze = (days: number) => {
    if (!churchId || !row.member.pco_id) return;
    void handleOutreachAction(
      () => {
        const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
        return upsertOutreachStatus(churchId, row.member.pco_id!, {
          status: "snoozed",
          snoozed_until: until,
        });
      },
      `Snoozed for ${days} days.`,
    );
  };

  const attendanceTrend = useMemo(() => getAttendanceTrend(row.attendance_history), [row.attendance_history]);
  const attendanceBuckets = useMemo(
    () => buildAttendanceBuckets(row.attendance_history),
    [row.attendance_history],
  );

  const recentAttendance = row.attendance_history.slice(0, 6);
  const recommendedAction = row.risk.tier ? tierActionMap[row.risk.tier] : "No action available until scoring runs";
  const isVisitor = isVisitorFollowUpLifecycle(row.member.member_lifecycle);
  const visitorFollowUpDue = isVisitorFollowUpDue(row.member.member_lifecycle, visitorFollowUpAt);
  const lastFollowUpLabel = visitorFollowUpAt ? formatDate(visitorFollowUpAt) : "Not followed up";

  const onMarkVisitorFollowedUp = async () => {
    if (!row.member.pco_id) return;

    setVisitorFollowUpState("loading");
    setVisitorFollowUpMessage(null);
    setVisitorFollowUpError(null);

    try {
      const result = await markVisitorFollowedUp(row.member.pco_id);
      const followedUpDate = new Date(result.last_followup_at);
      setVisitorFollowUpAt(Number.isNaN(followedUpDate.getTime()) ? new Date() : followedUpDate);
      setVisitorFollowUpMessage("Last follow-up saved.");
      setVisitorFollowUpState("success");
      onVisitorFollowedUp?.(result.member_pco_id, result.last_followup_at);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not mark visitor followed up.";
      setVisitorFollowUpError(msg);
      setVisitorFollowUpState("idle");
    }
  };

  const onGenerate = async (type: OutreachType) => {
    setGenerating(type);
    setDraft(null);
    setDraftError(null);
    setCopied(false);
    setGmailStatus("idle");
    setGmailError(null);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);

    try {
      const accessToken = supabase
        ? (await supabase.auth.getSession()).data.session?.access_token
        : undefined;
      if (!accessToken) {
        setDraftError("Your session expired. Please sign in again.");
        return;
      }

      const response = await fetch("/api/outreach/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ member_pco_id: row.member.pco_id, church_id: churchId, type }),
        signal: controller.signal,
      });

      const result = (await response.json()) as {
        success: boolean;
        source?: "openrouter" | "fallback";
        model?: string | null;
        type?: OutreachType;
        subject?: string;
        body?: string;
        error?: string;
      };

      if (!result.success || !result.body) {
        setDraftError(result.error ?? "Failed to generate draft.");
      } else if (result.type === "email") {
        setDraft({ type: "email", subject: result.subject ?? "", body: result.body, source: result.source ?? "fallback", model: result.model ?? null });
      } else if (result.type === "sms") {
        setDraft({ type: "sms", body: result.body, source: result.source ?? "fallback", model: result.model ?? null });
      } else {
        setDraftError("Unexpected response type from server.");
      }
    } catch (err) {
      setDraftError(
        err instanceof Error && err.name === "AbortError"
          ? "Generation timed out. Please try again."
          : "Could not reach the generate service. Please try again.",
      );
    } finally {
      clearTimeout(timeout);
      setGenerating(null);
    }
  };

  const onCopy = async () => {
    if (!draft) return;
    const text =
      draft.type === "email" ? `Subject: ${draft.subject}\n\n${draft.body}` : draft.body;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — silent fail
    }
  };

  const onCreateGmailDraft = async () => {
    if (!draft || draft.type !== "email") return;
    setGmailStatus("creating");
    setGmailError(null);

    try {
      const accessToken = supabase
        ? (await supabase.auth.getSession()).data.session?.access_token
        : null;

      const response = await fetch("/api/gmail/create-draft", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          to: row.member.email,
          subject: draft.subject,
          body: draft.body,
        }),
      });

      const result = (await response.json()) as { success: boolean; error?: string };
      if (!result.success) {
        setGmailStatus("error");
        setGmailError(result.error ?? "Failed to create Gmail draft.");
      } else {
        setGmailStatus("success");
      }
    } catch {
      setGmailStatus("error");
      setGmailError("Could not reach the server. Please try again.");
    }
  };

  return (
    <motion.div
      key={row.member.id}
      layout
      initial={{ opacity: 0, x: 18 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
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
              <span className="rounded-full border border-border/80 bg-[#F3F5F4] px-2.5 py-1 text-xs font-medium text-foreground">
                {row.member.status}
              </span>
              {row.risk.tier ? (
                <RiskBadge tier={row.risk.tier} />
              ) : (
                <span className="rounded-full border border-border/80 bg-[#F3F5F4] px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                  No risk score available
                </span>
              )}
              <span className="rounded-full border border-border/80 bg-[#F3F5F4] px-2.5 py-1 text-xs font-semibold text-foreground">
                Risk {row.risk.score ?? "not scored"}
              </span>
              <span className="rounded-full border border-border/80 bg-[#F3F5F4] px-2.5 py-1 text-xs font-medium text-muted-foreground">
                Last attended {formatDate(row.last_attended)}
              </span>
              {isVisitor ? (
                <>
                  <span className="rounded-full border border-border/80 bg-[#F3F5F4] px-2.5 py-1 text-xs font-medium text-foreground">
                    {getVisitorLifecycleLabel(row.member.member_lifecycle)}
                  </span>
                  <span className="rounded-full border border-border/80 bg-[#F3F5F4] px-2.5 py-1 text-xs font-medium text-muted-foreground">
                    Last follow-up {lastFollowUpLabel}
                  </span>
                </>
              ) : null}
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <p className="shepherd-kicker">Risk Analysis</p>
          <CardTitle>{row.risk.tier ? `Why this member is in ${row.risk.tier}` : "No risk score available"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border/80 bg-[#F7F8F7] p-3">
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Risk score</p>
              <p className="mt-1 font-heading text-2xl font-semibold">{row.risk.score ?? "No score"}</p>
            </div>
            <div className="rounded-lg border border-border/80 bg-[#F7F8F7] p-3">
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Tier</p>
              <div className="mt-1">
                {row.risk.tier ? (
                  <RiskBadge tier={row.risk.tier} />
                ) : (
                  <span className="rounded-full border border-border/80 bg-[#FAFBFA] px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                    No risk score available
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-border/80 bg-[#FAFBFA] p-4">
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
            <p className="mt-2 text-muted-foreground">
              {row.risk.tier ? tierPlainEnglishMap[row.risk.tier] : missingRiskExplanation}
            </p>
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
            <div className="rounded-lg border border-border/80 bg-[#F7F8F7] p-3">
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Total attendance</p>
              <p className="mt-1 font-heading text-2xl font-semibold">{row.attendance_count}</p>
            </div>
            <div className="rounded-lg border border-border/80 bg-[#F7F8F7] p-3">
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Last attended</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{formatDate(row.last_attended)}</p>
            </div>
          </div>

          {row.attendance_history.length ? (
            <div className="rounded-lg border border-border/80 bg-card p-4">
              <div className="flex items-end gap-2">
                {attendanceBuckets.map((bucket) => (
                  <div key={bucket.label} className="flex flex-1 flex-col items-center gap-2">
                    <div className="flex h-24 w-full items-end rounded-md bg-[#F3F5F4] p-1">
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
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-[#FAFBFA] p-6 text-center">
              <p className="text-sm font-semibold text-foreground">No attendance history</p>
              <p className="mt-1 text-sm text-muted-foreground">Attendance records will appear here after sync.</p>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Recent attendance dates
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {recentAttendance.length ? (
                recentAttendance.map((date) => (
                  <span
                    key={date.toISOString()}
                    className="rounded-full border border-border/80 bg-[#F7F8F7] px-2.5 py-1 text-xs text-foreground"
                  >
                    {formatDate(date)}
                  </span>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">No attendance history</span>
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
            <div className="flex items-center justify-between rounded-lg border border-border/80 bg-[#FAFBFA] px-3 py-2">
              <span className="text-muted-foreground">Attendance count</span>
              <span className="font-semibold">{row.attendance_count}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/80 bg-[#FAFBFA] px-3 py-2">
              <span className="text-muted-foreground">Days since last attendance</span>
              <span className="font-semibold">{formatRelativeDays(row.days_since_last_attendance)}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/80 bg-[#FAFBFA] px-3 py-2">
              <span className="text-muted-foreground">Attendance trend</span>
              <span className="font-semibold">{attendanceTrend}</span>
            </div>
            {isVisitor ? (
              <div className="flex items-center justify-between rounded-lg border border-border/80 bg-[#FAFBFA] px-3 py-2">
                <span className="text-muted-foreground">Last Follow-Up</span>
                <span className="font-semibold">{lastFollowUpLabel}</span>
              </div>
            ) : null}
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
            <div className="rounded-lg border border-border/80 bg-[#FAFBFA] p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Operational note</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Coordinate outreach through the member’s ministry lead to preserve relationship continuity.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {canWriteOutreach ? (
      <Card>
        <CardHeader>
          <p className="shepherd-kicker">Outreach Actions</p>
          <CardTitle>Generate communication drafts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isVisitor && churchId && row.member.pco_id ? (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Visitor Follow-Up
                  </p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {getVisitorLifecycleLabel(row.member.member_lifecycle)} - Last Follow-Up {lastFollowUpLabel}
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => void onMarkVisitorFollowedUp()}
                  disabled={
                    visitorFollowUpState === "loading" ||
                    visitorFollowUpState === "success" ||
                    !visitorFollowUpDue
                  }
                  className="justify-start gap-1.5"
                >
                  <CheckCircle2 className="size-3.5" />
                  {visitorFollowUpState === "loading"
                    ? "Saving..."
                    : visitorFollowUpState === "success" || !visitorFollowUpDue
                      ? "Followed Up"
                      : "Mark Visitor Followed Up"}
                </Button>
              </div>
              {visitorFollowUpMessage ? (
                <p className="mt-2 text-xs font-medium text-primary">{visitorFollowUpMessage}</p>
              ) : null}
              {visitorFollowUpError ? (
                <p className="mt-2 text-xs text-red-600">{visitorFollowUpError}</p>
              ) : null}
            </div>
          ) : null}

          {/* Current outreach status badge */}
          {outreachStatus && outreachStatus.status !== "active" ? (
            <div className="rounded-lg border border-border/80 bg-[#FAFBFA] p-3 text-sm">
              {outreachStatus.status === "contacted" ? (
                <p className="inline-flex items-center gap-2 font-semibold text-primary">
                  <CheckCircle2 className="size-4" />
                  Contacted
                  {outreachStatus.contacted_at
                    ? ` on ${new Date(outreachStatus.contacted_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
                    : ""}
                </p>
              ) : outreachStatus.status === "snoozed" && outreachStatus.snoozed_until ? (
                <p className="inline-flex items-center gap-2 font-semibold text-muted-foreground">
                  <BellOff className="size-4" />
                  Snoozed until{" "}
                  {new Date(outreachStatus.snoozed_until).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              ) : null}
            </div>
          ) : null}

          {/* Mark Contacted / Snooze buttons */}
          {churchId && row.member.pco_id ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Outreach Status
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={onMarkContacted}
                  disabled={outreachActionState === "loading" || outreachStatus?.status === "contacted"}
                  className="justify-start gap-1.5"
                >
                  <CheckCircle2 className="size-3.5" />
                  {outreachActionState === "loading" ? "Saving..." : "Mark Contacted"}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onSnooze(7)}
                  disabled={outreachActionState === "loading"}
                  className="justify-start gap-1.5"
                >
                  <BellOff className="size-3.5" />
                  Snooze 7 Days
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onSnooze(30)}
                  disabled={outreachActionState === "loading"}
                  className="justify-start gap-1.5"
                >
                  <BellOff className="size-3.5" />
                  Snooze 30 Days
                </Button>
              </div>
              {outreachMessage ? (
                <p className="text-xs font-medium text-primary">{outreachMessage}</p>
              ) : null}
              {outreachError ? (
                <p className="text-xs text-red-600">{outreachError}</p>
              ) : null}
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              onClick={() => void onGenerate("email")}
              disabled={generating !== null}
              className="justify-start gap-2"
            >
              <Mail className="size-4" />
              {generating === "email" ? "Generating..." : "Generate Email"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => void onGenerate("sms")}
              disabled={generating !== null}
              className="justify-start gap-2"
            >
              <MessageSquare className="size-4" />
              {generating === "sms" ? "Generating..." : "Generate SMS"}
            </Button>
          </div>

          <div className="rounded-lg border border-border/80 bg-[#FAFBFA] p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                <Activity className="size-4 text-primary" />
                Draft preview
              </p>
              {draft ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void onCopy()}
                  className="gap-1.5"
                >
                  {copied ? (
                    <>
                      <Check className="size-3" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="size-3" />
                      Copy
                    </>
                  )}
                </Button>
              ) : null}
            </div>
            {generating ? (
              <p className="text-sm text-muted-foreground">Generating draft...</p>
            ) : draft ? (
              <div className="space-y-2">
                {draft.type === "email" && draft.subject ? (
                  <p className="text-sm font-semibold text-foreground">Subject: {draft.subject}</p>
                ) : null}
                <pre className="shepherd-scrollbar max-h-64 overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-sm leading-6 text-muted-foreground">
                  {draft.body}
                </pre>
                <p className="text-xs text-muted-foreground/70">
                  {draft.source === "openrouter"
                    ? `Generated by OpenRouter · Model: ${draft.model ?? "unknown"}`
                    : "Generated by Fallback Template"}
                </p>
                {draft.type === "email" ? (
                  <div className="space-y-2 pt-1">
                    {gmailConnected === false ? (
                      <p className="text-xs text-muted-foreground">
                        Connect Gmail in Settings first.
                      </p>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void onCreateGmailDraft()}
                        disabled={gmailConnected !== true || gmailStatus === "creating" || gmailStatus === "success"}
                        className="gap-1.5"
                      >
                        {gmailStatus === "creating" ? (
                          <>
                            <ClipboardList className="size-3" />
                            Creating draft...
                          </>
                        ) : gmailStatus === "success" ? (
                          <>
                            <Check className="size-3" />
                            Draft created in Gmail
                          </>
                        ) : (
                          <>
                            <ClipboardList className="size-3" />
                            Create Gmail Draft
                          </>
                        )}
                      </Button>
                    )}
                    {gmailStatus === "error" && gmailError ? (
                      <p className="text-xs text-red-600">{gmailError}</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Generate Email or SMS to preview outreach content.
              </p>
            )}
          </div>

          {draftError ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {draftError}
            </div>
          ) : null}
        </CardContent>
      </Card>
      ) : null}

    </motion.div>
  );
}
