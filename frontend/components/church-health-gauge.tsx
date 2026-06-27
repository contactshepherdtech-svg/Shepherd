"use client";

import { motion } from "framer-motion";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ChurchHealthGaugeProps = {
  score: number;
  scoredCount: number;
  totalCount: number;
  needsAttention: number; // At Risk + Critical among scored members
};

type Tier = "Healthy" | "Watch" | "At Risk" | "Critical";

// Arc + label color per tier — matches the RiskBadge severity heatmap so the
// gauge's color means the same thing as risk colors elsewhere (green→red).
const TIER_STYLE: Record<Tier, { stroke: string; text: string; why: string }> = {
  Healthy: { stroke: "#10b981", text: "text-emerald-700", why: "Most scored members are engaged and consistent." },
  Watch: { stroke: "#f59e0b", text: "text-amber-700", why: "Some members are starting to drift." },
  "At Risk": { stroke: "#f97316", text: "text-orange-700", why: "A meaningful share of members are disengaging." },
  Critical: { stroke: "#ef4444", text: "text-red-700", why: "Many members need urgent follow-up." },
};

function tierForScore(score: number): Tier {
  return score >= 75 ? "Healthy" : score >= 55 ? "Watch" : score >= 35 ? "At Risk" : "Critical";
}

export function ChurchHealthGauge({ score, scoredCount, totalCount, needsAttention }: ChurchHealthGaugeProps) {
  const clamped = Math.min(100, Math.max(0, score));
  const radius = 56;
  const circumference = Math.PI * radius;
  const progress = (clamped / 100) * circumference;
  const tier = tierForScore(clamped);
  const style = TIER_STYLE[tier];

  // Never show a confident score off ~nothing — a "30 / Critical" from 2 of 6
  // members is what makes the dashboard feel untrustworthy.
  const hasData = scoredCount > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.05 }}
      whileHover={{ y: -3 }}
      className="h-full"
    >
      <Card className="h-full overflow-hidden transition-all duration-200 hover:border-primary/12 hover:shadow-[0_18px_44px_rgba(17,24,39,0.10)]">
        <CardHeader className="pb-2">
          <p className="shepherd-kicker">Church Health</p>
          <CardTitle className="text-base">Overall engagement signal</CardTitle>
        </CardHeader>
        <CardContent>
          {!hasData ? (
            <div className="flex min-h-[150px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-[#FAFBFA] p-4 text-center">
              <p className="text-sm font-semibold text-foreground">Not enough data yet</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Risk scoring runs on established members once they&apos;ve built up attendance history — the signal appears after a sync covers them.
              </p>
            </div>
          ) : (
            <>
              <div className="relative mx-auto mt-2 flex w-full max-w-[220px] items-center justify-center">
                <svg viewBox="0 0 160 100" className="h-[120px] w-full overflow-visible">
                  <path
                    d="M 20 80 A 56 56 0 0 1 140 80"
                    fill="none"
                    stroke="rgba(17,24,39,0.08)"
                    strokeWidth="12"
                    strokeLinecap="round"
                  />
                  <motion.path
                    d="M 20 80 A 56 56 0 0 1 140 80"
                    fill="none"
                    stroke={style.stroke}
                    strokeWidth="12"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset: circumference - progress }}
                    transition={{ duration: 0.8, ease: "easeInOut" }}
                  />
                </svg>
                <div className="absolute top-10 flex flex-col items-center">
                  <span className="font-heading text-3xl font-semibold tracking-[-0.04em] text-foreground">{clamped}</span>
                  <span className={`mt-0.5 text-xs font-semibold ${style.text}`}>{tier}</span>
                </div>
              </div>
              <div className="mt-1 grid grid-cols-3 gap-2 text-center text-[11px] text-muted-foreground">
                <span>0 · Critical</span>
                <span>Watch</span>
                <span>Healthy · 100</span>
              </div>
              <p className="mt-2 text-center text-xs leading-5 text-muted-foreground">
                {style.why}
                {needsAttention > 0 ? ` ${needsAttention} of ${scoredCount} need attention.` : ""}
              </p>
              <p className="mt-1 text-center text-[11px] text-muted-foreground/80">
                Based on {scoredCount} of {totalCount} member{totalCount === 1 ? "" : "s"} scored
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
