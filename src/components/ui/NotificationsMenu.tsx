"use client";

import * as React from "react";
import { BellIcon, CheckIcon, TrashIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/dateUtils";
import { useSocket, StockAlertNotification } from "@/lib/useSocket";

export function NotificationsMenu() {
  const { 
    stockAlerts, 
    markAlertAsRead, 
    markAllAlertsAsRead, 
    dismissAlert, 
    dismissAllAlerts 
  } = useSocket();

  const unreadCount = stockAlerts.filter(alert => !alert.read).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <BellIcon className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifikasi</span>
          {stockAlerts.length > 0 && (
            <div className="flex gap-1">
              <Button 
                variant="ghost" 
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={() => markAllAlertsAsRead()}
                title="Tandai semua sebagai sudah dibaca"
              >
                <CheckIcon className="h-3.5 w-3.5 mr-1" />
                <span>Tandai semua dibaca</span>
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={() => dismissAllAlerts()}
                title="Hapus semua notifikasi"
              >
                <TrashIcon className="h-3.5 w-3.5 mr-1" />
                <span>Hapus semua</span>
              </Button>
            </div>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup className="max-h-[50vh] overflow-y-auto">
          {stockAlerts.length === 0 ? (
            <div className="px-2 py-6 text-center text-muted-foreground">
              <p>Tidak ada notifikasi.</p>
            </div>
          ) : (
            stockAlerts.map((alert) => (
              <NotificationItem
                key={alert.id}
                alert={alert}
                onMarkAsRead={markAlertAsRead}
                onDismiss={dismissAlert}
              />
            ))
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface NotificationItemProps {
  alert: StockAlertNotification;
  onMarkAsRead: (id: string) => void;
  onDismiss: (id: string) => void;
}

function NotificationItem({ alert, onMarkAsRead, onDismiss }: NotificationItemProps) {
  // Mencegah default behavior dropdown item
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!alert.read) {
      onMarkAsRead(alert.id);
    }
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDismiss(alert.id);
  };
  
  // Format waktu relatif (misal: "5 menit yang lalu")
  const timeAgo = formatRelativeTime(new Date(alert.timestamp));

  return (
    <DropdownMenuItem
      onClick={handleClick}
      className={`flex flex-col items-start p-3 cursor-default ${!alert.read ? 'bg-muted/50' : ''}`}
    >
      <div className="flex w-full items-start justify-between">
        <div className="space-y-1">
          <p className="font-medium text-sm leading-none">
            Stok Menipis: {alert.productName}
          </p>
          <p className="text-xs text-muted-foreground">
            {alert.currentStock} {alert.unit} tersisa (minimum {alert.threshold} {alert.unit})
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground whitespace-nowrap">{timeAgo}</span>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-6 w-6 p-0"
            onClick={handleDismiss}
          >
            <TrashIcon className="h-3.5 w-3.5" />
            <span className="sr-only">Hapus notifikasi</span>
          </Button>
        </div>
      </div>
    </DropdownMenuItem>
  );
} 