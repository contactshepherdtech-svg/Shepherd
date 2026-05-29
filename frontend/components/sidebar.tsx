"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Gauge, LogOut, Settings, Siren, Users } from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

const navItems = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: Gauge,
  },
  {
    href: "/members",
    label: "Members",
    icon: Users,
  },
  {
    href: "/priority",
    label: "Priority Outreach",
    icon: Siren,
  },
  {
    href: "/settings",
    label: "Settings",
    icon: Settings,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { churchName, user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    router.replace("/login");
  };

  return (
    <aside className="sticky top-0 hidden h-screen w-[266px] shrink-0 border-r border-[#064736] bg-sidebar text-sidebar-foreground lg:block">
      <div className="flex h-full flex-col px-4 py-5">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.42, ease: "easeOut" }}
          className="mb-7 flex justify-center"
        >
          <div className="relative overflow-hidden rounded-2xl border border-[#116a54] bg-[#095440] p-2.5 shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
            <Image
              src="/shepherd-logo.png"
              alt="Shepherd"
              width={140}
              height={140}
              className="h-auto w-[118px]"
              priority
            />
          </div>
        </motion.div>

        <nav className="space-y-1.5">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;

            return (
              <Link key={href} href={href} className="block">
                <motion.div
                  whileHover={{ x: 1 }}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors",
                    active
                      ? "border-[#2C8B70] bg-primary/25 text-[#F8F6EA]"
                      : "border-transparent text-[#DCE7DE] hover:border-[#2C8B70]/40 hover:bg-[#0A6A52]/45",
                  )}
                >
                  {active ? (
                    <motion.span
                      layoutId="active-sidebar-pill"
                      className="absolute inset-0 rounded-lg border border-[#57A88E]/60"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    />
                  ) : null}
                  <span
                    className={cn(
                      "relative z-10 rounded-md border p-1.5",
                      active
                        ? "border-[#4AA184] bg-[#0E785E] text-[#F8F6EA]"
                        : "border-[#2C8B70]/35 bg-[#0C6A52]/50 text-[#DCE7DE]",
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="relative z-10 font-medium">{label}</span>
                </motion.div>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-2">
          <div className="rounded-xl border border-[#2C8B70]/40 bg-[#0A6A52]/45 p-3">
            <p className="text-[11px] uppercase tracking-[0.13em] text-[#C6D9CF]">Workspace</p>
            <p className="mt-1 text-sm font-semibold text-[#F8F6EA]">
              {churchName ?? "Loading…"}
            </p>
            {user?.email ? (
              <p className="mt-0.5 truncate text-[11px] text-[#A8C2B5]">{user.email}</p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="flex w-full items-center gap-2.5 rounded-lg border border-[#2C8B70]/30 px-3 py-2 text-sm text-[#C6D9CF] transition-colors hover:border-[#2C8B70]/60 hover:bg-[#0A6A52]/45 hover:text-[#F8F6EA]"
          >
            <LogOut className="size-4 shrink-0" />
            <span className="font-medium">Sign out</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
