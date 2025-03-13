'use client';

import React, { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import io, { Socket } from 'socket.io-client';
import { SOCKET_EVENTS } from '@/lib/socket';

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

  // Fungsi untuk menghapus semua alert
  const dismissAllAlerts = useCallback(() => {
    console.log('[useSocket] Dismissing all alerts');
    setStockAlerts([]);
  }, []);

  useEffect(() => {
    console.log('[useSocket] Setting up Socket.io connection');
    
    // Inisialisasi socket connection jika belum ada
    if (!socket) {
      // Gunakan secure connection di production
      const host = window.location.host;
      const baseUrl = `${window.location.protocol}//${host}`;
      
      console.log(`[useSocket] Initializing socket with baseUrl: ${baseUrl}`);
      
      // Inisialisasi socket
      socket = io(baseUrl, {
        path: '/api/socketio',
        transports: ['websocket', 'polling'],
      });
      
      console.log('[useSocket] Socket initialized');
    } else {
      console.log('[useSocket] Socket already initialized');
    }

    // Setup event listeners
    if (socket) {
      console.log('[useSocket] Setting up event listeners');
      
      socket.on('connect', () => {
        console.log('[useSocket] Socket connected with ID:', socket?.id);
        setIsConnected(true);
      });

      socket.on('disconnect', () => {
        console.log('[useSocket] Socket disconnected');
        setIsConnected(false);
      });

      socket.on('connect_error', (error) => {
        console.error('[useSocket] Connection error:', error);
      });

      // Listen for stock alerts
      socket.on(SOCKET_EVENTS.STOCK_ALERT, (alert: StockAlertNotification) => {
        console.log('[useSocket] Received stock alert:', alert);
        setStockAlerts((prev) => [alert, ...prev]);
      });

      // Listen for stock count updates
      socket.on(SOCKET_EVENTS.STOCK_UPDATE, (data: { count: number }) => {
        console.log('[useSocket] Received stock count update:', data);
        setLowStockCount(data.count);
      });
      
      // Listen for product running out of stock
      socket.on(SOCKET_EVENTS.PRODUCT_LOW_STOCK, (data: { product: string, count: number }) => {
        console.log('[useSocket] Product low stock:', data);
      });
      
      // Cek apakah socket sudah terhubung
      if (socket.connected) {
        console.log('[useSocket] Socket is already connected with ID:', socket.id);
        setIsConnected(true);
      } else {
        console.log('[useSocket] Socket is not connected yet, waiting for connect event');
      }
      
      // Trigger reconnection if socket is not connected
      if (!socket.connected) {
        socket.connect();
      }
    }

    // Cleanup event listeners on component unmount
    return () => {
      console.log('[useSocket] Cleaning up event listeners');
      if (socket) {
        socket.off('connect');
        socket.off('disconnect');
        socket.off('connect_error');
        socket.off(SOCKET_EVENTS.STOCK_ALERT);
        socket.off(SOCKET_EVENTS.STOCK_UPDATE);
        socket.off(SOCKET_EVENTS.PRODUCT_LOW_STOCK);
      }
    };
  }, []);

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