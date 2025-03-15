import type { NextApiRequest } from 'next';
import { NextApiResponseWithSocket, initSocketServer, SOCKET_EVENTS, getLowStockCache, setLowStockCache, invalidateStockCache } from '@/lib/socket';
import { checkProductsAndSendAlerts, getActiveAlerts, deleteProductAlerts } from '@/lib/stockAlertService';
import prisma from '@/lib/prisma';

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
      
      // Invalidasi cache saat alert dihapus
      invalidateStockCache();
      
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
    // Periksa jika ada parameter forceUpdate
    const { forceUpdate, products, bypassCache } = req.body;
    
    // Jika forceUpdate ditentukan, akses produk langsung dari database
    if (forceUpdate) {
      console.log('[stock-alerts] Force update requested, checking cache first');
      
      // Cek cache terlebih dahulu jika tidak ada parameter bypassCache
      if (!bypassCache) {
        const cachedProducts = getLowStockCache();
        if (cachedProducts && cachedProducts.length > 0) {
          console.log(`[stock-alerts] Using ${cachedProducts.length} products from cache`);
          
          // Periksa semua produk dan perbarui alerts
          const alertsSent = checkProductsAndSendAlerts(io, cachedProducts);
          
          // Ambil daftar alert aktif setelah diperbarui
          const activeAlerts = getActiveAlerts();
          
          // Pastikan hitungan jumlah alert akurat
          const actualAlertCount = activeAlerts.length;
          console.log(`[stock-alerts] Current active alerts: ${actualAlertCount}`);
          
          // Kirim update jumlah produk dengan stok rendah
          // dengan delay kecil untuk memastikan event sebelumnya telah diproses
          setTimeout(() => {
            io.emit(SOCKET_EVENTS.STOCK_UPDATE, {
              count: actualAlertCount
            });
            console.log(`[stock-alerts] Sent stock update with count: ${actualAlertCount}`);
          }, 100);
          
          return res.status(200).json({ 
            success: true,
            cached: true,
            message: `Used cached data: ${cachedProducts.length} products, ${alertsSent} alerts sent, ${actualAlertCount} active alerts`,
            products: cachedProducts.length,
            activeAlertCount: actualAlertCount
          });
        }
      }
      
      try {
        console.log('[stock-alerts] Fetching low stock products from database');
        // Ambil produk dengan stok rendah langsung dari database
        const lowStockProducts = await prisma.product.findMany({
          where: {
            isDeleted: false,
            OR: [
              // Produk dengan threshold yang ditentukan dan stok <= threshold
              {
                NOT: { threshold: null },
                stock: {
                  lte: prisma.product.fields.threshold
                }
              },
              // Produk tanpa threshold tapi stok <= 5 (default threshold)
              {
                threshold: null,
                stock: { lte: 5 }
              }
            ]
          },
          orderBy: {
            stock: 'asc'
          }
        });
        
        console.log(`[stock-alerts] Fetched ${lowStockProducts.length} low stock products directly from DB`);
        
        // Konversi format produk dari Prisma ke format yang diharapkan oleh checkProductsAndSendAlerts
        const formattedProducts = lowStockProducts.map(product => ({
          id: product.id,
          name: product.name,
          category: product.category,
          price: product.price,
          stock: product.stock,
          unit: product.unit,
          supplier_id: product.supplierId || null,
          description: product.description || undefined,
          barcode: product.barcode || undefined,
          threshold: product.threshold === null ? undefined : product.threshold,
          // Convert Date objects to Date objects (not strings)
          createdAt: product.createdAt,
          updatedAt: product.updatedAt
        }));
        
        // Simpan ke cache untuk penggunaan selanjutnya
        setLowStockCache(formattedProducts);
        
        // Periksa semua produk dan perbarui alerts
        const alertsSent = checkProductsAndSendAlerts(io, formattedProducts);
        
        // Ambil daftar alert aktif setelah diperbarui
        const activeAlerts = getActiveAlerts();
        
        // Pastikan hitungan jumlah alert akurat
        const actualAlertCount = activeAlerts.length;
        console.log(`[stock-alerts] Current active alerts: ${actualAlertCount}`);
        
        // Kirim update jumlah produk dengan stok rendah
        // dengan delay kecil untuk memastikan event sebelumnya telah diproses
        setTimeout(() => {
          io.emit(SOCKET_EVENTS.STOCK_UPDATE, {
            count: actualAlertCount
          });
          console.log(`[stock-alerts] Sent stock update with count: ${actualAlertCount}`);
        }, 100);
        
        return res.status(200).json({ 
          success: true, 
          message: `Force updated ${lowStockProducts.length} products, ${alertsSent} alerts sent, ${actualAlertCount} active alerts`,
          products: lowStockProducts.length,
          activeAlertCount: actualAlertCount
        });
      } catch (error) {
        console.error('[stock-alerts] Error in force update with direct DB access:', error);
        
        // Tidak throw error, coba menggunakan data dari request jika tersedia
        if (products && Array.isArray(products) && products.length > 0) {
          console.log(`[stock-alerts] Falling back to using ${products.length} products from request`);
          const alertsSent = checkProductsAndSendAlerts(io, products);
          const activeAlerts = getActiveAlerts();
          io.emit(SOCKET_EVENTS.STOCK_UPDATE, { count: activeAlerts.length });
          
          return res.status(200).json({
            success: true,
            message: `Used fallback: Checked ${products.length} products from request, sent ${alertsSent} alerts`,
            activeAlertCount: activeAlerts.length
          });
        }
        
        throw error;
      }
    }
    
    // Jika tidak menggunakan forceUpdate, lanjutkan dengan logika normal
    if (!products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: 'No products provided or invalid products format' });
    }
    
    console.log(`[stock-alerts] Checking ${products.length} products for low stock alerts`);
    
    // Cek produk dan kirim notifikasi jika stok rendah
    const alertsSent = checkProductsAndSendAlerts(io, products);
    
    console.log(`[stock-alerts] Alerts sent: ${alertsSent}`);
    
    // Invalidasi cache karena produk berubah
    invalidateStockCache();
    
    // Ambil daftar alert aktif setelah diperbarui
    const activeAlerts = getActiveAlerts();
    
    // Pastikan hitungan jumlah alert akurat
    const actualAlertCount = activeAlerts.length;
    console.log(`[stock-alerts] Current active alerts after update: ${actualAlertCount}`);
    
    // Kirim update jumlah produk dengan stok rendah ke semua client berdasarkan alerts aktif
    // Dengan delay kecil untuk memastikan event lain telah diproses
    setTimeout(() => {
      io.emit(SOCKET_EVENTS.STOCK_UPDATE, {
        count: actualAlertCount
      });
      console.log(`[stock-alerts] Sent stock update with count: ${actualAlertCount}`);
    }, 100);
    
    return res.status(200).json({ 
      success: true, 
      message: `Checked ${products.length} products, sent ${alertsSent} alerts`,
      activeAlertCount: actualAlertCount
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[stock-alerts] Error:', errorMessage);
    return res.status(500).json({ error: errorMessage });
  }
} 