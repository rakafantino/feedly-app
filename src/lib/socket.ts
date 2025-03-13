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
    // Gunakan 'polling' dulu sebagai transport untuk memastikan kompatibilitas
    transports: ['polling', 'websocket'],
    // Konfigurasi CORS sederhana untuk menghindari masalah
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'OPTIONS'],
      credentials: true
    },
    // Memperpanjang waktu polling untuk menghindari disconnection yang cepat
    pingInterval: 25000,
    pingTimeout: 20000,
    // Disable browser client serving
    serveClient: false
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
      console.log(`[socket] Ping received from ${socket.id}`);
    });
  });

  // Error handling global untuk io
  io.engine.on('connection_error', (err) => {
    console.error('[socket] Connection error:', err);
  });

  console.log('Socket.io server berhasil diinisialisasi');
  return io;
}; 