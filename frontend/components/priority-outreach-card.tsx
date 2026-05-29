"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Mail, PhoneCall } from "lucide-react";

import { RiskBadge } from "@/components/risk-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MemberDirectoryRow } from "@/lib/data";
import { formatDate } from "@/lib/format";

type PriorityOutreachCardProps = {
  row: MemberDirectoryRow;
};

const recommendedActionByTier = {
  Healthy: "No action needed",
  Watch: "Friendly check-in",
  "At Risk": "Personal email or call",
  Critical: "Pastor follow-up",
} as const;

export function PriorityOutreachCard({ row }: PriorityOutreachCardProps) {
  const recommendedAction = row.risk.tier ? recommendedActionByTier[row.risk.tier] : "No action available";
  const memberProfileHref = `/members?member=${encodeURIComponent(row.member.pco_id || row.member.id)}`;

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

          <div className="grid gap-2 sm:grid-cols-2">
            <Button variant="secondary" className="justify-start gap-2">
              <Mail className="size-4" />
              Draft Email
            </Button>
            <Button variant="secondary" className="justify-start gap-2">
              <PhoneCall className="size-4" />
              Schedule Call
            </Button>
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
