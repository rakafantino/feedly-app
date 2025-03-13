import type { NextApiRequest } from 'next';
import { NextApiResponseWithSocket, initSocketServer, SOCKET_EVENTS } from '@/lib/socket';
import { checkProductsAndSendAlerts, getActiveAlerts, deleteProductAlerts } from '@/lib/stockAlertService';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponseWithSocket
) {
  // CORS headers untuk semua requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  // Handle OPTIONS requests (CORS preflight)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  // Inisialisasi socket server
  const io = initSocketServer(res);

  // Untuk GET requests, kirimkan daftar alert aktif
  if (req.method === 'GET') {
    const activeAlerts = getActiveAlerts();
    return res.status(200).json({ 
      success: true, 
      alerts: activeAlerts,
      count: activeAlerts.length
    });
  }

  // Untuk DELETE requests, hapus notifikasi produk tertentu
  if (req.method === 'DELETE') {
    try {
      const { productId } = req.query;
      
      if (!productId || typeof productId !== 'string') {
        return res.status(400).json({ error: 'productId is required' });
      }
      
      console.log(`[stock-alerts] Explicit DELETE request for product ID: ${productId}`);
      
      // Hapus notifikasi untuk produk yang dihapus
      const result = deleteProductAlerts(io, productId);
      
      return res.status(200).json({ 
        success: true, 
        message: `Alert ${result ? 'deleted' : 'not found'} for product ID: ${productId}`,
        deleted: result
      });
    } catch (error) {
      console.error('[stock-alerts] Error deleting alert:', error);
      return res.status(500).json({ error: 'Failed to delete alert' });
    }
  }
  
  // Hanya menerima POST requests selanjutnya
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Dapatkan daftar produk dari request body
    const { products } = req.body;
    
    if (!products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: 'No products provided or invalid products format' });
    }
    
    console.log(`[stock-alerts] Checking ${products.length} products for low stock alerts`);
    
    // Cek produk dan kirim notifikasi jika stok rendah
    const alertsSent = checkProductsAndSendAlerts(io, products);
    
    console.log(`[stock-alerts] Alerts sent: ${alertsSent}`);
    
    // Ambil daftar alert aktif setelah diperbarui
    const activeAlerts = getActiveAlerts();
    
    // Kirim update jumlah produk dengan stok rendah ke semua client berdasarkan alerts aktif
    io.emit(SOCKET_EVENTS.STOCK_UPDATE, {
      count: activeAlerts.length
    });
    
    return res.status(200).json({ 
      success: true, 
      message: `Checked ${products.length} products, sent ${alertsSent} alerts`,
      activeAlertCount: activeAlerts.length
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[stock-alerts] Error:', errorMessage);
    return res.status(500).json({ error: errorMessage });
  }
} 