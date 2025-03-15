'use client';

import { useState } from 'react';
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
import { getStockVariant } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { useSocket } from '@/lib/useSocket';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';

export default function StockAlertsList() {
  const { 
    stockAlerts, 
    markAlertAsRead, 
    markAllAlertsAsRead, 
    dismissAlert, 
    dismissAllAlerts 
  } = useSocket();
  const router = useRouter();

  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    try {
      // Panggil API stock-alerts dengan forceUpdate untuk memperbarui notifikasi
      const response = await fetch('/api/stock-alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          forceUpdate: true 
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to refresh stock alerts');
      }
      
      console.log('Stock alerts refreshed successfully');
    } catch (error) {
      console.error('Error refreshing stock alerts:', error);
    } finally {
      // Selesai refresh
      setRefreshing(false);
    }
  };

  const navigateToProduct = (productId: string) => {
    router.push(`/products/edit/${productId}`);
  };

  const unreadAlertsCount = stockAlerts.filter(alert => !alert.read).length;

  if (refreshing) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Notifikasi Stok</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] w-full flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Memuat notifikasi...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (stockAlerts.length === 0) {
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
            {unreadAlertsCount > 0 ? (
              <>
                {unreadAlertsCount} notifikasi belum dibaca dari {stockAlerts.length} notifikasi
              </>
            ) : (
              <>
                {stockAlerts.length} notifikasi stok
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={refreshing}
            className="h-8"
          >
            {refreshing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
          </Button>
          {unreadAlertsCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={markAllAlertsAsRead}
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
            onClick={dismissAllAlerts}
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
          {stockAlerts.map((alert) => {
            // Konversi timestamp string ke objek Date jika perlu
            const timestamp = typeof alert.timestamp === 'string' 
              ? new Date(alert.timestamp) 
              : alert.timestamp;
            
            return (
              <div 
                key={alert.id} 
                className={`border rounded-lg p-4 relative ${
                  alert.read ? 'bg-background' : 'bg-primary/5 border-primary/20'
                }`}
              >
                {!alert.read && (
                  <Badge variant="default" className="absolute top-3 right-3">
                    Baru
                  </Badge>
                )}
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-full ${
                    alert.read ? 'bg-muted' : 'bg-primary/10'
                  }`}>
                    <AlertCircle className={`h-5 w-5 ${
                      alert.read ? 'text-muted-foreground' : 'text-primary'
                    }`} />
                  </div>
                  <div className="flex-1 space-y-1 overflow-hidden">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium">{alert.productName}</h3>
                      <Badge variant={getStockVariant(alert.currentStock, alert.threshold)}>
                        {alert.currentStock} {alert.unit}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {alert.category && <span className="mr-2">Kategori: {alert.category}</span>}
                      Stok tersisa <strong>{alert.currentStock}</strong> dari threshold <strong>{alert.threshold}</strong>
                    </p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                      <Clock className="h-3 w-3" />
                      <span>{formatDistanceToNow(timestamp, { addSuffix: true, locale: id })}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => navigateToProduct(alert.productId)}
                      >
                        <Package className="h-3.5 w-3.5 mr-1" />
                        <span className="whitespace-nowrap">Lihat Produk</span>
                      </Button>
                      {!alert.read && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => markAlertAsRead(alert.id)}
                        >
                          <Check className="h-3.5 w-3.5 mr-1" />
                          <span className="whitespace-nowrap">Tandai Dibaca</span>
                        </Button>
                      )}
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => dismissAlert(alert.id)}
                      >
                        <Trash className="h-3.5 w-3.5 mr-1" />
                        <span className="whitespace-nowrap">Hapus</span>
                      </Button>
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