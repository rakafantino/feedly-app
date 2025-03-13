import { NextApiRequest } from 'next';
import { initSocketServer, NextApiResponseWithSocket } from '@/lib/socket';

// Socket.io endpoint untuk mengizinkan polling
export default function handler(
  req: NextApiRequest,
  res: NextApiResponseWithSocket
) {
  // CORS headers untuk semua requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');

  // Handle OPTIONS requests (CORS preflight)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Inisialisasi socket.io server (variable tidak digunakan tapi perlu dipanggil)
    initSocketServer(res);
    
    // Engine.io polling response akan dikirim langsung oleh socket.io
    // Ketika req.method adalah 'GET' atau 'POST'
    
    // Jika req.url tidak menunjukkan engine.io polling (cth. health check)
    // maka kita bisa mengirimkan respons sukses reguler
    if (!req.url?.includes('engine.io')) {
      res.status(200).json({ ok: true });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[socketio] Error:', errorMessage);
    res.status(500).json({ error: errorMessage });
  }
}

// Socket.io memerlukan konfigurasi khusus
export const config = {
  api: {
    bodyParser: false,
  },
}; 