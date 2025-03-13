import type { NextApiRequest } from 'next';
import { NextApiResponseWithSocket, initSocketServer, SOCKET_EVENTS } from '@/lib/socket';
import { checkProductsAndSendAlerts } from '@/lib/stockAlertService';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponseWithSocket
) {
  // CORS headers untuk semua requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  // Handle OPTIONS requests (CORS preflight)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  // Hanya menerima POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Inisialisasi socket server
    const io = initSocketServer(res);
    
    // Dapatkan daftar produk dari request body
    const { products } = req.body;
    
    if (!products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: 'No products provided or invalid products format' });
    }
    
    console.log(`[stock-alerts] Checking ${products.length} products for low stock alerts`);
    
    // Cek produk dan kirim notifikasi jika stok rendah
    const alertsSent = checkProductsAndSendAlerts(io, products);
    
    console.log(`[stock-alerts] Alerts sent: ${alertsSent}`);
    
    // Kirim update jumlah produk dengan stok rendah ke semua client
    const lowStockCount = products.filter(p => p.threshold !== null && p.stock <= p.threshold).length;
    
    io.emit(SOCKET_EVENTS.STOCK_UPDATE, {
      count: lowStockCount
    });
    
    return res.status(200).json({ 
      success: true, 
      message: `Checked ${products.length} products, sent ${alertsSent} alerts` 
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[stock-alerts] Error:', errorMessage);
    return res.status(500).json({ error: errorMessage });
  }
} 