"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useAuth } from "@/lib/auth-context";

export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, churchUser, churchId, loading, planningCenterConnected } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    if (!churchUser || !churchId) {
      router.replace("/onboarding");
      return;
    }

    if (!planningCenterConnected && pathname !== "/settings") {
      router.replace("/settings");
    }
  }, [churchId, churchUser, loading, pathname, planningCenterConnected, router, user]);

  // Show nothing while checking session to avoid flash
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading Shepherd…</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  if (!churchUser || !churchId) return null;

  if (!planningCenterConnected && pathname !== "/settings") return null;

  return <>{children}</>;
}
