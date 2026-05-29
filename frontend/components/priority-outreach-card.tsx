"use client";

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

export function PriorityOutreachCard({ row }: PriorityOutreachCardProps) {
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
            <RiskBadge tier={row.risk.tier} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-border/80 bg-[#F8F2DA] p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Why now</p>
            <p className="mt-1 text-sm text-foreground">{row.risk.reasons[0] || "No risk context available yet."}</p>
          </div>

          <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            <p>
              <span className="font-medium text-foreground">Risk Score:</span> {row.risk.score}
            </p>
            <p>
              <span className="font-medium text-foreground">Last Attended:</span> {formatDate(row.last_attended)}
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

          <Button className="w-full justify-between">
            Open Member 360
            <ArrowRight className="size-4" />
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}
