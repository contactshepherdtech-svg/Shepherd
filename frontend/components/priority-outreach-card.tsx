"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, BellOff, CheckCircle2, Mail } from "lucide-react";

import { RiskBadge } from "@/components/risk-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { upsertOutreachStatus, type MemberDirectoryRow } from "@/lib/data";
import { formatDate } from "@/lib/format";

type PriorityOutreachCardProps = {
  row: MemberDirectoryRow;
  churchId: number;
  onStatusChange: () => void;
};

const recommendedActionByTier = {
  Healthy: "No action needed",
  Watch: "Friendly check-in",
  "At Risk": "Personal email or call",
  Critical: "Pastor follow-up",
} as const;

type ActionState = "idle" | "loading" | "success";

export function PriorityOutreachCard({ row, churchId, onStatusChange }: PriorityOutreachCardProps) {
  const [actionState, setActionState] = useState<ActionState>("idle");
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const recommendedAction = row.risk.tier ? recommendedActionByTier[row.risk.tier] : "No action available";
  const memberId = encodeURIComponent(row.member.pco_id || row.member.id);
  const memberProfileHref = `/members?member=${memberId}`;
  const draftEmailHref = `/members?member=${memberId}&action=email`;
  const memberPcoId = row.member.pco_id;
  const isLoading = actionState === "loading";

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

  return (
    <motion.div whileHover={{ y: -2 }} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Card>
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
          <div className="rounded-lg border border-border/80 bg-[#F8F2DA] p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Why now</p>
            {row.risk.reasons.length ? (
              <ul className="mt-1 space-y-1 text-sm text-foreground">
                {row.risk.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
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
          </div>

          <div>
            <Button variant="secondary" asChild className="justify-start gap-2">
              <Link href={draftEmailHref}>
                <Mail className="size-4" />
                Draft Email
              </Link>
            </Button>
          </div>

          {/* Outreach workflow actions */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Outreach Actions
            </p>
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
