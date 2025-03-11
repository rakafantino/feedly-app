"use client";

import { cn } from "@/lib/utils";
import { SideNav } from "./SideNav";
import { Header } from "./Header";
import { Toaster } from "sonner";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <div className="flex-1 flex flex-col sm:flex-row">
        <SideNav className="hidden sm:flex sm:flex-col border-r" />
        <main className={cn("flex-1 overflow-auto")}>
          <div className="h-full p-4 md:p-6 lg:p-8">{children}</div>
        </main>
      </div>
      <Toaster />
    </div>
  );
} 