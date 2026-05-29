import type { ComponentType } from "react";

import { AlertTriangle, ShieldCheck, ShieldAlert, Siren } from "lucide-react";

import type { RiskTier } from "@/lib/data";
import { cn } from "@/lib/utils";

const styleByTier: Record<
  RiskTier,
  { icon: ComponentType<{ className?: string }>; className: string }
> = {
  Healthy: {
    icon: ShieldCheck,
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  Watch: {
    icon: AlertTriangle,
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  "At Risk": {
    icon: ShieldAlert,
    className: "border-orange-200 bg-orange-50 text-orange-700",
  },
  Critical: {
    icon: Siren,
    className: "border-red-200 bg-red-50 text-red-700",
  },
};

type RiskBadgeProps = {
  tier: RiskTier;
  className?: string;
};

export function RiskBadge({ tier, className }: RiskBadgeProps) {
  const style = styleByTier[tier];
  const Icon = style.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
        style.className,
        className,
      )}
    >
      <Icon className="size-3.5" />
      {tier}
    </span>
  );
}
