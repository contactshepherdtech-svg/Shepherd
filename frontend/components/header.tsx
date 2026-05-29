"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { CalendarDays, CheckCircle2, Clock3, Unplug } from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import { isPlanningCenterConnected } from "@/lib/data";

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function formatDeterministicDateTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Not synced yet";
  }

  const month = MONTH_LABELS[parsed.getUTCMonth()];
  const day = parsed.getUTCDate();
  const hours = parsed.getUTCHours();
  const minutes = String(parsed.getUTCMinutes()).padStart(2, "0");
  const period = hours >= 12 ? "PM" : "AM";
  const twelveHour = hours % 12 || 12;

  return `${month} ${day}, ${twelveHour}:${minutes} ${period}`;
}

function formatDeterministicDay(value: Date): string {
  const weekday = WEEKDAY_LABELS[value.getUTCDay()];
  const month = MONTH_LABELS[value.getUTCMonth()];
  const day = value.getUTCDate();
  return `${weekday}, ${month} ${day}`;
}

const routeMeta: Record<string, { title: string; subtitle: string }> = {
  "/dashboard": {
    title: "Operations Dashboard",
    subtitle: "Church health, attendance momentum, and member engagement priorities.",
  },
  "/members": {
    title: "Members",
    subtitle: "Search the congregation and work each member through a complete 360 profile.",
  },
  "/priority": {
    title: "Priority Outreach",
    subtitle: "Operational queue for members who need immediate personal follow-up.",
  },
  "/settings": {
    title: "Settings",
    subtitle: "Connection status, sync visibility, and church operational defaults.",
  },
};

export function Header() {
  const pathname = usePathname();
  const meta = routeMeta[pathname] ?? routeMeta["/dashboard"];
  const { churchName, planningCenterConnection: connection, loading } = useAuth();
  const [todayLabel, setTodayLabel] = useState("—");

  useEffect(() => {
    setTodayLabel(formatDeterministicDay(new Date()));
  }, []);

  const lastSyncLabel = useMemo(() => {
    if (!connection?.last_sync_at) {
      return "Not synced yet";
    }

    return formatDeterministicDateTime(connection.last_sync_at);
  }, [connection?.last_sync_at]);

  const connected = isPlanningCenterConnected(connection);
  const rawConnectionStatus = connection?.connection_status?.trim();
  const connectionStatusLabel = rawConnectionStatus
    ? rawConnectionStatus.charAt(0).toUpperCase() + rawConnectionStatus.slice(1)
    : "Not connected";

  return (
    <header className="border-b border-border/70 bg-background/95 px-6 py-5 backdrop-blur md:px-8">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32 }}
        className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between"
      >
        <div>
          <p className="shepherd-kicker">{churchName ?? "Unknown Church"}</p>
          <h1 className="mt-1 font-heading text-2xl font-semibold text-foreground">{meta.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{meta.subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/90 bg-card px-3 py-1.5 text-xs font-medium text-foreground">
            {loading ? (
              <Clock3 className="size-3.5 text-primary" />
            ) : connected ? (
              <CheckCircle2 className="size-3.5 text-primary" />
            ) : (
              <Unplug className="size-3.5 text-primary" />
            )}
            {loading
              ? "Loading data..."
              : `Planning Center ${connectionStatusLabel}`}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/90 bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground">
            <Clock3 className="size-3.5 text-primary" />
            Last Sync {lastSyncLabel}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/90 bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground">
            <CalendarDays className="size-3.5 text-primary" />
            <span suppressHydrationWarning>{todayLabel}</span>
          </span>
        </div>
      </motion.div>
    </header>
  );
}
