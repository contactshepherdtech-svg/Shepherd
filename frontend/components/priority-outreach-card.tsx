"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, BellOff, CheckCircle2, Clock3, Mail, Sparkles } from "lucide-react";

import { RiskBadge } from "@/components/risk-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  createVisitorFollowUpDraft,
  getFirstVisitFollowUpState,
  getFirstVisitFollowUpUnlocksAt,
  getVisitorLifecycleLabel,
  isVisitorFollowUpDue,
  isVisitorFollowUpLifecycle,
  markVisitorFollowedUp,
  upsertOutreachStatus,
  type MemberDirectoryRow,
  type OutreachStatusRecord,
} from "@/lib/data";
import { formatDate } from "@/lib/format";

type PriorityOutreachCardProps = {
  row: MemberDirectoryRow;
  churchId: number;
  gmailConnected: boolean;
  outreachStatus: OutreachStatusRecord | null;
  onStatusChange: () => void;
  onVisitorFollowedUp?: (memberPcoId: string, followedUpAt: string) => void;
};

const recommendedActionByTier = {
  Healthy: "No action needed",
  Watch: "Friendly check-in",
  "At Risk": "Personal email or call",
  Critical: "Pastor follow-up",
} as const;

type ActionState = "idle" | "loading" | "success";

export function PriorityOutreachCard({
  row,
  churchId,
  gmailConnected,
  outreachStatus,
  onStatusChange,
  onVisitorFollowedUp,
}: PriorityOutreachCardProps) {
  const [actionState, setActionState] = useState<ActionState>("idle");
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [visitorFollowUpState, setVisitorFollowUpState] = useState<ActionState>("idle");
  const [visitorFollowUpMessage, setVisitorFollowUpMessage] = useState<string | null>(null);
  const [visitorFollowUpError, setVisitorFollowUpError] = useState<string | null>(null);
  const [draftState, setDraftState] = useState<ActionState>("idle");
  const [draftError, setDraftError] = useState<string | null>(null);

  const isVisitor = isVisitorFollowUpLifecycle(row.member.member_lifecycle);
  const visitorFollowUpDue = isVisitorFollowUpDue(row.member.member_lifecycle, row.member.last_followup_at);
  const recommendedAction = isVisitor
    ? "Personal visitor follow-up"
    : row.risk.tier
      ? recommendedActionByTier[row.risk.tier]
      : "No action available";
  const memberId = encodeURIComponent(row.member.pco_id || row.member.id);
  const memberProfileHref = `/members?member=${memberId}`;
  const draftEmailHref = `/members?member=${memberId}&action=email`;
  const memberPcoId = row.member.pco_id;
  const isLoading = actionState === "loading";
  const isVisitorFollowUpLoading = visitorFollowUpState === "loading";

  // First-time visitor follow-up: 24h hold → due → draft created.
  const firstVisitState = getFirstVisitFollowUpState(row.member, outreachStatus);
  const unlocksAt = getFirstVisitFollowUpUnlocksAt(row.member.first_visit_date);
  const isDraftLoading = draftState === "loading";
  const draftAlreadyCreated = firstVisitState === "draft_created" || draftState === "success";
  const unlocksLabel = (() => {
    if (!unlocksAt) return "soon";
    const ms = unlocksAt.getTime() - Date.now();
    if (ms <= 0) return "now";
    const hours = Math.ceil(ms / (60 * 60 * 1000));
    return `in ~${hours}h`;
  })();

  const handleAction = async (
    action: () => Promise<void>,
    successMessage: string,
  ) => {
    if (!memberPcoId) return;
    setActionState("loading");
    setActionError(null);
    setActionMessage(null);

    try {
      await action();
      setActionMessage(successMessage);
      setActionState("success");
      // Let the success message show briefly before parent re-filters
      setTimeout(() => {
        onStatusChange();
      }, 900);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Action failed. Please try again.";
      setActionError(msg);
      setActionState("idle");
    }
  };

  const onMarkContacted = () =>
    handleAction(
      () =>
        upsertOutreachStatus(churchId, memberPcoId!, {
          status: "contacted",
          contacted_at: new Date().toISOString(),
        }),
      "Marked as contacted.",
    );

  const onSnooze = (days: number) =>
    handleAction(
      () => {
        const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
        return upsertOutreachStatus(churchId, memberPcoId!, {
          status: "snoozed",
          snoozed_until: until,
        });
      },
      `Snoozed for ${days} days.`,
    );

  const onGenerateFollowUpDraft = async () => {
    if (!memberPcoId) return;
    setDraftState("loading");
    setDraftError(null);

    try {
      await createVisitorFollowUpDraft({ memberPcoId, to: row.member.email });
      setDraftState("success");
      // Refresh statuses so the card reflects the persisted "Draft Created".
      setTimeout(() => onStatusChange(), 900);
    } catch (err) {
      setDraftError(err instanceof Error ? err.message : "Could not create the follow-up draft.");
      setDraftState("idle");
    }
  };

  const onMarkVisitorFollowedUp = async () => {
    if (!memberPcoId) return;

    setVisitorFollowUpState("loading");
    setVisitorFollowUpMessage(null);
    setVisitorFollowUpError(null);

    try {
      const result = await markVisitorFollowedUp(memberPcoId);
      setVisitorFollowUpMessage("Visitor follow-up saved.");
      setVisitorFollowUpState("success");
      onVisitorFollowedUp?.(result.member_pco_id, result.last_followup_at);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not mark visitor followed up.";
      setVisitorFollowUpError(msg);
      setVisitorFollowUpState("idle");
    }
  };

  return (
    <motion.div
      layout
      whileHover={{ y: -3 }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card className="relative overflow-hidden transition-all duration-200 hover:border-primary/16 hover:shadow-[0_18px_44px_rgba(17,24,39,0.10)]">
        <div className="absolute inset-y-0 left-0 w-1 bg-primary" />
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="shepherd-kicker">Priority Outreach</p>
              <CardTitle>{row.member.name}</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">{row.member.email || "No email on file"}</p>
            </div>
            {row.risk.tier ? <RiskBadge tier={row.risk.tier} /> : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border border-border bg-[#FAFBFA] p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Why now</p>
            {row.risk.reasons.length ? (
              <ul className="mt-1 space-y-1 text-sm text-foreground">
                {row.risk.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            ) : isVisitor ? (
              <p className="mt-1 text-sm text-foreground">
                {getVisitorLifecycleLabel(row.member.member_lifecycle)} awaiting personal follow-up.
              </p>
            ) : (
              <p className="mt-1 text-sm text-foreground">No risk context available yet.</p>
            )}
          </div>

          <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            <p>
              <span className="font-medium text-foreground">Risk Score:</span> {row.risk.score ?? "No score"}
            </p>
            <p>
              <span className="font-medium text-foreground">Last Attended:</span> {formatDate(row.last_attended)}
            </p>
            <p>
              <span className="font-medium text-foreground">Recommended:</span> {recommendedAction}
            </p>
            {isVisitor ? (
              <>
                <p>
                  <span className="font-medium text-foreground">Visitor Status:</span>{" "}
                  {getVisitorLifecycleLabel(row.member.member_lifecycle)}
                </p>
                <p>
                  <span className="font-medium text-foreground">Last Follow-Up:</span>{" "}
                  {row.member.last_followup_at ? formatDate(row.member.last_followup_at) : "Not followed up"}
                </p>
              </>
            ) : null}
          </div>

          <div>
            <Button variant="secondary" asChild className="justify-start gap-2">
              <Link href={draftEmailHref}>
                <Mail className="size-4" />
                AI Draft Email
              </Link>
            </Button>
          </div>

          {/* First-time visitor follow-up */}
          {firstVisitState ? (
            <div className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                  First-visit follow-up
                </p>
                {firstVisitState === "holding" ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                    <Clock3 className="size-3.5" />
                    Unlocks {unlocksLabel}
                  </span>
                ) : null}
              </div>

              {draftAlreadyCreated ? (
                <p className="inline-flex items-center gap-1.5 text-sm text-foreground">
                  <CheckCircle2 className="size-4 text-primary" />
                  Draft created — review in Gmail before sending.
                </p>
              ) : firstVisitState === "holding" ? (
                <p className="text-sm text-muted-foreground">
                  Held for 24h after their first visit — the follow-up draft unlocks {unlocksLabel}.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  First visit{" "}
                  {row.member.first_visit_date ? `was ${formatDate(row.member.first_visit_date)}` : "recorded"} —
                  ready for a personal follow-up.
                </p>
              )}

              <Button
                size="sm"
                onClick={() => void onGenerateFollowUpDraft()}
                disabled={
                  firstVisitState !== "due_now" ||
                  draftAlreadyCreated ||
                  !gmailConnected ||
                  !memberPcoId ||
                  !row.member.email ||
                  isDraftLoading
                }
                className="w-full justify-start gap-1.5"
              >
                <Sparkles className="size-3.5" />
                {isDraftLoading
                  ? "Creating draft…"
                  : draftAlreadyCreated
                    ? "Draft Created"
                    : "Generate Follow-up Draft"}
              </Button>

              {!gmailConnected ? (
                <p className="text-xs text-muted-foreground">
                  Gmail isn&apos;t connected for this workspace — connect it in Settings to create drafts.
                </p>
              ) : !row.member.email ? (
                <p className="text-xs text-muted-foreground">No email on file for this visitor.</p>
              ) : null}
              {draftError ? <p className="text-xs text-red-600">{draftError}</p> : null}
            </div>
          ) : null}

          {/* Outreach workflow actions */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Outreach Actions
            </p>
            {isVisitor ? (
              <div className="space-y-2">
                <Button
                  size="sm"
                  onClick={() => void onMarkVisitorFollowedUp()}
                  disabled={
                    isVisitorFollowUpLoading ||
                    visitorFollowUpState === "success" ||
                    !visitorFollowUpDue ||
                    !memberPcoId
                  }
                  className="w-full justify-start gap-1.5"
                >
                  <CheckCircle2 className="size-3.5" />
                  {isVisitorFollowUpLoading
                    ? "Saving..."
                    : visitorFollowUpState === "success" || !visitorFollowUpDue
                      ? "Followed Up"
                      : "Mark Visitor Followed Up"}
                </Button>
                {visitorFollowUpMessage ? (
                  <p className="text-xs font-medium text-primary">{visitorFollowUpMessage}</p>
                ) : null}
                {visitorFollowUpError ? (
                  <p className="text-xs text-red-600">{visitorFollowUpError}</p>
                ) : null}
              </div>
            ) : null}
            <div className="grid gap-2 sm:grid-cols-3">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void onMarkContacted()}
                disabled={isLoading || actionState === "success" || !memberPcoId}
                className="justify-start gap-1.5"
              >
                <CheckCircle2 className="size-3.5" />
                {isLoading ? "Saving..." : "Mark Contacted"}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void onSnooze(7)}
                disabled={isLoading || actionState === "success" || !memberPcoId}
                className="justify-start gap-1.5"
              >
                <BellOff className="size-3.5" />
                Snooze 7 Days
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void onSnooze(30)}
                disabled={isLoading || actionState === "success" || !memberPcoId}
                className="justify-start gap-1.5"
              >
                <BellOff className="size-3.5" />
                Snooze 30 Days
              </Button>
            </div>

            {actionMessage ? (
              <p className="text-xs font-medium text-primary">{actionMessage}</p>
            ) : null}
            {actionError ? (
              <p className="text-xs text-red-600">{actionError}</p>
            ) : null}
          </div>

          <Button asChild className="w-full justify-between">
            <Link href={memberProfileHref}>
              Open Member 360
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}
