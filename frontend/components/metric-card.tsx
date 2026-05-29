"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type MetricCardProps = {
  label: string;
  value: string | number;
  supporting: string;
  icon: LucideIcon;
  tone?: "evergreen" | "gold" | "critical" | "neutral";
};

const toneStyles = {
  evergreen: "text-primary bg-primary/10 border-primary/20",
  gold: "text-amber-700 bg-amber-100 border-amber-200",
  critical: "text-red-700 bg-red-100 border-red-200",
  neutral: "text-[#37584C] bg-[#E8E0C0] border-[#D7CAA2]",
};

export function MetricCard({
  label,
  value,
  supporting,
  icon: Icon,
  tone = "neutral",
}: MetricCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      whileHover={{ y: -2 }}
      className="h-full"
    >
      <Card className="h-full">
        <CardHeader className="flex-row items-center justify-between pb-3">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <span className={cn("rounded-lg border p-2", toneStyles[tone])}>
            <Icon className="size-4" />
          </span>
        </CardHeader>
        <CardContent>
          <p className="font-heading text-3xl font-semibold tracking-tight text-foreground">{value}</p>
          <p className="mt-2 text-sm text-muted-foreground">{supporting}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
