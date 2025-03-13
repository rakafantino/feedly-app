'use client';

import React, { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import io, { Socket } from 'socket.io-client';
import { SOCKET_EVENTS } from '@/lib/socket';

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

interface SocketContextType {
  isConnected: boolean;
  stockAlerts: StockAlertNotification[];
  lowStockCount: number;
  markAlertAsRead: (id: string) => void;
  markAllAlertsAsRead: () => void;
  dismissAlert: (id: string) => void;
  dismissAllAlerts: () => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

// Gunakan socket sebagai variabel eksternal singleton
let socket: Socket | null = null;

export function SocketProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [stockAlerts, setStockAlerts] = useState<StockAlertNotification[]>([]);
  const [lowStockCount, setLowStockCount] = useState<number>(0);

  // Fungsi untuk menandai alert sebagai dibaca
  const markAlertAsRead = useCallback((alertId: string) => {
    console.log('[useSocket] Marking alert as read:', alertId);
    setStockAlerts((prev) =>
      prev.map((alert) =>
        alert.id === alertId ? { ...alert, read: true } : alert
      )
    );
  }, []);

  // Fungsi untuk menandai semua alert sebagai dibaca
  const markAllAlertsAsRead = useCallback(() => {
    console.log('[useSocket] Marking all alerts as read');
    setStockAlerts((prev) =>
      prev.map((alert) => ({ ...alert, read: true }))
    );
  }, []);

  // Fungsi untuk menghapus alert
  const dismissAlert = useCallback((alertId: string) => {
    console.log('[useSocket] Dismissing alert:', alertId);
    setStockAlerts((prev) => 
      prev.filter((alert) => alert.id !== alertId)
    );
  }, []);

  // Fungsi untuk menghapus alert berdasarkan productId
  const dismissAlertByProductId = useCallback((productId: string) => {
    console.log('[useSocket] Dismissing alert for product:', productId);
    setStockAlerts((prev) => 
      prev.filter((alert) => alert.productId !== productId)
    );
  }, []);

  // Fungsi untuk menghapus semua alert
  const dismissAllAlerts = useCallback(() => {
    console.log('[useSocket] Dismissing all alerts');
    setStockAlerts([]);
  }, []);

  // Fungsi untuk memuat daftar alert aktif
  const fetchActiveAlerts = useCallback(async () => {
    if (typeof window === 'undefined') return;

    try {
      console.log('[useSocket] Fetching active alerts');
      const response = await fetch('/api/stock-alerts');
      
      if (!response.ok) {
        throw new Error('Failed to fetch active alerts');
      }
      
      const data = await response.json();
      
      if (data.success && Array.isArray(data.alerts)) {
        console.log(`[useSocket] Loaded ${data.alerts.length} active alerts`);
        
        // Konversi string timestamp ke objek Date
        const formattedAlerts = data.alerts.map((alert: any) => ({
          ...alert,
          timestamp: new Date(alert.timestamp)
        }));
        
        setStockAlerts(formattedAlerts);
        setLowStockCount(formattedAlerts.length);
      }
    } catch (error) {
      console.error('[useSocket] Error fetching active alerts:', error);
    }
  }, []);

  // Setup socket connection dan event listeners
  useEffect(() => {
    console.log('[useSocket] Setting up Socket.io connection');

    if (typeof window === 'undefined') {
      console.log('[useSocket] Running on server, skipping socket setup');
      return;
    }
    
    // Jika socket sudah ada, gunakan itu
    if (!socket) {
      // Preparasi URL
      const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
      const host = window.location.host;
      
      console.log(`[useSocket] Initializing socket with baseUrl: ${protocol}//${host}`);
      
      // Inisialisasi socket baru dengan opsi sederhana
      socket = io(`${protocol}//${host}`, {
        path: '/api/socketio',
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
        autoConnect: true,
        transports: ['polling', 'websocket'] 
      });
      
      console.log('[useSocket] Socket initialized');
    } else {
      console.log('[useSocket] Socket already initialized, id:', socket.id);
    }
    
    // Fungsi event handlers
    const onConnect = () => {
      console.log('[useSocket] Socket connected with ID:', socket?.id);
      setIsConnected(true);
      
      // Fetch active alerts ketika pertama kali terhubung
      fetchActiveAlerts();
    };
    
    const onDisconnect = (reason: string) => {
      console.log(`[useSocket] Socket disconnected: ${reason}`);
      setIsConnected(false);
    };
    
    const onConnectError = (error: Error) => {
      console.error('[useSocket] Connection error:', error.message);
    };

    const onStockAlert = (alert: StockAlertNotification) => {
      console.log('[useSocket] Received stock alert:', alert);
      
      // Pastikan alert mempunyai timestamp yang benar (objek Date)
      const alertWithDate = {
        ...alert,
        timestamp: new Date(alert.timestamp)
      };
      
      // Tambahkan alert baru ke daftar
      setStockAlerts((prev) => {
        // Cek apakah sudah ada alert untuk produk ini, jika ada ganti dengan yang baru
        const exists = prev.some(a => a.productId === alert.productId);
        
        if (exists) {
          return prev.map(a => 
            a.productId === alert.productId ? alertWithDate : a
          );
        } else {
          return [alertWithDate, ...prev];
        }
      });
    };

    const onStockAlertCleared = (data: { productId: string, productName: string }) => {
      console.log('[useSocket] Stock alert cleared:', data);
      dismissAlertByProductId(data.productId);
    };

    const onStockUpdate = (data: { count: number }) => {
      console.log('[useSocket] Received stock count update:', data);
      setLowStockCount(data.count);
    };

    const onProductLowStock = (data: { product: string, count: number }) => {
      console.log('[useSocket] Product low stock:', data);
    };
    
    // Daftar semua listeners
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on(SOCKET_EVENTS.STOCK_ALERT, onStockAlert);
    socket.on(SOCKET_EVENTS.STOCK_ALERT_CLEARED, onStockAlertCleared);
    socket.on(SOCKET_EVENTS.STOCK_UPDATE, onStockUpdate);
    socket.on(SOCKET_EVENTS.PRODUCT_LOW_STOCK, onProductLowStock);

    // Update status koneksi awal
    if (socket.connected) {
      console.log('[useSocket] Socket is already connected with ID:', socket.id);
      setIsConnected(true);
      
      // Fetch active alerts ketika komponen pertama kali dipasang dan socket sudah terhubung
      fetchActiveAlerts();
    } else {
      console.log('[useSocket] Socket is not connected, attempting to connect...');
      socket.connect();
    }

    // Cleanup pada unmount
    return () => {
      console.log('[useSocket] Cleaning up event listeners');
      
      socket?.off('connect', onConnect);
      socket?.off('disconnect', onDisconnect);
      socket?.off('connect_error', onConnectError);
      socket?.off(SOCKET_EVENTS.STOCK_ALERT, onStockAlert);
      socket?.off(SOCKET_EVENTS.STOCK_ALERT_CLEARED, onStockAlertCleared);
      socket?.off(SOCKET_EVENTS.STOCK_UPDATE, onStockUpdate);
      socket?.off(SOCKET_EVENTS.PRODUCT_LOW_STOCK, onProductLowStock);
      
      // Jangan disconnect socket di sini untuk menjaga koneksi persisten
    };
  }, [dismissAlertByProductId, fetchActiveAlerts]);

  // Expose context values
  const value = {
    isConnected,
    stockAlerts,
    lowStockCount,
    markAlertAsRead,
    markAllAlertsAsRead,
    dismissAlert,
    dismissAllAlerts
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
} 