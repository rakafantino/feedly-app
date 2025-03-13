import { Server as SocketIOServer } from 'socket.io';
import { SOCKET_EVENTS } from './socket';
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

// Durasi cooldown untuk alert yang sama (15 menit)
const ALERT_COOLDOWN_MS = 15 * 60 * 1000;

/**
 * Memeriksa apakah produk memiliki stok di bawah threshold
 */
export function checkLowStock(product: Product): boolean {
  if (product.threshold === undefined || product.threshold === null) {
    return false;
  }
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
  
  // Hapus alert jika stok sudah di atas threshold
  if (product.threshold === null || product.threshold === undefined || product.stock > product.threshold) {
    console.log(`[stockAlert] Clearing alert for ${product.name}, stock now above threshold`);
    
    // Hapus dari map
    activeAlerts.delete(product.id);
    sentAlerts.delete(product.id);
    
    // Kirim notifikasi ke client bahwa alert telah dihapus
    io.emit(SOCKET_EVENTS.STOCK_ALERT_CLEARED, {
      productId: product.id,
      productName: product.name
    });
    
    // Update jumlah produk dengan stok rendah
    const remainingLowStockCount = activeAlerts.size;
    io.emit(SOCKET_EVENTS.STOCK_UPDATE, {
      count: remainingLowStockCount
    });
    
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
  
  // Kirim melalui socket.io
  io.emit(SOCKET_EVENTS.STOCK_ALERT, alert);
  
  console.log(`[stockAlert] Sending product low stock for ${product.name}, event: ${SOCKET_EVENTS.PRODUCT_LOW_STOCK}`);
  
  io.emit(SOCKET_EVENTS.PRODUCT_LOW_STOCK, {
    count: 1, 
    product: product.name
  });

  // Catat bahwa alert sudah dikirim dan simpan sebagai alert aktif
  sentAlerts.set(product.id, now);
  activeAlerts.set(product.id, alert);
  
  console.log(`[stockAlert] Low stock alert sent for ${product.name}`);
  return true;
}

/**
 * Memeriksa beberapa produk sekaligus untuk stok rendah dan mengirim alert
 */
export function checkProductsAndSendAlerts(io: SocketIOServer, products: Product[]): number {
  console.log(`[stockAlert] Checking ${products.length} products for stock alerts`);
  
  let alertsSent = 0;
  
  products.forEach(product => {
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
 * Menghapus alert untuk produk yang dihapus (terlepas dari kondisi stok)
 */
export function deleteProductAlerts(io: SocketIOServer, productId: string): boolean {
  console.log(`[stockAlert] Forcing delete of alert for product ID: ${productId}`);
  
  // Cek jika ada alert aktif untuk produk ini
  if (!activeAlerts.has(productId)) {
    console.log(`[stockAlert] No active alert for product ID: ${productId}`);
    return false;
  }
  
  // Simpan nama produk sebelum dihapus untuk log
  const productName = activeAlerts.get(productId)?.productName || 'Unknown Product';
  
  // Hapus dari kedua map
  activeAlerts.delete(productId);
  sentAlerts.delete(productId);
  
  // Kirim notifikasi yang eksplisit ke client bahwa alert telah dihapus
  console.log(`[stockAlert] Sending explicit STOCK_ALERT_CLEARED for deleted product: ${productName}`);
  io.emit(SOCKET_EVENTS.STOCK_ALERT_CLEARED, {
    productId,
    productName
  });
  
  // Update jumlah produk dengan stok rendah
  const remainingLowStockCount = activeAlerts.size;
  io.emit(SOCKET_EVENTS.STOCK_UPDATE, {
    count: remainingLowStockCount
  });
  
  console.log(`[stockAlert] Alert successfully deleted for product ID: ${productId}`);
  return true;
} 