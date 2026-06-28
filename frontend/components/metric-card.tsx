"use client";

import { useEffect, useMemo, useState } from "react";
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
  className?: string;
};

const toneStyles = {
  evergreen: "text-primary bg-primary/10 border-primary/20",
  gold: "text-amber-700 bg-[#FFF8D6] border-amber-200",
  critical: "text-red-700 bg-red-100 border-red-200",
  neutral: "text-[#374151] bg-[#F3F4F6] border-[#E5E7EB]",
};

function AnimatedMetricValue({ value }: { value: string | number }) {
  const numeric = useMemo(() => {
    if (typeof value === "number") return { amount: value, suffix: "" };
    const match = value.match(/^([+-]?\d+)(.*)$/);
    if (!match) return null;
    return { amount: Number(match[1]), suffix: match[2] ?? "" };
  }, [value]);
  const [displayValue, setDisplayValue] = useState(numeric?.amount ?? value);

  useEffect(() => {
    if (!numeric) {
      setDisplayValue(value);
      return;
    }

    const duration = 520;
    const startTime = performance.now();
    const startValue = 0;
    let frame = 0;

    const animate = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startValue + (numeric.amount - startValue) * eased);
      setDisplayValue(current);
      if (progress < 1) frame = requestAnimationFrame(animate);
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [numeric, value]);

  return (
    <>
      {numeric ? `${displayValue}${numeric.suffix}` : displayValue}
    </>
  );
}

export function MetricCard({
  label,
  value,
  supporting,
  icon: Icon,
  tone = "neutral",
  className,
}: MetricCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      whileHover={{ y: -3 }}
      className="h-full"
    >
      <Card
        className={cn(
          "h-full transition-all duration-200 hover:border-primary/12 hover:shadow-[0_18px_44px_rgba(17,24,39,0.10)]",
          className,
        )}
      >
        <CardHeader className="flex-row items-center justify-between pb-3">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <span className={cn("rounded-lg border p-2", toneStyles[tone])}>
            <Icon className="size-4" />
          </span>
        </CardHeader>
        <CardContent>
          <p className="font-heading text-3xl font-semibold tracking-[-0.04em] text-foreground">
            <AnimatedMetricValue value={value} />
          </p>
          <p className="mt-2 text-sm text-muted-foreground">{supporting}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
