import { NextApiRequest } from 'next';
import { initSocketServer, NextApiResponseWithSocket } from '@/lib/socket';

export default function handler(
  req: NextApiRequest,
  res: NextApiResponseWithSocket
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Inisialisasi socket server jika belum ada
    initSocketServer(res);
    
    res.status(200).json({ success: true, message: 'Socket.io server is running' });
  } catch (error) {
    console.error('Socket initialization error:', error);
    res.status(500).json({ error: 'Failed to initialize socket.io server' });
  }
}

// Konfig khusus untuk WebSocket
export const config = {
  api: {
    bodyParser: false,
  },
}; 