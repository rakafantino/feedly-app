import { Server as SocketIOServer } from 'socket.io';
import { SOCKET_EVENTS, invalidateStockCache } from './socket';
import { Product } from '@/store/useProductStore';

// Tipe untuk notifikasi stok
export interface StockAlert {
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

// Menyimpan alert yang sudah dikirim untuk mencegah duplikasi
const sentAlerts = new Map<string, Date>();

// Simpan alerts aktif berdasarkan productId
const activeAlerts = new Map<string, StockAlert>();

// Durasi cooldown untuk alert yang sama (10 menit, dikurangi dari 15 menit)
const ALERT_COOLDOWN_MS = 10 * 60 * 1000;

// Retry mechanism untuk pengiriman notifikasi
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 500;

// Cache untuk status stok produk terakhir
const productStockCache = new Map<string, {
  lastChecked: Date;
  stock: number;
  threshold: number | undefined;
}>();

/**
 * Memeriksa apakah produk memiliki stok di bawah threshold
 */
export function checkLowStock(product: Product): boolean {
  if (product.threshold === undefined || product.threshold === null) {
    return false;
  }
  
  // Perbarui cache stok
  productStockCache.set(product.id, {
    lastChecked: new Date(),
    stock: product.stock,
    threshold: product.threshold
  });
  
  return product.stock <= product.threshold;
}

/**
 * Menghapus notifikasi stok rendah ketika stok sudah normal
 */
export function clearProductAlert(io: SocketIOServer, product: Product): boolean {
  console.log(`[stockAlert] Checking if alert should be cleared for ${product.name}`);
  
  // Jika tidak ada alert aktif untuk produk ini, tidak perlu melakukan apa-apa
  if (!activeAlerts.has(product.id)) {
    console.log(`[stockAlert] No active alert for ${product.name}`);
    return false;
  }
  
  // Perbarui cache stok
  productStockCache.set(product.id, {
    lastChecked: new Date(),
    stock: product.stock,
    threshold: product.threshold
  });
  
  // Hapus alert jika stok sudah di atas threshold
  if (product.threshold === null || product.threshold === undefined || product.stock > product.threshold) {
    console.log(`[stockAlert] Clearing alert for ${product.name}, stock now above threshold (${product.stock} > ${product.threshold})`);
    
    // Simpan productId sebelum dihapus
    const productId = product.id;
    const productName = product.name;
    
    // Hapus dari map
    activeAlerts.delete(productId);
    sentAlerts.delete(productId);
    
    // Hitung jumlah alert yang tersisa
    const remainingLowStockCount = activeAlerts.size;
    
    // Log jumlah alert yang tersisa untuk debugging
    console.log(`[stockAlert] Remaining low stock count: ${remainingLowStockCount}`);
    
    // Retry mechanism for event emission
    let retryAttempt = 0;
    
    const emitClearedAlert = () => {
      try {
        // Kirim notifikasi ke client bahwa alert telah dihapus
        // Penting: emitkan event ini SEBELUM event STOCK_UPDATE
        io.emit(SOCKET_EVENTS.STOCK_ALERT_CLEARED, {
          productId,
          productName
        });
        
        console.log(`[stockAlert] Successfully emitted STOCK_ALERT_CLEARED for ${productName}`);
        
        // Berikan sedikit delay agar event STOCK_ALERT_CLEARED diproses terlebih dahulu
        setTimeout(() => {
          // Update jumlah produk dengan stok rendah
          io.emit(SOCKET_EVENTS.STOCK_UPDATE, {
            count: remainingLowStockCount
          });
          
          console.log(`[stockAlert] Successfully emitted STOCK_UPDATE with count: ${remainingLowStockCount}`);
        }, 100);
      } catch (error) {
        console.error(`[stockAlert] Error emitting socket event (attempt ${retryAttempt + 1}):`, error);
        
        if (retryAttempt < MAX_RETRY_ATTEMPTS) {
          retryAttempt++;
          console.log(`[stockAlert] Retrying in ${RETRY_DELAY_MS}ms (attempt ${retryAttempt}/${MAX_RETRY_ATTEMPTS})`);
          setTimeout(emitClearedAlert, RETRY_DELAY_MS);
        }
      }
    };
    
    // Start emission with retry support
    emitClearedAlert();
    
    // Invalidasi cache stok
    invalidateStockCache();
    
    return true;
  }
  
  return false;
}

/**
 * Mengirim notifikasi stok rendah via WebSocket
 */
export function sendLowStockAlert(io: SocketIOServer, product: Product): boolean {
  console.log(`[stockAlert] Checking product: ${product.name}, stock: ${product.stock}, threshold: ${product.threshold}`);
  
  if (!checkLowStock(product)) {
    // Jika stok sudah normal, hapus alert yang mungkin ada
    clearProductAlert(io, product);
    console.log(`[stockAlert] Product ${product.name} does not have low stock`);
    return false;
  }

  // Cek jika alert untuk produk ini sudah dikirim baru-baru ini
  const lastAlertTime = sentAlerts.get(product.id);
  const now = new Date();
  
  // Jika ada alert aktif, periksa cooldown
  if (activeAlerts.has(product.id) && lastAlertTime && 
      (now.getTime() - lastAlertTime.getTime() < ALERT_COOLDOWN_MS)) {
    console.log(`[stockAlert] Skipping alert for ${product.name}, still in cooldown period`);
    return false;
  }

  // Buat objek alert
  const alert: StockAlert = {
    id: `alert-${product.id}-${now.getTime()}`,
    productId: product.id,
    productName: product.name,
    currentStock: product.stock,
    threshold: product.threshold as number,
    unit: product.unit,
    timestamp: now,
    read: false,
    category: product.category
  };

  console.log(`[stockAlert] Sending stock alert for ${product.name}, event: ${SOCKET_EVENTS.STOCK_ALERT}`, alert);
  
  // Retry mechanism for event emission
  let retryAttempt = 0;
  
  const emitStockAlert = () => {
    try {
      // Kirim melalui socket.io
      io.emit(SOCKET_EVENTS.STOCK_ALERT, alert);
      console.log(`[stockAlert] Successfully emitted STOCK_ALERT for ${product.name}`);
      
      io.emit(SOCKET_EVENTS.PRODUCT_LOW_STOCK, {
        count: 1, 
        product: product.name
      });
      console.log(`[stockAlert] Successfully emitted PRODUCT_LOW_STOCK for ${product.name}`);
    } catch (error) {
      console.error(`[stockAlert] Error emitting socket event (attempt ${retryAttempt + 1}):`, error);
      
      if (retryAttempt < MAX_RETRY_ATTEMPTS) {
        retryAttempt++;
        console.log(`[stockAlert] Retrying in ${RETRY_DELAY_MS}ms (attempt ${retryAttempt}/${MAX_RETRY_ATTEMPTS})`);
        setTimeout(emitStockAlert, RETRY_DELAY_MS);
      }
    }
  };
  
  // Start emission with retry support
  emitStockAlert();

  // Catat bahwa alert sudah dikirim dan simpan sebagai alert aktif
  sentAlerts.set(product.id, now);
  activeAlerts.set(product.id, alert);
  
  // Invalidasi cache stok setelah mengirim alert
  invalidateStockCache();
  
  console.log(`[stockAlert] Low stock alert sent for ${product.name}`);
  return true;
}

/**
 * Mendapatkan produk yang perlu diperiksa berdasarkan update dalam database
 * @param productId ID produk yang diperbarui
 * @param force Force check meskipun tidak ada dalam cache
 */
export function getProductsToCheck(products: Product[], updatedProductId?: string, force: boolean = false): Product[] {
  if (!updatedProductId || force) {
    // Jika tidak ada ID produk yang diperbarui atau force=true, periksa semua produk
    return products;
  }
  
  // Cari produk yang diperbarui
  const updatedProduct = products.find(p => p.id === updatedProductId);
  
  if (!updatedProduct) {
    console.log(`[stockAlert] Product with ID ${updatedProductId} not found for checking`);
    return [];
  }
  
  // Cek apakah produk ini ada di cache
  const cachedProduct = productStockCache.get(updatedProductId);
  
  if (!cachedProduct) {
    // Jika tidak ada di cache, periksa produk ini
    console.log(`[stockAlert] No cache for product ${updatedProduct.name}, will check`);
    return [updatedProduct];
  }
  
  // Periksa jika stok atau threshold berubah
  if (cachedProduct.stock !== updatedProduct.stock || 
      cachedProduct.threshold !== updatedProduct.threshold) {
    console.log(`[stockAlert] Stock or threshold changed for ${updatedProduct.name}, will check`);
    return [updatedProduct];
  }
  
  console.log(`[stockAlert] No change in stock/threshold for ${updatedProduct.name}, skipping check`);
  return [];
}

/**
 * Memeriksa beberapa produk sekaligus untuk stok rendah dan mengirim alert
 */
export function checkProductsAndSendAlerts(io: SocketIOServer, products: Product[], updatedProductId?: string): number {
  console.log(`[stockAlert] Checking ${products.length} products for stock alerts`);
  
  // Tentukan produk mana yang perlu diperiksa
  const productsToCheck = updatedProductId 
    ? getProductsToCheck(products, updatedProductId)
    : products;
  
  console.log(`[stockAlert] Will check ${productsToCheck.length} out of ${products.length} products`);
  
  let alertsSent = 0;
  
  productsToCheck.forEach(product => {
    // Periksa apakah perlu mengirim alert atau menghapus alert
    if (checkLowStock(product)) {
      if (sendLowStockAlert(io, product)) {
        alertsSent++;
      }
    } else {
      clearProductAlert(io, product);
    }
  });
  
  console.log(`[stockAlert] Total alerts sent: ${alertsSent}`);
  return alertsSent;
}

/**
 * Mendapatkan daftar semua alert aktif
 */
export function getActiveAlerts(): StockAlert[] {
  return Array.from(activeAlerts.values());
}

/**
 * Menghapus alert untuk produk tertentu dengan eksplisit
 */
export function deleteProductAlerts(io: SocketIOServer, productId: string): boolean {
  console.log(`[stockAlert] Forcing delete of alert for product ID: ${productId}`);
  
  // Jika tidak ada alert aktif untuk produk ini, tidak perlu melakukan apa-apa
  if (!activeAlerts.has(productId)) {
    console.log(`[stockAlert] No active alert for product ID: ${productId}`);
    return false;
  }
  
  // Simpan alert untuk memberi tahu klien
  const alert = activeAlerts.get(productId);
  
  if (!alert) {
    return false;
  }
  
  // Hapus dari map
  activeAlerts.delete(productId);
  sentAlerts.delete(productId);
  
  // Hitung jumlah alert yang tersisa
  const remainingLowStockCount = activeAlerts.size;
  
  // Log jumlah alert yang tersisa untuk debugging
  console.log(`[stockAlert] Remaining low stock count after explicit delete: ${remainingLowStockCount}`);
  
  // Retry mechanism for event emission
  let retryAttempt = 0;
  
  const emitClearedAlert = () => {
    try {
      // Kirim notifikasi ke client bahwa alert telah dihapus
      io.emit(SOCKET_EVENTS.STOCK_ALERT_CLEARED, {
        productId: alert.productId,
        productName: alert.productName
      });
      
      console.log(`[stockAlert] Successfully emitted STOCK_ALERT_CLEARED for ${alert.productName} (explicit delete)`);
      
      // Berikan sedikit delay agar event STOCK_ALERT_CLEARED diproses terlebih dahulu
      setTimeout(() => {
        // Update jumlah produk dengan stok rendah
        io.emit(SOCKET_EVENTS.STOCK_UPDATE, {
          count: remainingLowStockCount
        });
        
        console.log(`[stockAlert] Successfully emitted STOCK_UPDATE with count: ${remainingLowStockCount} (explicit delete)`);
      }, 100);
    } catch (error) {
      console.error(`[stockAlert] Error emitting socket event on explicit delete (attempt ${retryAttempt + 1}):`, error);
      
      if (retryAttempt < MAX_RETRY_ATTEMPTS) {
        retryAttempt++;
        console.log(`[stockAlert] Retrying in ${RETRY_DELAY_MS}ms (attempt ${retryAttempt}/${MAX_RETRY_ATTEMPTS})`);
        setTimeout(emitClearedAlert, RETRY_DELAY_MS);
      }
    }
  };
  
  // Start emission with retry support
  emitClearedAlert();
  
  // Invalidasi cache stok
  invalidateStockCache();
  
  return true;
} 