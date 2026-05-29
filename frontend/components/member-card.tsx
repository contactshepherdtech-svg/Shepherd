"use client";

import { motion } from "framer-motion";
import { CalendarClock, ChevronRight, Mail } from "lucide-react";

import { RiskBadge } from "@/components/risk-badge";
import { Button } from "@/components/ui/button";
import type { MemberDirectoryRow } from "@/lib/data";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type MemberCardProps = {
  row: MemberDirectoryRow;
  selected: boolean;
  onSelect: (memberId: string) => void;
};

export function MemberCard({ row, selected, onSelect }: MemberCardProps) {
  return (
    <motion.div
      whileHover={{ y: -1 }}
      className={cn(
        "rounded-xl border bg-card p-4 shadow-[0_5px_16px_rgba(11,95,74,0.07)] transition-colors",
        selected ? "border-primary/45" : "border-border/90",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-heading text-sm font-semibold text-foreground">{row.member.name}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{row.member.ministry}</p>
        </div>
        <span className="rounded-md bg-[#EDE4C4] px-2 py-1 text-xs font-semibold text-foreground">
          {row.risk.score ?? "No score"}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {row.risk.tier ? (
          <RiskBadge tier={row.risk.tier} />
        ) : (
          <span className="rounded-full border border-border/80 bg-[#F8F2DA] px-2.5 py-1 text-xs font-semibold text-muted-foreground">
            No risk score available
          </span>
        )}
        <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-[#F3ECD2] px-2.5 py-1 text-xs text-muted-foreground">
          <CalendarClock className="size-3.5" />
          {row.last_attended ? formatDate(row.last_attended) : "No attendance history"}
        </span>
      </div>

      <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
        <p>{row.member.status}</p>
        <p className="inline-flex items-center gap-1.5">
          <Mail className="size-3.5" />
          {row.member.email || "No email on file"}
        </p>
      </div>

      <Button
        variant={selected ? "default" : "secondary"}
        className="mt-3 w-full justify-between"
        onClick={() => onSelect(row.member.id)}
      >
        {selected ? "Viewing profile" : "Open profile"}
        <ChevronRight className="size-4" />
      </Button>
    </motion.div>
  );
}
