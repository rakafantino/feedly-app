"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  CircleDollarSign,
  LayoutDashboard,
  Package,
  Settings,
  TrendingUp,
  Menu,
  ChevronRight,
  Users,
  X,
  AlertCircle,
  Truck,
  Contact,
  Wallet
} from "lucide-react";

interface SideNavProps {
  className?: string;
  onMobileClose?: () => void;
}

interface NavItem {
  title: string;
  href: string;
  icon: React.ReactNode;
}

import { useSession } from "next-auth/react";
import { ROLES, ROLE_ACCESS } from "@/lib/constants";

// ... existing imports

export function SideNav({ className, onMobileClose }: SideNavProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [collapsed, setCollapsed] = useState(false);

  // Deteksi apakah saat ini di mobile view (digunakan di drawer)
  const isMobile = className?.includes("border-0");

  const userRole = (session?.user?.role?.toUpperCase() || ROLES.CASHIER) as keyof typeof ROLE_ACCESS;
  const allowedPaths = ROLE_ACCESS[userRole] || [];

  const navItems: NavItem[] = [
    {
      title: "Dashboard",
      href: "/dashboard",
      icon: <LayoutDashboard className="h-5 w-5" />,
    },
    {
      title: "Kasir",
      href: "/pos",
      icon: <CircleDollarSign className="h-5 w-5" />,
    },
    {
      title: "Produk",
      href: "/products",
      icon: <Package className="h-5 w-5" />,
    },
    {
      title: "Pelanggan",
      href: "/customers",
      icon: <Contact className="h-5 w-5" />,
    },
    {
      title: "Supplier",
      href: "/suppliers",
      icon: <Truck className="h-5 w-5" />,
    },
    {
      title: "Manajemen Stok",
      href: "/low-stock",
      icon: <AlertCircle className="h-5 w-5" />,
    },
    {
      title: "Biaya",
      href: "/expenses",
      icon: <Wallet className="h-5 w-5" />,
    },
    {
      title: "Laporan",
      href: "/reports",
      icon: <TrendingUp className="h-5 w-5" />,
    },
    {
      title: "Pengguna",
      href: "/users",
      icon: <Users className="h-5 w-5" />,
    },
    {
      title: "Pengaturan",
      href: "/settings",
      icon: <Settings className="h-5 w-5" />,
    },
  ];

  const filteredNavItems = navItems.filter(item => allowedPaths.includes(item.href));

  return (
    <div
      className={cn(
        "transition-all duration-300 pb-12 sticky top-0 h-screen",
        isMobile ? "w-full" : (collapsed ? "w-16" : "w-64"),
        className
      )}
    >
      <div className="space-y-4 py-4">
        <div className={cn(
          "flex items-center",
          isMobile ? "px-4 py-2 justify-between" : (collapsed ? "justify-center py-2" : "px-4 py-2 justify-between")
        )}>
          {(!collapsed || isMobile) && (
            <h2 className="text-xl font-bold tracking-tight">Feedly App</h2>
          )}

          {isMobile ? (
            // Tombol tutup untuk mobile view
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onMobileClose}
              aria-label="Close Menu"
            >
              <X className="h-4 w-4" />
            </Button>
          ) : (
            // Tombol collapse/expand untuk desktop view
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCollapsed(!collapsed)}
              aria-label={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
          )}
        </div>

        <ScrollArea className={cn(
          "h-[calc(100vh-9rem)]",
          collapsed && !isMobile ? "px-2" : ""
        )}>
          <div className="space-y-1 p-2">
            {filteredNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center rounded-md text-sm font-medium transition-colors",
                  pathname === item.href
                    ? "bg-primary text-primary-foreground"
                    : "transparent hover:bg-accent hover:text-accent-foreground",
                  isMobile
                    ? "px-3 py-2"
                    : (collapsed ? "justify-center h-10 w-10 p-2 mx-auto" : "px-3 py-2")
                )}
                title={collapsed && !isMobile ? item.title : undefined}
                onClick={isMobile && onMobileClose ? onMobileClose : undefined}
              >
                {item.icon}
                {(!collapsed || isMobile) && <span className="ml-3">{item.title}</span>}
              </Link>
            ))}
          </div>
        </ScrollArea>
      </div>

      <Separator />

      <div className={cn(
        isMobile ? "p-4" : (collapsed ? "flex justify-center py-4" : "p-4")
      )}>
        <p className={cn(
          "text-xs text-muted-foreground",
          !isMobile && collapsed ? "writing-mode-vertical rotate-180" : ""
        )}>
          {!isMobile && collapsed ? "Feedly" : "v1.0 © 2024 Feedly"}
        </p>
      </div>
    </div>
  );
} 