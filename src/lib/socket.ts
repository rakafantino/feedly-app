import { Server as NetServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { NextApiResponse } from 'next';

export type NextApiResponseWithSocket = NextApiResponse & {
  socket: {
    server: NetServer & {
      io?: SocketIOServer;
    };
  };
};

// Channels/Events yang tersedia
export const SOCKET_EVENTS = {
  STOCK_ALERT: 'stock:alert',
  STOCK_ALERT_CLEARED: 'stock:alert:cleared',
  STOCK_UPDATE: 'stock:update',
  PRODUCT_LOW_STOCK: 'product:lowStock',
};

// Cache untuk hasil query stok menipis
interface StockCache {
  data: any[];
  timestamp: number;
  valid: boolean;
}

// Cache stok menipis dengan TTL 30 detik
const lowStockCache: StockCache = {
  data: [],
  timestamp: 0,
  valid: false
};

// Reset cache saat stok diubah
export const invalidateStockCache = () => {
  console.log('[socket] Invalidating low stock cache');
  lowStockCache.valid = false;
};

// Ambil data dari cache jika masih valid
export const getLowStockCache = (): StockCache['data'] | null => {
  const now = Date.now();
  const cacheAge = now - lowStockCache.timestamp;
  
  // Cache valid jika kurang dari 30 detik dan ditandai valid
  if (lowStockCache.valid && cacheAge < 30000) {
    console.log(`[socket] Using cached low stock data (age: ${cacheAge}ms)`);
    return lowStockCache.data;
  }
  
  return null;
};

// Simpan data ke cache
export const setLowStockCache = (data: any[]) => {
  lowStockCache.data = data;
  lowStockCache.timestamp = Date.now();
  lowStockCache.valid = true;
  console.log(`[socket] Updated low stock cache with ${data.length} items`);
};

export const initSocketServer = (res: NextApiResponseWithSocket) => {
  // Socket.io sudah diinisialisasi
  if (res.socket.server.io) {
    console.log('Socket.io sudah diinisialisasi');
    return res.socket.server.io;
  }

  // Konfigurasi lebih sederhana dan dioptimalkan untuk Next.js
  const io = new SocketIOServer(res.socket.server, {
    path: '/api/socketio',
    // Jangan gunakan trailing slash di path
    addTrailingSlash: false,
    // Hapus opsi transports untuk menghindari masalah
    // transports: ['polling', 'websocket'],
    // Konfigurasi CORS sederhana untuk menghindari masalah
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'OPTIONS'],
      credentials: true
    },
    // Memperpanjang waktu ping untuk koneksi lebih stabil
    pingInterval: 10000,
    pingTimeout: 15000,
    // Disable browser client serving
    serveClient: false,
    // Tambahan untuk memperbaiki upgrade handling
    allowUpgrades: true,
    upgradeTimeout: 10000,
    connectTimeout: 45000
  });
  
  res.socket.server.io = io;

  // Setup dasar event listeners
  io.on('connection', (socket) => {
    console.log(`[socket] Socket connected: ${socket.id}`);

    socket.on('disconnect', (reason) => {
      console.log(`[socket] Socket disconnected: ${socket.id}, reason: ${reason}`);
    });
    
    socket.on('error', (error) => {
      console.error(`[socket] Socket error for ${socket.id}:`, error);
    });
    
    // Ping untuk memastikan koneksi tetap aktif
    socket.conn.on('ping', () => {
      // Kurangi logging untuk menghindari spam log
      // console.log(`[socket] Ping received from ${socket.id}`);
    });
  });

  // Error handling global untuk io
  io.engine.on('connection_error', (err) => {
    console.error('[socket] Connection error:', err);
  });

  console.log('Socket.io server berhasil diinisialisasi');
  return io;
}; 