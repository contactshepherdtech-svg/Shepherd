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
      layout
      whileHover={{ x: 2 }}
      whileTap={{ scale: 0.99 }}
      onClick={() => onSelect(row.member.id)}
      className={cn(
        "group cursor-pointer rounded-2xl border bg-card p-3 shadow-sm transition-all",
        selected
          ? "border-primary/32 bg-primary/[0.035] shadow-[0_12px_30px_rgba(0,107,85,0.10)]"
          : "border-border hover:border-primary/18 hover:bg-[var(--surface-2)] hover:shadow-[0_10px_24px_rgba(17,24,39,0.07)]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-heading text-sm font-semibold text-foreground">{row.member.name}</h3>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{row.member.email || row.member.ministry}</p>
        </div>
        <span className="rounded-lg bg-[#EFF3F1] px-2 py-1 text-xs font-semibold text-foreground">
          {row.risk.score ?? "No score"}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {row.risk.tier ? (
          <RiskBadge tier={row.risk.tier} />
        ) : (
          <span className="rounded-full border border-border/80 bg-[var(--surface-2)] px-2.5 py-1 text-xs font-semibold text-muted-foreground">
            No risk score available
          </span>
        )}
        <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-[#F7F8F7] px-2.5 py-1 text-xs text-muted-foreground">
          <CalendarClock className="size-3.5" />
          {row.last_attended ? formatDate(row.last_attended) : "No attendance history"}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <p className="truncate">{row.member.status}</p>
        <p className="inline-flex min-w-0 items-center gap-1.5">
          <Mail className="size-3.5 shrink-0" />
          <span className="truncate">{row.member.email || "No email on file"}</span>
        </p>
      </div>

      <Button
        variant={selected ? "default" : "secondary"}
        className="mt-3 w-full justify-between"
        onClick={(event) => {
          event.stopPropagation();
          onSelect(row.member.id);
        }}
      >
        {selected ? "Viewing profile" : "Open profile"}
        <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
      </Button>
    </motion.div>
  );
}
