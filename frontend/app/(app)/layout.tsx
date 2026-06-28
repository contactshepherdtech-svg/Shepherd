import type { ReactNode } from "react";

import { AuthGuard } from "@/components/auth-guard";
import { Header } from "@/components/header";
import { MyTasksWidget } from "@/components/my-tasks-widget";
import { Sidebar } from "@/components/sidebar";
import { AuthProvider } from "@/lib/auth-context";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <AuthGuard>
        <div className="relative min-h-screen">
          {/* Soft canvas behind everything so frosted glass has something to refract. */}
          <div className="app-canvas pointer-events-none fixed inset-0 -z-10" aria-hidden />
          <div className="flex min-h-screen">
            <Sidebar />
            <div className="flex min-h-screen min-w-0 flex-1 flex-col overflow-x-hidden">
              <Header />
              <main className="flex-1 px-5 py-6 md:px-8 lg:px-10">
                <div className="mx-auto max-w-[1320px]">{children}</div>
              </main>
            </div>
          </div>
          <MyTasksWidget />
        </div>
      </AuthGuard>
    </AuthProvider>
  );
}
