"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { SideNav } from "./SideNav";
import Header from "./Header";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import React from "react";
import { useSession } from "next-auth/react";
import { OfflineBanner } from "@/components/ui/offline-banner";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const { data: session } = useSession();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <OfflineBanner />
      <Header user={session?.user ?? undefined} onMobileMenuClick={() => setIsMobileNavOpen(true)} />
      <div className="flex-1 flex flex-col sm:flex-row">
        {/* Desktop Sidebar */}
        <SideNav className="hidden sm:flex sm:flex-col border-r" />

        {/* Mobile Navigation Sheet */}
        <Sheet open={isMobileNavOpen} onOpenChange={setIsMobileNavOpen}>
          <SheetContent side="left" className="p-0 w-72" aria-describedby="sidenav-sheet-description">
            <SheetTitle className="sr-only">Menu Navigasi</SheetTitle>
            <SideNav className="border-0" onMobileClose={() => setIsMobileNavOpen(false)} />
          </SheetContent>
        </Sheet>

        <main className={cn("flex-1 overflow-auto")}>
          <div className="h-full p-4 md:p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
