"use client";

import { motion } from "framer-motion";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ChurchHealthGaugeProps = {
  score: number;
};

export function ChurchHealthGauge({ score }: ChurchHealthGaugeProps) {
  const clamped = Math.min(100, Math.max(0, score));
  const radius = 56;
  const circumference = Math.PI * radius;
  const progress = (clamped / 100) * circumference;

  const healthLabel = clamped >= 75 ? "Healthy" : clamped >= 55 ? "Watch" : clamped >= 35 ? "At Risk" : "Critical";

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
          <div className="relative mx-auto mt-2 flex w-full max-w-[220px] items-center justify-center">
            <svg viewBox="0 0 160 100" className="h-[120px] w-full overflow-visible">
              <defs>
                <linearGradient id="healthGaugeGradient" x1="20" x2="140" y1="80" y2="80">
                  <stop offset="0%" stopColor="#006B55" />
                  <stop offset="78%" stopColor="#07866B" />
                  <stop offset="100%" stopColor="#FFD21F" />
                </linearGradient>
              </defs>
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
                stroke="url(#healthGaugeGradient)"
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
              <span className="mt-0.5 text-xs font-medium text-muted-foreground">{healthLabel}</span>
            </div>
          </div>
          <div className="mt-1 grid grid-cols-3 gap-2 text-center text-[11px] text-muted-foreground">
            <span>Critical</span>
            <span>Watch</span>
            <span>Healthy</span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
