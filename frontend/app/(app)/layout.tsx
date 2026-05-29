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
          <div className="mx-auto flex min-h-screen max-w-[1600px]">
            <Sidebar />
            <div className="flex min-h-screen flex-1 flex-col">
              <Header />
              <main className="flex-1 p-6 md:p-8">{children}</main>
            </div>
          </div>
        </div>
      </AuthGuard>
    </AuthProvider>
  );
}
