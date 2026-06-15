"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { AlertTriangle, CalendarDays, CheckCircle2, Clock3, Loader2, RefreshCcw, Unplug, UserCircle2 } from "lucide-react";

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
  const { churchName, planningCenterConnection: connection, loading, user, syncStatus } = useAuth();
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
    <header className="sticky top-0 z-20 border-b border-border bg-white/88 px-5 py-4 backdrop-blur-xl md:px-8 lg:px-10">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between"
      >
        <div>
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_0_4px_rgba(0,107,85,0.10)]" />
            <p className="shepherd-kicker">{churchName ?? "Unknown Church"}</p>
          </div>
          <h1 className="mt-1 font-heading text-[1.65rem] font-semibold tracking-[-0.035em] text-foreground">
            {meta.title}
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{meta.subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm transition-colors ${
              loading
                ? "border-border/80 bg-card text-muted-foreground"
                : connected
                  ? "border-primary/18 bg-primary/7 text-primary"
                  : "border-border/80 bg-card text-muted-foreground"
            }`}
          >
            {loading ? (
              <Clock3 className="size-3.5 text-muted-foreground" />
            ) : connected ? (
              <CheckCircle2 className="size-3.5" />
            ) : (
              <Unplug className="size-3.5" />
            )}
            {loading ? "Loading…" : `Planning Center ${connectionStatusLabel}`}
          </span>
          {syncStatus !== "idle" ? (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm transition-colors ${
                syncStatus === "syncing"
                  ? "border-primary/18 bg-primary/7 text-primary"
                  : syncStatus === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {syncStatus === "syncing" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : syncStatus === "success" ? (
                <CheckCircle2 className="size-3.5" />
              ) : (
                <AlertTriangle className="size-3.5" />
              )}
              {syncStatus === "syncing" ? "Syncing…" : syncStatus === "success" ? "Synced" : "Sync failed"}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm">
            <RefreshCcw className="size-3.5 text-primary/70" />
            {lastSyncLabel}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm">
            <CalendarDays className="size-3.5 text-primary/70" />
            <span suppressHydrationWarning>{todayLabel}</span>
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card py-1 pl-1 pr-3 text-xs font-medium text-muted-foreground shadow-sm">
            <span className="flex size-6 items-center justify-center rounded-full bg-[#F3F5F4] text-primary">
              <UserCircle2 className="size-3.5" />
            </span>
            <span className="max-w-[160px] truncate">{user?.email ?? "Signed in"}</span>
          </span>
        </div>
      </motion.div>
    </header>
  );
}
