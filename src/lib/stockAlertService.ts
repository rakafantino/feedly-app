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
 * Mengirim notifikasi stok rendah via WebSocket
 */
export function sendLowStockAlert(io: SocketIOServer, product: Product): boolean {
  console.log(`[stockAlert] Checking product: ${product.name}, stock: ${product.stock}, threshold: ${product.threshold}`);
  
  if (!checkLowStock(product)) {
    console.log(`[stockAlert] Product ${product.name} does not have low stock`);
    return false;
  }

  // Cek jika alert untuk produk ini sudah dikirim baru-baru ini
  const lastAlertTime = sentAlerts.get(product.id);
  const now = new Date();
  
  if (lastAlertTime && (now.getTime() - lastAlertTime.getTime() < ALERT_COOLDOWN_MS)) {
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

  // Catat bahwa alert sudah dikirim
  sentAlerts.set(product.id, now);
  
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
    if (sendLowStockAlert(io, product)) {
      alertsSent++;
    }
  });
  
  console.log(`[stockAlert] Total alerts sent: ${alertsSent}`);
  return alertsSent;
} 