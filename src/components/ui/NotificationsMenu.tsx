"use client";

import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
  Bell,
  BellOff,
  Check,
  ChevronDown,
  Trash,
  ShoppingBasket,
  Wallet,
  Clock, // Added Clock
  CalendarX // Added for Expired
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AppNotification } from '@/services/notification.service'; // Updated Type
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';
import { useStore } from '@/components/providers/store-provider';
import { getCookie } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { formatCurrency } from '@/lib/currency'; // Added formatCurrency

export function NotificationsMenu() {
  const { selectedStore } = useStore(); // Menggunakan selectedStore dari StoreProvider
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Mendapatkan storeId dari selectedStore atau dari cookie
  const storeId = selectedStore?.id || getCookie('selectedStoreId');
  const router = useRouter();

  // Fungsi untuk memuat notifikasi
  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      
      // Trigger backend logic to generate real-time reminders/updates
      // 'Checking' first ensures the fetch below gets the absolutely latest state
      // This solves "Trigger only on purchase" bug -> now triggers every minute while active
      if (storeId) {
          try {
             await fetch('/api/cron/notifications', { method: 'GET' });
          } catch(e) {
             console.error("Background check failed", e);
          }
      }

      // Batalkan request sebelumnya jika ada
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;
      const { signal } = controller;
      const url = new URL('/api/stock-alerts', window.location.origin);
      if (storeId) {
        url.searchParams.append('storeId', storeId);
      }

      const response = await fetch(url, { signal });

      if (!response.ok) {
        throw new Error('Failed to fetch notifications');
      }

      const data = await response.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (error) {
      // Abaikan jika request dibatalkan secara sengaja
      if ((error as any)?.name === 'AbortError') {
        return;
      }
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  // Memuat notifikasi ketika komponen dimuat dan storeId berubah
  useEffect(() => {
    fetchNotifications();

    // Buat timer untuk refresh notifikasi secara berkala
    const timer = setInterval(fetchNotifications, 60000); // Refresh setiap 1 menit

    return () => {
      clearInterval(timer);
      // Pastikan tidak ada request yang masih berjalan saat unmount
      abortControllerRef.current?.abort();
    };
  }, [storeId, fetchNotifications]);

  // Dengarkan event refresh notifikasi instan setelah transaksi
  useEffect(() => {
    const handleRefreshEvent = () => {
      abortControllerRef.current?.abort();
      fetchNotifications();
    };
    window.addEventListener('stock-alerts-refresh', handleRefreshEvent);
    return () => {
      window.removeEventListener('stock-alerts-refresh', handleRefreshEvent);
    };
  }, [fetchNotifications]);

  // SSE: Berlangganan stream notifikasi realtime per store
  useEffect(() => {
    if (!storeId) return;

    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      es = new EventSource(`/api/stock-alerts/stream?storeId=${storeId}`);
      es.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg?.notifications) {
            const list = msg.notifications as AppNotification[];
            setNotifications(list);
            setUnreadCount(
              typeof msg.unreadCount === 'number'
                ? msg.unreadCount
                : list.filter(n => !n.read).length
            );
          }
        } catch (e) {
          console.error('SSE message parse error:', e);
        }
      };
      es.onerror = () => {
        // Tutup koneksi dan coba reconnect sederhana
        try { es?.close(); } catch { }
        if (!reconnectTimer) {
          reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            connect();
          }, 5000);
        }
      };
    };

    connect();

    return () => {
      try { es?.close(); } catch { }
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };
  }, [storeId]);

  // Menandai semua notifikasi sebagai sudah dibaca
  const markAllAsRead = async () => {
    try {
      const url = new URL('/api/stock-alerts', window.location.origin);
      url.searchParams.append('action', 'markAllAsRead');
      if (storeId) {
        url.searchParams.append('storeId', storeId);
      }
      
      // Optimistic update
      setNotifications([]);
      setUnreadCount(0);

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Failed to mark notifications as read');
      }
    } catch (error) {
      console.error('Error marking notifications as read:', error);
      fetchNotifications();
    }
  };

  // Menandai satu notifikasi sebagai dibaca
  const markAsRead = async (notificationId: string) => {
    try {
      const url = new URL('/api/stock-alerts', window.location.origin);
      url.searchParams.append('action', 'markAsRead');
      url.searchParams.append('notificationId', notificationId);
      if (storeId) {
        url.searchParams.append('storeId', storeId);
      }

      // Optimistic update: Remove from list immediately (Inbox Zero behavior)
      const updatedNotifications = notifications.filter(
         notification => notification.id !== notificationId
      );
      setNotifications(updatedNotifications);
      setUnreadCount(updatedNotifications.length);

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Failed to mark notification as read');
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
      // Revert if failed (optional, but good UX)
      fetchNotifications();
    }
  };

  // Menghapus satu notifikasi
  const dismissNotification = async (notificationId: string) => {
    try {
      const url = new URL('/api/stock-alerts', window.location.origin);
      url.searchParams.append('action', 'dismiss');
      url.searchParams.append('notificationId', notificationId);
      if (storeId) {
        url.searchParams.append('storeId', storeId);
      }

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Failed to dismiss notification');
      }

      // Update local state
      const updatedNotifications = notifications.filter(
        notification => notification.id !== notificationId
      );
      setNotifications(updatedNotifications);

      // Recalculate unread count
      const newUnreadCount = updatedNotifications.filter(n => !n.read).length;
      setUnreadCount(newUnreadCount);
    } catch (error) {
      console.error('Error dismissing notification:', error);
    }
  };

  // Menghapus semua notifikasi
  const dismissAllNotifications = async () => {
    try {
      const url = new URL('/api/stock-alerts', window.location.origin);
      url.searchParams.append('action', 'dismissAll');
      if (storeId) {
        url.searchParams.append('storeId', storeId);
      }

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Failed to dismiss all notifications');
      }

      // Update local state
      setNotifications([]);
      setUnreadCount(0);
    } catch (error) {
      console.error('Error dismissing all notifications:', error);
    }
  };

  // Snooze notifikasi
  const snoozeNotification = async (notificationId: string, minutes: number) => {
    try {
      const url = new URL('/api/stock-alerts', window.location.origin);
      url.searchParams.append('action', 'snooze');
      url.searchParams.append('notificationId', notificationId);
      url.searchParams.append('minutes', minutes.toString());
      if (storeId) {
        url.searchParams.append('storeId', storeId);
      }

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Failed to snooze notification');
      }

      // Remove from list immediately (it's snoozed)
      const updatedNotifications = notifications.filter(
        notification => notification.id !== notificationId
      );
      setNotifications(updatedNotifications);
      setUnreadCount(updatedNotifications.filter(n => !n.read).length);
      
      // Close popover
      setOpen(false);
    } catch (error) {
      console.error('Error snoozing notification:', error);
    }
  };

  // Refresh notifikasi secara manual
  const refreshNotifications = async () => {
    try {
      setLoading(true);

      // Panggil API untuk memperbarui notifikasi
      const url = new URL('/api/stock-alerts', window.location.origin);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          storeId,
          forceCheck: true,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to refresh notifications');
      }

      // Muat ulang notifikasi setelah refresh
      await fetchNotifications();
    } catch (error) {
      console.error('Error refreshing notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  // Format waktu
  const formatTime = (date: Date): string => {
    try {
      return formatDistanceToNow(new Date(date), {
        addSuffix: true,
        locale: id
      });
    } catch {
      return 'Waktu tidak valid';
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="Notifikasi"
        >
          <Bell size={20} />
          {unreadCount > 0 && (
            <Badge
              className="absolute -top-1 -right-1 px-1.5 h-5 min-w-5 flex items-center justify-center"
              variant="destructive"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 md:w-96 p-0 max-h-[80vh] flex flex-col"
        align="end"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b">
          <h3 className="font-semibold text-sm">
            Notifikasi
          </h3>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                title="Tandai semua sebagai dibaca"
                onClick={markAllAsRead}
              >
                <Check size={16} />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title="Refresh notifikasi"
              onClick={refreshNotifications}
              disabled={loading}
            >
              <svg
                className={cn(
                  "h-4 w-4",
                  loading ? "animate-spin" : ""
                )}
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
              </svg>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title="Bersihkan semua notifikasi"
              onClick={dismissAllNotifications}
              disabled={notifications.length === 0}
            >
              <Trash size={16} />
            </Button>
          </div>
        </div>

        {/* Notification List */}
        <div className="overflow-y-auto flex-grow">
          {loading && notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-6 text-center text-muted-foreground">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Memuat notifikasi...</span>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-6 text-center text-muted-foreground">
              <BellOff size={24} className="mb-2 opacity-50" />
              <p className="text-sm">Tidak ada notifikasi</p>
            </div>
          ) : (
            <>
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "p-3 border-b last:border-0 flex items-start gap-2 transition-colors cursor-pointer hover:bg-muted/80",
                    !notification.read ? "bg-muted/50" : ""
                  )}
                  onClick={() => {
                    markAsRead(notification.id);
                    setOpen(false);
                    // Navigate based on type
                    if (notification.type === 'DEBT') {
                         router.push('/reports/debt');
                    } else if (notification.type === 'EXPIRED') {
                         router.push('/low-stock?tab=expiry'); // Redirect to Expiry Analysis tab
                    } else {
                         router.push('/low-stock');
                    }
                  }}
                >
                  <div className={cn(
                      "mt-0.5 p-1.5 rounded-full",
                      notification.type === 'DEBT' ? "bg-red-100 text-red-600" : 
                      notification.type === 'EXPIRED' ? "bg-red-100 text-red-600" :
                      "bg-orange-100 text-orange-600"
                  )}>
                    {notification.type === 'DEBT' ? <Wallet size={16} /> : 
                     notification.type === 'EXPIRED' ? <CalendarX size={16} /> :
                     <ShoppingBasket size={16} />}
                  </div>
                  <div className="flex-grow min-w-0">
                    <div className="flex justify-between items-start gap-1">
                      <h4 className="font-medium text-sm truncate pr-4">
                        {notification.type === 'DEBT' ? `Piutang: ${notification.customerName}` : notification.productName}
                      </h4>
                      <div className="flex items-center gap-1">
                        {!notification.read && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            title="Tandai sebagai dibaca"
                            onClick={(e) => {
                              e.stopPropagation();
                              markAsRead(notification.id);
                            }}
                          >
                            <Check size={14} />
                          </Button>
                        )}
                        
                        {/* Snooze Button */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                title="Ingatkan lagi nanti (Snooze)"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <Clock size={14} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); snoozeNotification(notification.id, 5); }}>
                                  Ingatkan 5 menit lagi
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); snoozeNotification(notification.id, 15); }}>
                                  Ingatkan 15 menit lagi
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); snoozeNotification(notification.id, 60); }}>
                                  Ingatkan 1 jam lagi
                              </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          title="Hapus notifikasi"
                          onClick={(e) => {
                            e.stopPropagation();
                            dismissNotification(notification.id);
                          }}
                        >
                          <Trash size={14} />
                        </Button>
                      </div>
                    </div>
                    {notification.type === 'DEBT' ? (
                       <p className="text-sm text-muted-foreground truncate">
                          Jatuh Tempo: <strong>{notification.dueDate ? new Date(notification.dueDate).toLocaleDateString('id-ID') : '-'}</strong> <br/>
                          Sisa: {notification.remainingAmount ? formatCurrency(notification.remainingAmount) : 0}
                       </p>
                    ) : notification.type === 'EXPIRED' ? (
                       <p className="text-sm text-muted-foreground truncate">
                          {notification.daysLeft != undefined && notification.daysLeft < 0 
                             ? <span className="text-red-600 font-medium">Telah Kadaluarsa</span> 
                             : <span className="text-orange-600 font-medium">Hampir Kadaluarsa</span>
                          }
                          <br/>
                          <span className="text-xs">
                             Stok: {notification.currentStock} {notification.unit} 
                             {notification.batchNumber ? ` • Batch: ${notification.batchNumber}` : ''}
                          </span>
                       </p>
                    ) : (
                       <p className="text-sm text-muted-foreground truncate">
                         Stok: <strong>{notification.currentStock}</strong> {notification.unit} (min. {notification.threshold})
                       </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatTime(notification.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="p-2 border-t text-center">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs w-full text-muted-foreground"
              onClick={() => setOpen(false)}
            >
              Tutup <ChevronDown size={14} className="ml-1" />
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}