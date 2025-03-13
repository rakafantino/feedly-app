import { useEffect, useState } from 'react';
import io, { Socket } from 'socket.io-client';
import { SOCKET_EVENTS } from './socket';

let socket: Socket | null = null;

export interface StockAlertNotification {
  id: string;
  productId: string;
  productName: string;
  currentStock: number;
  threshold: number;
  unit: string;
  timestamp: Date;
  read: boolean;
  category?: string;
}

export function useSocket() {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [stockAlerts, setStockAlerts] = useState<StockAlertNotification[]>([]);
  const [lowStockCount, setLowStockCount] = useState<number>(0);

  useEffect(() => {
    // Inisialisasi socket connection jika belum ada
    if (!socket) {
      // Gunakan secure connection di production
      const host = window.location.host;
      const baseUrl = `${window.location.protocol}//${host}`;
      
      // Inisialisasi socket
      socket = io(baseUrl, {
        path: '/api/socketio',
        transports: ['websocket', 'polling'],
      });
      
      console.log('Socket initialized');
    }

    // Setup event listeners
    if (socket) {
      socket.on('connect', () => {
        console.log('Socket connected!');
        setIsConnected(true);
      });

      socket.on('disconnect', () => {
        console.log('Socket disconnected!');
        setIsConnected(false);
      });

      // Listen for stock alerts
      socket.on(SOCKET_EVENTS.STOCK_ALERT, (alert: StockAlertNotification) => {
        console.log('Received stock alert:', alert);
        setStockAlerts((prev) => [alert, ...prev]);
      });

      // Listen for stock count updates
      socket.on(SOCKET_EVENTS.STOCK_UPDATE, (data: { count: number }) => {
        console.log('Received stock count update:', data);
        setLowStockCount(data.count);
      });
      
      // Listen for product running out of stock
      socket.on(SOCKET_EVENTS.PRODUCT_LOW_STOCK, (data: { product: string, count: number }) => {
        console.log('Product low stock:', data);
      });
    }

    // Cleanup event listeners on component unmount
    return () => {
      if (socket) {
        socket.off('connect');
        socket.off('disconnect');
        socket.off(SOCKET_EVENTS.STOCK_ALERT);
        socket.off(SOCKET_EVENTS.STOCK_UPDATE);
        socket.off(SOCKET_EVENTS.PRODUCT_LOW_STOCK);
      }
    };
  }, []);

  // Fungsi untuk menandai alert sebagai dibaca
  const markAlertAsRead = (alertId: string) => {
    setStockAlerts((prev) =>
      prev.map((alert) =>
        alert.id === alertId ? { ...alert, read: true } : alert
      )
    );
  };

  // Fungsi untuk menandai semua alert sebagai dibaca
  const markAllAlertsAsRead = () => {
    setStockAlerts((prev) =>
      prev.map((alert) => ({ ...alert, read: true }))
    );
  };

  // Fungsi untuk menghapus alert
  const dismissAlert = (alertId: string) => {
    setStockAlerts((prev) => 
      prev.filter((alert) => alert.id !== alertId)
    );
  };

  // Fungsi untuk menghapus semua alert
  const dismissAllAlerts = () => {
    setStockAlerts([]);
  };

  return {
    isConnected,
    stockAlerts,
    lowStockCount,
    markAlertAsRead,
    markAllAlertsAsRead,
    dismissAlert,
    dismissAllAlerts
  };
} 