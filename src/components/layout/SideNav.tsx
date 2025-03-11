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
  Users
} from "lucide-react";

interface SideNavProps {
  className?: string;
}

interface NavItem {
  title: string;
  href: string;
  icon: React.ReactNode;
}

export function SideNav({ className }: SideNavProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

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

  return (
    <div 
      className={cn(
        "transition-all duration-300 pb-12 sticky top-0 h-screen",
        collapsed ? "w-16" : "w-64",
        className
      )}
    >
      <div className="space-y-4 py-4">
        <div className={cn(
          "flex items-center",
          collapsed ? "justify-center py-2" : "px-4 py-2 justify-between"
        )}>
          {!collapsed && (
            <h2 className="text-xl font-bold tracking-tight">Feedly App</h2>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
        </div>
        <ScrollArea className={cn(
          "h-[calc(100vh-9rem)]",
          collapsed ? "px-2" : ""
        )}>
          <div className="space-y-1 p-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center rounded-md text-sm font-medium transition-colors",
                  pathname === item.href
                    ? "bg-primary text-primary-foreground"
                    : "transparent hover:bg-accent hover:text-accent-foreground",
                  collapsed 
                    ? "justify-center h-10 w-10 p-2 mx-auto" 
                    : "px-3 py-2"
                )}
                title={collapsed ? item.title : undefined}
              >
                {item.icon}
                {!collapsed && <span className="ml-3">{item.title}</span>}
              </Link>
            ))}
          </div>
        </ScrollArea>
      </div>
      <Separator />
      <div className={cn(
        collapsed ? "flex justify-center py-4" : "p-4"
      )}>
        <p className={cn(
          "text-xs text-muted-foreground",
          collapsed ? "writing-mode-vertical rotate-180" : ""
        )}>
          {collapsed ? "Feedly" : "v1.0 © 2025 Feedly"}
        </p>
      </div>
    </div>
  );
} 