import type { ReactNode } from "react";

import { AuthGuard } from "@/components/auth-guard";
import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
import { AuthProvider } from "@/lib/auth-context";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <AuthGuard>
        <div className="min-h-screen bg-background">
          <div className="flex min-h-screen">
            <Sidebar />
            <div className="flex min-h-screen min-w-0 flex-1 flex-col overflow-x-hidden bg-background">
              <Header />
              <main className="flex-1 px-5 py-6 md:px-8 lg:px-10">
                <div className="mx-auto max-w-[1320px]">{children}</div>
              </main>
            </div>
          </div>
        </div>
      </AuthGuard>
    </AuthProvider>
  );
}
