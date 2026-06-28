"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  BellOff,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Copy,
  Mail,
  MessageSquare,
  Pencil,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react";

import { MemberAssign } from "@/components/member-assign";
import { OutreachStatusBadge } from "@/components/outreach-status-badge";
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
  setOutreachWorkflowStatus,
  getWorkflowStatus,
  OUTREACH_WORKFLOW_STATUSES,
  OUTREACH_WORKFLOW_LABELS,
  type MemberDirectoryRow,
  type OutreachStatusRecord,
  type OutreachWorkflowStatus,
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
  const [editing, setEditing] = useState(false);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
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

  const onChangeWorkflowStatus = (status: OutreachWorkflowStatus) => {
    if (!churchId || !row.member.pco_id) return;
    void handleOutreachAction(
      () => setOutreachWorkflowStatus(churchId, row.member.pco_id!, status),
      "Workflow status updated.",
    );
  };

  const attendanceTrend = useMemo(() => getAttendanceTrend(row.attendance_history), [row.attendance_history]);
  const attendanceBuckets = useMemo(
    () => buildAttendanceBuckets(row.attendance_history),
    [row.attendance_history],
  );

  // Line-graph geometry over the SAME 6 buckets (viewBox 0..100, baseline y=92, points
  // at column centers so they align with the labels below). preserveAspectRatio="none"
  // stretches to width; non-scaling-stroke keeps the line crisp. All-zero buckets give a
  // flat line at the baseline — reads as "no recent attendance", not broken.
  const attendanceLine = useMemo(() => {
    const n = attendanceBuckets.length;
    const max = Math.max(...attendanceBuckets.map((b) => b.count), 1);
    const pts = attendanceBuckets.map((b, i) => ({
      x: ((i + 0.5) / n) * 100,
      y: 92 - (b.count / max) * 84,
    }));
    const line = pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
    const area =
      `M ${pts[0].x.toFixed(2)},92 ` +
      pts.map((p) => `L ${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ") +
      ` L ${pts[n - 1].x.toFixed(2)},92 Z`;
    return { line, area };
  }, [attendanceBuckets]);

  const recentAttendance = row.attendance_history.slice(0, 6);
  const recommendedAction = row.risk.tier ? tierActionMap[row.risk.tier] : "No action available until scoring runs";
  const whyHeadline = row.risk.tier ? tierPlainEnglishMap[row.risk.tier] : missingRiskExplanation;
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

  // Manual draft editor (V1 — no AI). Opens with the generated subject/body and writes
  // edits back into the SAME `draft` state that onCreateGmailDraft + onCopy read, so a
  // saved edit is exactly what gets pushed to Gmail. No endpoint, no AI call.
  const openDraftEditor = () => {
    if (!draft) return;
    setEditSubject(draft.type === "email" ? draft.subject : "");
    setEditBody(draft.body);
    setEditing(true);
  };

  const onSaveDraftEdit = () => {
    setDraft((cur) =>
      !cur
        ? cur
        : cur.type === "email"
          ? { ...cur, subject: editSubject, body: editBody }
          : { ...cur, body: editBody },
    );
    // A prior Gmail push shouldn't block pushing the edited version.
    setGmailStatus("idle");
    setGmailError(null);
    setEditing(false);
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
      {/* Header — name, the plain-English "why" pulled up as the headline, then pills. */}
      <Card>
        <CardHeader className="pb-3">
          <p className="shepherd-kicker">Member 360</p>
          <CardTitle className="text-xl">{row.member.name}</CardTitle>
          <p className="mt-2 flex items-start gap-2 text-sm leading-6 text-foreground">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>{whyHeadline}</span>
          </p>
          <div className="mt-2 space-y-2 text-sm text-muted-foreground">
            <p className="inline-flex items-center gap-2">
              <Mail className="size-4" />
              {row.member.email || "No email on file"}
            </p>
            <MemberAssign
              memberDbId={row.member.db_id}
              memberName={row.member.name}
              churchId={churchId}
            />
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-border/80 bg-[#F3F5F4] px-2.5 py-1 text-xs font-medium text-foreground">
                {row.member.status}
              </span>
              <OutreachStatusBadge status={getWorkflowStatus(outreachStatus)} />
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

      {/* Two-pane workspace: WHO THEY ARE (left, scrolls) | WHAT YOU DO (right, sticky).
          On mobile the panes stack with ACTIONS FIRST via the order swap. */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* LEFT — analysis */}
        <div className="order-2 space-y-4 xl:order-1">
          {/* Merged Engagement card — score + tier + days-since + trend + sparkline. */}
          <Card>
            <CardHeader>
              <p className="shepherd-kicker">Engagement</p>
              <CardTitle>Engagement snapshot</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg border border-border/80 bg-[#F7F8F7] p-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Risk score</p>
                  <p className="mt-1 font-heading text-2xl font-semibold">{row.risk.score ?? "—"}</p>
                </div>
                <div className="rounded-lg border border-border/80 bg-[#F7F8F7] p-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Tier</p>
                  <div className="mt-1">
                    {row.risk.tier ? (
                      <RiskBadge tier={row.risk.tier} />
                    ) : (
                      <span className="text-sm text-muted-foreground">No score</span>
                    )}
                  </div>
                </div>
                <div className="rounded-lg border border-border/80 bg-[#F7F8F7] p-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Last attended</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {formatRelativeDays(row.days_since_last_attendance)}
                  </p>
                </div>
                <div className="rounded-lg border border-border/80 bg-[#F7F8F7] p-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Trend</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{attendanceTrend}</p>
                </div>
              </div>

              {row.attendance_history.length ? (
                <div className="rounded-lg border border-border/80 bg-card p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      Last 90 days
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {row.attendance_count} total · last {formatDate(row.last_attended)}
                    </p>
                  </div>
                  <svg
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    className="h-20 w-full text-primary"
                    aria-hidden="true"
                  >
                    <path d={attendanceLine.area} fill="currentColor" fillOpacity={0.1} />
                    <polyline
                      points={attendanceLine.line}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  </svg>
                  <div className="mt-2 flex">
                    {attendanceBuckets.map((bucket) => (
                      <span
                        key={bucket.label}
                        className="flex-1 text-center text-[11px] text-muted-foreground"
                      >
                        {bucket.label}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border bg-[var(--surface-2)] p-6 text-center">
                  <p className="text-sm font-semibold text-foreground">No attendance history</p>
                  <p className="mt-1 text-sm text-muted-foreground">Attendance records will appear here after sync.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Secondary — full reasons + attendance dates, collapsed by default. */}
          <details className="group rounded-2xl border border-border/70 bg-card">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-5 py-4 text-sm font-semibold text-foreground [&::-webkit-details-marker]:hidden">
              <span className="inline-flex items-center gap-2">
                <ClipboardList className="size-4 text-primary" />
                Risk reasons &amp; attendance history
              </span>
              <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <div className="space-y-3 border-t border-border/60 px-5 py-4">
              <div className="rounded-lg border border-border/80 bg-[var(--surface-2)] p-4">
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
            </div>
          </details>
        </div>

        {/* RIGHT — actions (sticky on desktop; first on mobile). */}
        <aside className="order-1 space-y-3 xl:order-2 xl:sticky xl:top-[96px] xl:self-start">
          {/* The one useful line from the old Recommended Action, next to the controls. */}
          <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 text-sm">
            <span className="inline-flex items-center gap-1.5 font-semibold text-primary">
              <ShieldAlert className="size-4" />
              Recommended next step:
            </span>{" "}
            <span className="text-foreground">{recommendedAction}</span>
          </div>

          {canWriteOutreach ? (
            <Card>
              <CardHeader>
                <p className="shepherd-kicker">Outreach Actions</p>
                <CardTitle>Generate communication drafts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
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
                  <div className="rounded-lg border border-border/80 bg-[var(--surface-2)] p-3 text-sm">
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

                {/* Mark Contacted / Snooze + workflow status */}
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
                    <div className="space-y-1.5 pt-1">
                      <label className="text-xs font-medium text-muted-foreground">Workflow status</label>
                      <select
                        className="h-9 w-full rounded-lg border border-border/90 bg-card px-2 text-sm text-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:outline-none disabled:opacity-50"
                        value={getWorkflowStatus(outreachStatus)}
                        disabled={outreachActionState === "loading"}
                        onChange={(e) => onChangeWorkflowStatus(e.target.value as OutreachWorkflowStatus)}
                      >
                        {OUTREACH_WORKFLOW_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {OUTREACH_WORKFLOW_LABELS[s]}
                          </option>
                        ))}
                      </select>
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

                <div className="rounded-lg border border-border/80 bg-[var(--surface-2)] p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                      <Activity className="size-4 text-primary" />
                      Draft preview
                    </p>
                    {draft ? (
                      <div className="flex items-center gap-1.5">
                        <Button size="sm" variant="secondary" onClick={openDraftEditor} className="gap-1.5">
                          <Pencil className="size-3" />
                          Edit
                        </Button>
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
                      </div>
                    ) : null}
                  </div>
                  {generating ? (
                    <p className="text-sm text-muted-foreground">Generating draft...</p>
                  ) : draft ? (
                    <div className="space-y-2">
                      <div
                        className="cursor-text space-y-2"
                        onDoubleClick={openDraftEditor}
                        title="Double-click to edit"
                      >
                        {draft.type === "email" && draft.subject ? (
                          <p className="text-sm font-semibold text-foreground">Subject: {draft.subject}</p>
                        ) : null}
                        <pre className="shepherd-scrollbar max-h-44 overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-sm leading-6 text-muted-foreground">
                          {draft.body}
                        </pre>
                        <p className="text-xs text-muted-foreground/70">
                          {draft.source === "openrouter"
                            ? `Generated by OpenRouter · Model: ${draft.model ?? "unknown"}`
                            : "Generated by Fallback Template"}
                        </p>
                      </div>
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

                {/* Manual draft editor — gated with the rest of outreach (admin/pastor). */}
                {editing && draft ? (
                  <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
                    onClick={() => setEditing(false)}
                  >
                    <div
                      className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl glass-overlay p-5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-foreground">
                          Edit {draft.type === "email" ? "email" : "SMS"} draft
                        </p>
                        <button
                          type="button"
                          onClick={() => setEditing(false)}
                          className="text-foreground/70 transition-colors hover:text-foreground"
                          aria-label="Close"
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                      <div className="mt-4 flex min-h-0 flex-1 flex-col gap-3">
                        {draft.type === "email" ? (
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                              Subject
                            </label>
                            <input
                              type="text"
                              className="h-9 w-full rounded-lg border border-border/90 bg-card px-2 text-sm text-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:outline-none"
                              value={editSubject}
                              onChange={(e) => setEditSubject(e.target.value)}
                            />
                          </div>
                        ) : null}
                        <div className="flex min-h-0 flex-1 flex-col space-y-1.5">
                          <label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                            Body
                          </label>
                          <textarea
                            className="min-h-[220px] flex-1 resize-y rounded-lg border border-border/90 bg-card px-3 py-2 text-sm leading-6 text-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:outline-none"
                            value={editBody}
                            onChange={(e) => setEditBody(e.target.value)}
                            autoFocus
                          />
                        </div>
                      </div>
                      <div className="mt-4 flex justify-end gap-2">
                        <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
                          Cancel
                        </Button>
                        <Button type="button" onClick={onSaveDraftEdit}>
                          Save
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </aside>
      </div>
    </motion.div>
  );
}
