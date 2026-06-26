"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { LogOut, Menu, X } from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import { filterNavItems } from "@/lib/nav";
import { cn } from "@/lib/utils";

// Mobile navigation. Self-contained and gated to `lg:hidden` everywhere, so on
// desktop (>=1024px) it renders nothing visible and the desktop sidebar is the
// sole nav. Below lg, the sidebar is hidden and this hamburger + drawer is the
// only way to navigate. Reuses the shared nav config + admin-only Staff gate.
export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { churchName, churchUser, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  // The drawer/overlay are portaled to document.body so `position: fixed` is
  // viewport-relative (the Header's backdrop-filter + transforms would otherwise
  // make fixed anchor to the header box). Mount-gate keeps it SSR-safe.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const items = filterNavItems(churchUser?.role);

  // Safety net: any navigation closes the drawer, even if a close handler was
  // missed (e.g. programmatic route change).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Close on Escape while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // If the viewport crosses to desktop (>=lg) while open, close it — otherwise
  // the drawer goes display:none but the body-scroll lock would stay stuck.
  useEffect(() => {
    if (!open) return;
    const mq = window.matchMedia("(min-width: 1024px)");
    if (mq.matches) {
      setOpen(false);
      return;
    }
    const onChange = (event: MediaQueryListEvent) => {
      if (event.matches) setOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [open]);

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const handleSignOut = async () => {
    setOpen(false);
    await signOut();
    router.replace("/login");
  };

  const drawer = (
    <AnimatePresence>
      {open ? (
        <div className="lg:hidden">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]"
            aria-hidden
          />

          {/* Drawer */}
          <motion.aside
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 420, damping: 40, mass: 0.8 }}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col overflow-hidden border-r border-white/12 bg-sidebar text-sidebar-foreground shadow-[24px_0_55px_rgba(0,0,0,0.28)]"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_44%_0%,rgba(255,210,31,0.18),transparent_36%),linear-gradient(180deg,rgba(255,255,255,0.10),rgba(255,255,255,0.025)_36%,transparent_76%)]" />

            <div className="relative flex h-full flex-col p-3">
              <div className="flex items-center justify-between gap-2 px-1 py-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#FFD21F]/90">
                    Workspace
                  </p>
                  <p className="mt-0.5 truncate text-[15px] font-semibold tracking-[-0.01em] text-white">
                    {churchName ?? "Shepherd"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close navigation menu"
                  className="rounded-xl border border-white/10 p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <X className="size-4" />
                </button>
              </div>

              <nav className="mt-2 flex-1 space-y-1 overflow-y-auto py-1">
                {items.map(({ href, label, icon: Icon }) => {
                  const active = pathname === href;
                  return (
                    <Link
                      key={href}
                      href={href}
                      prefetch
                      onClick={() => setOpen(false)}
                      className={cn(
                        "relative flex items-center gap-3 rounded-2xl border px-3 py-2.5 text-sm font-medium transition-colors",
                        active
                          ? "border-white/14 bg-white/[0.115] text-white ring-1 ring-white/13"
                          : "border-transparent text-white/72 hover:bg-white/[0.075] hover:text-white",
                      )}
                    >
                      {active ? (
                        <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-[#FFD21F] shadow-[0_0_18px_rgba(255,210,31,0.42)]" />
                      ) : null}
                      <Icon className="size-4 shrink-0" />
                      <span className="truncate">{label}</span>
                    </Link>
                  );
                })}
              </nav>

              <div className="border-t border-white/10 pt-3">
                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  className="flex h-10 w-full items-center gap-3 rounded-2xl border border-transparent px-3 text-sm font-medium text-white/54 transition-colors hover:border-white/10 hover:text-white"
                >
                  <LogOut className="size-4 shrink-0" />
                  Sign out
                </button>
              </div>
            </div>
          </motion.aside>
        </div>
      ) : null}
    </AnimatePresence>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open navigation menu"
        aria-expanded={open}
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-foreground shadow-sm transition-colors hover:border-primary/40 lg:hidden"
      >
        <Menu className="size-5" />
      </button>

      {mounted ? createPortal(drawer, document.body) : null}
    </>
  );
}
