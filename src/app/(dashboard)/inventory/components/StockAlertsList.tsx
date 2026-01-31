'use client';

import { useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  AlertCircle, 
  Bell, 
  Check, 
  CheckCheck, 
  Clock, 
  Loader2,
  Package, 
  RefreshCw, 
  Trash 
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';
import { useStore } from '@/components/providers/store-provider';
import { getCookie } from '@/lib/utils';
import { 
  useStockAlerts, 
  useRefreshStockAlerts, 
  useMarkStockAlertAsRead, 
  useMarkAllStockAlertsAsRead,
  useDismissStockAlert,
  useDismissAllStockAlerts
} from '@/hooks/useStockAlerts';
import { CardSkeleton } from '@/components/skeleton';

export default function StockAlertsList() {
  const router = useRouter();
  const { selectedStore } = useStore();
  const storeId = selectedStore?.id || getCookie('selectedStoreId') || null;
  
  // Use React Query hooks - replaces manual useState + useEffect + fetch
  const { data, isLoading, isRefetching } = useStockAlerts(storeId);
  const refreshMutation = useRefreshStockAlerts();
  const markAsReadMutation = useMarkStockAlertAsRead();
  const markAllAsReadMutation = useMarkAllStockAlertsAsRead();
  const dismissMutation = useDismissStockAlert();
  const dismissAllMutation = useDismissAllStockAlerts();

  const notifications = data?.notifications || [];

  // SSE subscription untuk realtime update - tetap dipertahankan
  useEffect(() => {
    if (!storeId) return;

    let es: EventSource | null = null;
    let reconnectTimer: number | null = null;

    const connect = () => {
      try {
        es = new EventSource(`/api/stock-alerts/stream?storeId=${storeId}`);
        es.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg && msg.notifications) {
              // Notifications akan auto-update via React Query cache invalidation
              // atau manual setQueryData jika diperlukan untuk SSE updates
            }
          } catch (e) {
            console.error('[StockAlertsList] Failed to parse SSE message:', e);
          }
        };
        es.onerror = () => {
          if (es) es.close();
          if (reconnectTimer) window.clearTimeout(reconnectTimer);
          reconnectTimer = window.setTimeout(connect, 3000);
        };
      } catch (e) {
        console.error('[StockAlertsList] SSE connection error:', e);
      }
    };

    connect();

    return () => {
      if (es) es.close();
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
    };
  }, [storeId]);

  // Handler functions - now use mutations
  const handleRefresh = () => {
    refreshMutation.mutate({ storeId, forceCheck: true });
  };

  const handleMarkAllAsRead = () => {
    markAllAsReadMutation.mutate({ storeId });
  };

  const handleMarkAsRead = (notificationId: string) => {
    markAsReadMutation.mutate({ storeId, notificationId });
  };

  const handleDismiss = (notificationId: string) => {
    dismissMutation.mutate({ storeId, notificationId });
  };

  const handleDismissAll = () => {
    dismissAllMutation.mutate({ storeId });
  };

  const navigateToProduct = (productId: string) => {
    router.push(`/products/edit/${productId}`);
  };

  const unreadCount = notifications.filter(notification => !notification.read).length;
  const isAnyLoading = isLoading || isRefetching || refreshMutation.isPending;
  const isAnyProcessing = markAsReadMutation.isPending || markAllAsReadMutation.isPending || 
                         dismissMutation.isPending || dismissAllMutation.isPending;

  if (isAnyLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Notifikasi Stok</CardTitle>
        </CardHeader>
        <CardContent>
          <CardSkeleton cardCount={3} showHeader={false} />
        </CardContent>
      </Card>
    );
  }

  if (notifications.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Notifikasi Stok</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full flex items-center justify-center">
            <div className="flex flex-col items-center gap-2 text-center">
              <Bell className="h-16 w-16 text-muted-foreground" />
              <p className="text-medium font-medium">Tidak ada notifikasi stok</p>
              <p className="text-sm text-muted-foreground">
                Anda akan menerima notifikasi ketika stok produk berada di bawah threshold
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
        <div className="flex flex-col space-y-1">
          <CardTitle>Notifikasi Stok</CardTitle>
          <p className="text-sm text-muted-foreground">
            {unreadCount > 0 ? (
              <>
                {unreadCount} notifikasi belum dibaca dari {notifications.length} notifikasi
              </>
            ) : (
              <>
                {notifications.length} notifikasi stok
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshMutation.isPending}
            className="h-8"
          >
            {refreshMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
          </Button>
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllAsRead}
              disabled={markAllAsReadMutation.isPending}
              className="h-8"
            >
              <CheckCheck className="h-3.5 w-3.5 mr-1" />
              <span className="sm:inline hidden">Tandai Semua Dibaca</span>
              <span className="sm:hidden inline">Tandai Dibaca</span>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleDismissAll}
            disabled={dismissAllMutation.isPending}
            className="h-8"
          >
            <Trash className="h-3.5 w-3.5 mr-1" />
            <span className="sm:inline hidden">Hapus Semua</span>
            <span className="sm:hidden inline">Hapus</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
          {notifications.map((notification) => {
            const timestamp = typeof notification.timestamp === 'string' 
              ? new Date(notification.timestamp) 
              : notification.timestamp;
            
            return (
              <div 
                key={notification.id} 
                className={`border rounded-lg p-4 relative ${
                  notification.read ? 'bg-background' : 'bg-primary/5 border-primary/20'
                } ${isAnyProcessing ? 'opacity-50' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-full ${
                    notification.read ? 'bg-muted' : 'bg-primary/10'
                  }`}>
                    <Package className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-sm truncate leading-tight cursor-pointer hover:text-primary"
                            onClick={() => notification.productId && navigateToProduct(notification.productId)}
                          >
                            {notification.productName}
                          </h4>
                          {!notification.read && (
                            <Badge variant="default" className="h-5 px-1.5 text-[10px] shrink-0">
                              Baru
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                          <AlertCircle className="h-3.5 w-3.5 text-orange-500" />
                          <p className="text-xs">
                            Stok: <span className="font-medium">{notification.currentStock} {notification.unit}</span> 
                            <span className="text-muted-foreground"> (min {notification.threshold} {notification.unit})</span>
                          </p>
                        </div>
                        {notification.price !== undefined && (
                          <div className="flex items-center gap-1 mt-1">
                            <p className="text-xs">
                              Harga: <span className="font-medium">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(notification.price)}</span>
                              <span className="text-muted-foreground"> / {notification.unit}</span>
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {!notification.read && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7" 
                            onClick={() => handleMarkAsRead(notification.id)}
                            disabled={markAsReadMutation.isPending}
                            title="Tandai sebagai dibaca"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7" 
                          onClick={() => handleDismiss(notification.id)}
                          disabled={dismissMutation.isPending}
                          title="Hapus notifikasi"
                        >
                          <Trash className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center mt-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3 mr-1" />
                      {formatDistanceToNow(timestamp, { 
                        addSuffix: true,
                        locale: id
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
