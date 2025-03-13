import type { NextApiRequest } from 'next';
import { NextApiResponseWithSocket, initSocketServer, SOCKET_EVENTS } from '@/lib/socket';
import { checkProductsAndSendAlerts } from '@/lib/stockAlertService';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponseWithSocket
) {
  // Hanya menerima POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Inisialisasi socket server
    const io = initSocketServer(res);
    console.log('[stock-alerts] Socket server initialized, events:', SOCKET_EVENTS);
    
    // Dapatkan daftar produk dari request body
    const { products } = req.body;
    
    if (!products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: 'No products provided' });
    }
    
    console.log(`[stock-alerts] Checking ${products.length} products for low stock alerts`);
    
    // Cek produk dan kirim notifikasi jika stok rendah
    const alertsSent = checkProductsAndSendAlerts(io, products);
    
    console.log(`[stock-alerts] Alerts sent: ${alertsSent}`);
    
    // Kirim update jumlah produk dengan stok rendah ke semua client
    const lowStockCount = products.filter(p => p.threshold !== null && p.stock <= p.threshold).length;
    console.log(`[stock-alerts] Sending stock update with count: ${lowStockCount}, event: ${SOCKET_EVENTS.STOCK_UPDATE}`);
    
    io.emit(SOCKET_EVENTS.STOCK_UPDATE, {
      count: lowStockCount
    });
    
    return res.status(200).json({ 
      success: true, 
      message: `Checked ${products.length} products, sent ${alertsSent} alerts` 
    });
  } catch (error) {
    console.error('Error processing stock alerts:', error);
    return res.status(500).json({ error: 'Failed to process stock alerts' });
  }
} 