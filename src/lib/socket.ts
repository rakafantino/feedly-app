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

export const initSocketServer = (res: NextApiResponseWithSocket) => {
  // Socket.io sudah diinisialisasi
  if (res.socket.server.io) {
    console.log('Socket.io sudah diinisialisasi');
    return res.socket.server.io;
  }

  // Inisialisasi Socket.io
  const io = new SocketIOServer(res.socket.server);
  res.socket.server.io = io;

  // Setup event listeners
  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  console.log('Socket.io server berhasil diinisialisasi');
  return io;
};

// Channels/Events yang tersedia
export const SOCKET_EVENTS = {
  STOCK_ALERT: 'stock:alert',
  STOCK_UPDATE: 'stock:update',
  PRODUCT_LOW_STOCK: 'product:lowStock',
}; 