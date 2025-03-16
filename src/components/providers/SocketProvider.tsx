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
// Buffer untuk menyimpan event penting saat koneksi terputus
const eventBuffer: {eventName: string, data: any}[] = [];
const MAX_BUFFER_SIZE = 20;

export function SocketProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [stockAlerts, setStockAlerts] = useState<StockAlertNotification[]>([]);
  const [lowStockCount, setLowStockCount] = useState<number>(0);

  // Fungsi untuk mengirim event dengan buffer jika tidak terhubung
  const sendEvent = useCallback((eventName: string, data: any) => {
    if (socket && isConnected) {
      socket.emit(eventName, data);
      console.log(`[useSocket] Event sent: ${eventName}`, data);
    } else {
      // Simpan ke buffer jika koneksi terputus
      if (eventBuffer.length < MAX_BUFFER_SIZE) {
        eventBuffer.push({ eventName, data });
        console.log(`[useSocket] Event buffered: ${eventName}`, data);
      }
    }
  }, [isConnected]);

  // Fungsi untuk memproses event buffer saat koneksi terhubung kembali
  const processEventBuffer = useCallback(() => {
    if (socket && isConnected && eventBuffer.length > 0) {
      console.log(`[useSocket] Processing ${eventBuffer.length} buffered events`);
      
      while (eventBuffer.length > 0) {
        const event = eventBuffer.shift();
        if (event) {
          socket.emit(event.eventName, event.data);
          console.log(`[useSocket] Sending buffered event: ${event.eventName}`);
        }
      }
    }
  }, [isConnected]);

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

        // Perbarui alerts di state
        setStockAlerts(formattedAlerts);
        
        // Perbarui juga jumlah alert
        setLowStockCount(formattedAlerts.length);
        
        // Gunakan sendEvent untuk memancarkan update ke komponen lain jika diperlukan
        if (formattedAlerts.length > 0) {
          sendEvent(SOCKET_EVENTS.STOCK_UPDATE, { count: formattedAlerts.length });
        }
      }
    } catch (error) {
      console.error('[useSocket] Error fetching active alerts:', error);
    }
  }, [sendEvent]);

  // Fungsi untuk melakukan inisialisasi penuh notifikasi stok
  const initializeStockAlerts = useCallback(async () => {
    try {
      // Panggil API stock-alerts dengan forceUpdate
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
        throw new Error('Failed to initialize stock alerts');
      }
      
      // Setelah inisialisasi, muat kembali daftar alert
      await fetchActiveAlerts();
      
      console.log('[useSocket] Stock alerts initialized successfully');
    } catch (error) {
      console.error('[useSocket] Error initializing stock alerts:', error);
    }
  }, [fetchActiveAlerts]);

  // Setup socket connection dan event listeners
  useEffect(() => {
    console.log('[useSocket] Setting up Socket.io connection');

    if (typeof window === 'undefined') {
      console.log('[useSocket] Running on server, skipping socket setup');
      return;
    }
    
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    const reconnectInterval = 3000;
    let reconnectTimer: NodeJS.Timeout | null = null;
    
    // Fungsi untuk melakukan koneksi ulang secara manual dengan exponential backoff
    const manualReconnect = () => {
      if (reconnectAttempts >= maxReconnectAttempts) {
        console.log(`[useSocket] Reached max reconnect attempts (${maxReconnectAttempts})`);
        return;
      }
      
      if (reconnectTimer) clearTimeout(reconnectTimer);
      
      const delay = Math.min(30000, reconnectInterval * Math.pow(1.5, reconnectAttempts));
      console.log(`[useSocket] Attempting to reconnect in ${delay}ms (attempt ${reconnectAttempts + 1}/${maxReconnectAttempts})`);
      
      reconnectTimer = setTimeout(() => {
        console.log(`[useSocket] Manual reconnect attempt ${reconnectAttempts + 1}`);
        reconnectAttempts++;
        
        if (socket) {
          // Jika socket masih ada, coba connect
          if (!socket.connected) {
            socket.connect();
          }
        } else {
          // Jika tidak ada socket, buat baru
          initializeSocket();
        }
      }, delay);
    };
    
    // Fungsi untuk menginisialisasi socket
    const initializeSocket = () => {
      // Jika socket sudah ada dan terhubung, gunakan itu
      if (socket && socket.connected) {
        console.log('[useSocket] Socket already connected, id:', socket.id);
        setIsConnected(true);
        return;
      }
      
      // Preparasi URL
      const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
      const host = window.location.host;
      
      console.log(`[useSocket] Initializing socket with baseUrl: ${protocol}//${host}`);
      
      // Destroy existing socket if exists but not connected
      if (socket) {
        console.log('[useSocket] Cleaning up existing socket instance');
        socket.close();
      }
      
      // Inisialisasi socket baru dengan opsi yang lebih robust
      socket = io(`${protocol}//${host}`, {
        path: '/api/socketio',
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 30000,
        autoConnect: true,
        forceNew: true // Penting untuk memastikan instansi yang bersih
      });
      
      console.log('[useSocket] Socket initialized');
    };
    
    // Reset state saat komponen dipasang
    setIsConnected(false);
    
    // Inisialisasi socket jika belum ada
    if (!socket) {
      initializeSocket();
    }
    
    // Fungsi event handlers
    const onConnect = () => {
      console.log('[useSocket] Socket connected with ID:', socket?.id);
      setIsConnected(true);
      reconnectAttempts = 0; // Reset reconnect counter on successful connection
      
      // Proses event yang di-buffer
      processEventBuffer();
      
      // Ketika socket terhubung, kita melakukan inisialisasi penuh notifikasi dengan timeout
      // untuk memastikan server siap menerima permintaan
      setTimeout(() => {
        initializeStockAlerts();
      }, 500);
    };
    
    const onDisconnect = (reason: string) => {
      console.log(`[useSocket] Socket disconnected: ${reason}`);
      setIsConnected(false);
      
      // Inisiasi reconnect manual untuk kondisi tertentu yang diketahui bermasalah
      if (
        reason === 'io server disconnect' || 
        reason === 'transport close' ||
        reason === 'transport error' ||
        reason === 'ping timeout' ||
        reason === 'server namespace disconnect'
      ) {
        manualReconnect();
      }
    };
    
    const onConnectError = (error: Error) => {
      console.error('[useSocket] Connection error:', error.message);
      setIsConnected(false);
      manualReconnect();
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
      
      // Update state keduanya - hapus alert dan kurangi counter secara bersamaan
      setStockAlerts((prev) => {
        const filteredAlerts = prev.filter((alert) => alert.productId !== data.productId);
        
        // Update counter berdasarkan jumlah alert yang tersisa
        setLowStockCount(filteredAlerts.length);
        
        return filteredAlerts;
      });
    };

    const onStockUpdate = (data: { count: number }) => {
      console.log('[useSocket] Received stock count update:', data);
      
      // Hanya update counter jika nilainya berbeda untuk menghindari re-render yang tidak perlu
      setLowStockCount(prevCount => {
        if (prevCount !== data.count) {
          console.log(`[useSocket] Updating stock count from ${prevCount} to ${data.count}`);
          return data.count;
        }
        return prevCount;
      });
      
      // Jika count adalah 0, pastikan tidak ada alert yang tersisa
      if (data.count === 0 && stockAlerts.length > 0) {
        console.log('[useSocket] Count is 0, clearing all alerts');
        setStockAlerts([]);
      }
    };

    const onProductLowStock = (data: { product: string, count: number }) => {
      console.log('[useSocket] Product low stock:', data);
    };
    
    // Daftar semua listeners jika socket ada
    if (socket) {
      socket.on('connect', onConnect);
      socket.on('disconnect', onDisconnect);
      socket.on('connect_error', onConnectError);
      socket.on(SOCKET_EVENTS.STOCK_ALERT, onStockAlert);
      socket.on(SOCKET_EVENTS.STOCK_ALERT_CLEARED, onStockAlertCleared);
      socket.on(SOCKET_EVENTS.STOCK_UPDATE, onStockUpdate);
      socket.on(SOCKET_EVENTS.PRODUCT_LOW_STOCK, onProductLowStock);

      // Fetch active alerts ketika komponen pertama kali dipasang
      // Gunakan timeout untuk memastikan semua inisialisasi selesai
      setTimeout(() => {
        fetchActiveAlerts();
      }, 1000);
      
      // Update status koneksi awal
      if (socket.connected) {
        console.log('[useSocket] Socket is already connected with ID:', socket.id);
        setIsConnected(true);
      } else {
        console.log('[useSocket] Socket is not connected, attempting to connect...');
        socket.connect();
      }
    }

    // Cleanup pada unmount
    return () => {
      console.log('[useSocket] Cleaning up event listeners');
      
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      
      if (socket) {
        socket.off('connect', onConnect);
        socket.off('disconnect', onDisconnect);
        socket.off('connect_error', onConnectError);
        socket.off(SOCKET_EVENTS.STOCK_ALERT, onStockAlert);
        socket.off(SOCKET_EVENTS.STOCK_ALERT_CLEARED, onStockAlertCleared);
        socket.off(SOCKET_EVENTS.STOCK_UPDATE, onStockUpdate);
        socket.off(SOCKET_EVENTS.PRODUCT_LOW_STOCK, onProductLowStock);
      }
      
      // Jangan disconnect socket di sini untuk menjaga koneksi persisten
    };
  }, [dismissAlertByProductId, initializeStockAlerts, fetchActiveAlerts, processEventBuffer, stockAlerts.length]);

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