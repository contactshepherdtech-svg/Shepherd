"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";
import {
  Gauge,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Siren,
  Sparkles,
  Users,
} from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/ask", label: "Ask", icon: Sparkles },
  { href: "/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/members", label: "Members", icon: Users },
  { href: "/priority", label: "Priority", icon: Siren },
  { href: "/settings", label: "Settings", icon: Settings },
];

const COLLAPSE_STORAGE_KEY = "shepherd-sidebar-collapsed";
const EXPANDED_WIDTH = 240;
const COMPACT_WIDTH = 84;

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { churchName, user, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const { scrollY } = useScroll();
  const compactness = useSpring(useTransform(scrollY, [0, 240], [0, 1], { clamp: true }), {
    stiffness: 180,
    damping: 30,
    mass: 0.32,
  });
  const sidebarWidth = useMotionValue(EXPANDED_WIDTH);
  const sidePadding = useTransform(compactness, [0, 1], [12, 10]);
  const brandHeight = useTransform(compactness, (value) =>
    collapsed ? 90 - value * 8 : 136 - value * 42,
  );
  const logoScale = useTransform(compactness, (value) =>
    collapsed ? 0.84 : 1 - value * 0.72,
  );
  const logoX = useTransform(compactness, (value) => (collapsed ? -5 : -12 + value * 8));
  const logoY = useTransform(compactness, [0, 1], [0, -6]);
  const navItemHeight = useTransform(compactness, [0, 1], [44, 40]);
  const labelScale = useTransform(compactness, [0, 0.7, 1], [1, 0.98, 0.92]);
  const labelOpacity = useTransform(compactness, [0, 0.55, 0.86], [1, 0.45, 0]);
  const labelWidth = useTransform(compactness, [0, 0.72, 1], [150, 62, 0]);
  const iconOffset = useTransform(compactness, [0, 1], [0, 10]);
  const headerActionOpacity = useTransform(compactness, [0, 0.55, 0.8], [1, 0.25, 0]);
  const workspaceScale = useTransform(compactness, [0, 1], [1, 0.92]);

  useMotionValueEvent(compactness, "change", (latest) => {
    const topWidth = collapsed ? COMPACT_WIDTH : EXPANDED_WIDTH;
    sidebarWidth.set(topWidth + (COMPACT_WIDTH - topWidth) * latest);
  });

  useEffect(() => {
    const stored = window.localStorage.getItem(COLLAPSE_STORAGE_KEY);
    if (stored) setCollapsed(stored === "true");
  }, []);

  useEffect(() => {
    const latest = compactness.get();
    const topWidth = collapsed ? COMPACT_WIDTH : EXPANDED_WIDTH;
    const controls = animate(sidebarWidth, topWidth + (COMPACT_WIDTH - topWidth) * latest, {
      type: "spring",
      stiffness: 420,
      damping: 40,
      mass: 0.8,
    });

    return () => controls.stop();
  }, [collapsed, compactness, sidebarWidth]);

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(COLLAPSE_STORAGE_KEY, String(next));
      return next;
    });
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace("/login");
  };

  return (
    <motion.aside
      layout
      initial={false}
      style={{ width: sidebarWidth, willChange: "width" }}
      className="sticky left-0 top-0 z-30 hidden h-screen shrink-0 overflow-hidden border-r border-white/12 bg-sidebar text-sidebar-foreground shadow-[24px_0_55px_rgba(0,0,0,0.14)] backdrop-blur-xl lg:flex lg:flex-col"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_44%_0%,rgba(255,210,31,0.18),transparent_36%),linear-gradient(180deg,rgba(255,255,255,0.10),rgba(255,255,255,0.025)_36%,transparent_76%)]" />
      <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-white/22 via-white/10 to-transparent" />

      <motion.div
        className="relative flex h-full flex-col py-4"
        style={{ paddingLeft: sidePadding, paddingRight: sidePadding }}
      >
        <motion.div
          style={{ minHeight: brandHeight }}
          className="flex flex-col items-stretch"
        >
          <div className="flex items-start justify-between">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 4 }}
              animate={{ opacity: 1, y: [0, -2, 0] }}
              whileHover={{ y: -2 }}
              transition={{
                opacity: { duration: 0.28 },
                y: { duration: 5.5, repeat: Infinity, ease: "easeInOut" },
              }}
              style={{
                scale: logoScale,
                x: logoX,
                y: logoY,
                transformOrigin: collapsed ? "center center" : "left center",
              }}
              className={cn(
                "relative shrink-0 rounded-[28px]",
                collapsed ? "size-[54px]" : "h-[120px] w-[220px]",
              )}
            >
              <div className="absolute inset-1 rounded-[22px] bg-[#FFD21F]/15 blur-xl" />
              <Image
                src="/shepherd-logo.png"
                alt="Shepherd"
                width={440}
                height={293}
                className="relative h-full w-full object-contain drop-shadow-[0_14px_24px_rgba(0,0,0,0.26)]"
                priority
              />
            </motion.div>

            {!collapsed ? (
              <motion.button
                type="button"
                onClick={toggleCollapsed}
                whileHover={{ scale: 1.04, backgroundColor: "rgba(255,255,255,0.12)" }}
                whileTap={{ scale: 0.96 }}
                style={{ opacity: headerActionOpacity, pointerEvents: collapsed ? "none" : "auto" }}
                className="rounded-xl border border-white/10 p-2 text-white/70 transition-colors hover:text-white"
                aria-label="Collapse sidebar"
              >
                <PanelLeftClose className="size-4" />
              </motion.button>
            ) : null}
          </div>

          {!collapsed ? (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                scale: labelScale,
                opacity: labelOpacity,
                maxWidth: labelWidth,
                transformOrigin: "left center",
              }}
              className="-mt-1 min-w-0 overflow-hidden px-1"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#FFD21F]/90">
                Workspace
              </p>
              <p className="mt-1 truncate text-[15px] font-semibold tracking-[-0.01em] text-white">
                {churchName ?? "Loading workspace"}
              </p>
            </motion.div>
          ) : (
            <button
              type="button"
              onClick={toggleCollapsed}
              className="mt-4 rounded-xl border border-white/10 p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Expand sidebar"
            >
              <PanelLeftOpen className="size-4" />
            </button>
          )}
        </motion.div>

        <nav className="flex-1 space-y-1 py-1.5">
          {navItems.map(({ href, label, icon: Icon }, index) => {
            const active = pathname === href;

            return (
              <motion.div
                key={href}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.28, delay: index * 0.035 }}
              >
                <Link href={href} prefetch className="block" title={collapsed ? label : undefined}>
                  <motion.div
                    whileHover="hover"
                    whileTap={{ scale: 0.98 }}
                    style={{ height: navItemHeight }}
                    className={cn(
                      "group relative flex items-center rounded-2xl border text-sm transition-colors duration-200",
                      collapsed ? "justify-center px-0" : "gap-3 px-3",
                      active
                        ? "border-white/14 text-white shadow-[0_10px_26px_rgba(0,0,0,0.12)]"
                        : "border-transparent text-white/72 hover:bg-white/[0.075] hover:text-white",
                    )}
                  >
                    {active ? (
                      <motion.span
                        layoutId="active-sidebar-pill"
                        className="absolute inset-0 rounded-2xl bg-white/[0.115] ring-1 ring-white/13"
                        transition={{ type: "spring", stiffness: 470, damping: 38 }}
                      />
                    ) : null}
                    {active ? (
                      <motion.span
                        layoutId="active-sidebar-indicator"
                        className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-[#FFD21F] shadow-[0_0_18px_rgba(255,210,31,0.42)]"
                        transition={{ type: "spring", stiffness: 470, damping: 38 }}
                      />
                    ) : null}
                    <motion.span
                      className="relative z-10 flex shrink-0 items-center justify-center text-current"
                      style={{ x: collapsed ? 0 : iconOffset }}
                      variants={{
                        hover: {
                          scale: active ? 1.04 : 1.14,
                          rotate: active ? 0 : -5,
                          x: collapsed ? 0 : 1,
                        },
                      }}
                      transition={{ type: "spring", stiffness: 420, damping: 24 }}
                    >
                      <Icon className="size-4" />
                    </motion.span>
                    {!collapsed ? (
                      <motion.span
                        className="relative z-10 overflow-hidden truncate whitespace-nowrap font-medium"
                        style={{
                          scale: labelScale,
                          opacity: labelOpacity,
                          maxWidth: labelWidth,
                          transformOrigin: "left center",
                        }}
                      >
                        {label}
                      </motion.span>
                    ) : null}
                  </motion.div>
                </Link>
              </motion.div>
            );
          })}
        </nav>

        <div className="space-y-2 border-t border-white/10 pt-3">
          <motion.div
            layout
            style={{
              scale: workspaceScale,
              transformOrigin: collapsed ? "center bottom" : "left bottom",
            }}
            className={cn(
              "rounded-2xl border border-white/12 bg-white/[0.09] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_12px_34px_rgba(0,0,0,0.12)] backdrop-blur-xl",
              collapsed ? "p-2" : "p-3",
            )}
          >
            <div className={cn("flex items-center", collapsed ? "justify-center" : "gap-3")}>
              <motion.div
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-sm font-semibold text-primary shadow-sm"
                style={{ x: collapsed ? 0 : iconOffset }}
              >
                {(user?.email ?? churchName ?? "S").slice(0, 1).toUpperCase()}
              </motion.div>
              {!collapsed ? (
                <motion.div
                  className="min-w-0 overflow-hidden"
                  style={{ opacity: labelOpacity, maxWidth: labelWidth }}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/46">
                    Signed in as
                  </p>
                  <p className="mt-0.5 truncate text-sm font-semibold text-white">
                    {user?.email?.split("@")[0] ?? "Shepherd user"}
                  </p>
                  <p className="truncate text-xs text-white/54">{user?.email ?? "Signed in"}</p>
                </motion.div>
              ) : null}
            </div>
          </motion.div>

          <motion.button
            whileHover={{ backgroundColor: "rgba(255,255,255,0.06)" }}
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={() => void handleSignOut()}
            className={cn(
              "flex h-10 w-full items-center rounded-2xl border border-transparent text-sm font-medium text-white/54 transition-colors hover:border-white/10 hover:text-white",
              collapsed ? "justify-center px-0" : "gap-3 px-3",
            )}
          >
            <motion.span className="shrink-0" style={{ x: collapsed ? 0 : iconOffset }}>
              <LogOut className="size-4" />
            </motion.span>
            {!collapsed ? (
              <motion.span
                className="overflow-hidden whitespace-nowrap"
                style={{ opacity: labelOpacity, maxWidth: labelWidth }}
              >
                Sign out
              </motion.span>
            ) : null}
          </motion.button>
        </div>
      </motion.div>
    </motion.aside>
  );
}
