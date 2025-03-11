"use client";

import { cn } from "@/lib/utils";
import { SideNav } from "./SideNav";
import { Header } from "./Header";
import { Toaster } from "@/components/ui/sonner";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="flex-1 flex flex-col sm:flex-row">
        <SideNav className="hidden sm:flex sm:flex-col sm:w-64 border-r" />
        <main className={cn("flex-1")}>
          <div className="container p-4 md:p-6 space-y-6">{children}</div>
        </main>
      </div>
      <Toaster />
    </div>
  );
} 