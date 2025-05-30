/**
 * notificationService.ts
 * Layanan untuk menangani notifikasi stok menipis
 */

// Tipe untuk notifikasi stok
export interface StockNotification {
  id: string;
  productId: string;
  productName: string;
  currentStock: number;
  threshold: number;
  unit: string;
  timestamp: Date;
  read: boolean;
  category?: string;
  storeId: string;
  price?: number;
}

// Menyimpan notifikasi aktif untuk setiap toko
const notificationsStore: Record<string, StockNotification[]> = {};

// Cek apakah kode berjalan di browser
const isBrowser = typeof window !== 'undefined';

// Fungsi helper untuk mendapatkan PrismaClient hanya di server-side
async function getPrisma() {
  if (isBrowser) {
    throw new Error('Cannot use Prisma on the client');
  }
  const { PrismaClient } = await import('@prisma/client');
  return new PrismaClient();
}

/**
 * Mendapatkan notifikasi aktif untuk suatu toko
 */
export async function getStoreNotifications(storeId?: string | null): Promise<StockNotification[]> {
  console.log(`[NotificationService] Getting notifications for store: ${storeId || 'all'}`);
  
  if (isBrowser) {
    // Di browser, panggil API
    try {
      const url = new URL('/api/stock-alerts', window.location.origin);
      if (storeId) {
        url.searchParams.append('storeId', storeId);
      }
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch notifications');
      }
      const data = await response.json();
      return data.notifications || [];
    } catch (error) {
      console.error('Error fetching notifications:', error);
      return [];
    }
  }
  
  // Di server, gunakan data yang disimpan di memory
  if (!storeId) {
    // Kumpulkan semua notifikasi dari semua toko
    return Object.values(notificationsStore).flat();
  }
  
  // Dapatkan notifikasi untuk toko tertentu
  return notificationsStore[storeId] || [];
}

/**
 * Memeriksa produk stok rendah dan mengirim notifikasi
 */
export async function checkLowStockProducts(storeId?: string | null, forceCheck: boolean = false): Promise<{ count: number }> {
  console.log(`[NotificationService] Checking low stock products for store: ${storeId || 'all'}, forceCheck: ${forceCheck}`);

  if (isBrowser) {
    // Di browser, panggil API
    try {
      const response = await fetch('/api/stock-alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          storeId, 
          forceCheck 
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to check low stock products');
      }
      const data = await response.json();
      return { count: data.count || 0 };
    } catch (error) {
      console.error('Error checking low stock products:', error);
      return { count: 0 };
    }
  }

  try {
    // Di server, gunakan Prisma
    const prisma = await getPrisma();
    
    // Dapatkan produk dengan stok menipis dari database
    const products = await prisma.product.findMany({
      where: {
        ...(storeId ? { storeId } : {}),
        isDeleted: false,
        // Kondisi untuk stok di bawah threshold
        threshold: { not: null },
        stock: {
          lte: prisma.product.fields.threshold
        }
      },
      select: {
        id: true,
        name: true,
        stock: true,
        threshold: true,
        unit: true, 
        category: true,
        storeId: true,
        price: true
      }
    });

    console.log(`[NotificationService] Found ${products.length} low stock products for store: ${storeId || 'all'}`);
    
    // Dapatkan notifikasi yang ada untuk stok ini
    const storeNotifications = storeId ? notificationsStore[storeId] || [] : [];
    const now = new Date();
    
    // Array untuk menyimpan notifikasi baru
    const newNotifications: StockNotification[] = [];
    
    // Periksa setiap produk dengan stok rendah
    for (const product of products) {
      // Cek apakah sudah ada notifikasi untuk produk ini
      const existingNotification = storeNotifications.find(n => n.productId === product.id);
      
      // Jika belum ada notifikasi, atau forceCheck = true
      if (!existingNotification || forceCheck) {
        // Buat notifikasi baru
        const notification: StockNotification = {
          id: `stock-${product.id}-${now.getTime()}`,
          productId: product.id,
          productName: product.name,
          currentStock: product.stock,
          threshold: product.threshold || 0,
          unit: product.unit || 'pcs',
          timestamp: now,
          read: false,
          category: product.category || undefined,
          storeId: product.storeId,
          price: product.price || 0
        };
        
        newNotifications.push(notification);
      } else if (existingNotification) {
        // Update existing notification if stock has changed
        if (existingNotification.currentStock !== product.stock) {
          existingNotification.currentStock = product.stock;
          existingNotification.timestamp = now;
          existingNotification.read = false;
        }
      }
    }
    
    // Tambahkan notifikasi baru ke store
    if (storeId && newNotifications.length > 0) {
      notificationsStore[storeId] = [
        ...newNotifications,
        ...(notificationsStore[storeId] || [])
      ];
    }
    
    // Hapus notifikasi untuk produk yang stoknya sudah di atas threshold
    if (storeId) {
      // Get products that have notifications but are no longer below threshold
      const productsAboveThreshold = await prisma.product.findMany({
        where: {
          storeId,
          isDeleted: false,
          threshold: { not: null },
          stock: {
            gt: prisma.product.fields.threshold
          },
          id: { in: storeNotifications.map(n => n.productId) }
        },
        select: { id: true }
      });
      
      // Remove notifications for those products
      if (productsAboveThreshold.length > 0) {
        const productIdsToRemove = productsAboveThreshold.map(p => p.id);
        notificationsStore[storeId] = storeNotifications.filter(
          n => !productIdsToRemove.includes(n.productId)
        );
      }
    }
    
    // Return the total number of notifications
    return { 
      count: storeId 
        ? (notificationsStore[storeId] || []).length 
        : Object.values(notificationsStore).flat().length 
    };
  } catch (error) {
    console.error('[NotificationService] Error checking low stock products:', error);
    throw error;
  }
}

/**
 * Tandai notifikasi sebagai sudah dibaca
 */
export function markNotificationAsRead(notificationId: string, storeId?: string): boolean {
  console.log(`[NotificationService] Marking notification as read: ${notificationId}, store: ${storeId || 'all'}`);
  
  if (isBrowser) {
    // Di browser, panggil API
    try {
      const url = new URL('/api/stock-alerts', window.location.origin);
      url.searchParams.append('action', 'markAsRead');
      url.searchParams.append('notificationId', notificationId);
      if (storeId) {
        url.searchParams.append('storeId', storeId);
      }
      
      // API call in background
      fetch(url)
        .then(response => {
          if (!response.ok) {
            throw new Error('Failed to mark notification as read');
          }
        })
        .catch(error => {
          console.error('Error marking notification as read:', error);
        });
      
      return true;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return false;
    }
  }
  
  // Di server
  if (storeId && notificationsStore[storeId]) {
    // Tandai notifikasi sebagai dibaca
    const notification = notificationsStore[storeId].find(n => n.id === notificationId);
    if (notification) {
      notification.read = true;
      return true;
    }
  } else if (!storeId) {
    // Cari di semua toko
    for (const storeNotifications of Object.values(notificationsStore)) {
      const notification = storeNotifications.find(n => n.id === notificationId);
      if (notification) {
        notification.read = true;
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Tandai semua notifikasi sebagai sudah dibaca
 */
export function markAllNotificationsAsRead(storeId?: string): number {
  console.log(`[NotificationService] Marking all notifications as read for store: ${storeId || 'all'}`);
  
  if (isBrowser) {
    // Di browser, panggil API
    try {
      const url = new URL('/api/stock-alerts', window.location.origin);
      url.searchParams.append('action', 'markAllAsRead');
      if (storeId) {
        url.searchParams.append('storeId', storeId);
      }
      
      // API call in background
      fetch(url)
        .then(response => {
          if (!response.ok) {
            throw new Error('Failed to mark all notifications as read');
          }
        })
        .catch(error => {
          console.error('Error marking all notifications as read:', error);
        });
      
      return 1; // Return dummy value
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      return 0;
    }
  }
  
  // Di server
  if (storeId && notificationsStore[storeId]) {
    // Tandai semua notifikasi toko ini sebagai dibaca
    notificationsStore[storeId].forEach(notification => {
      notification.read = true;
    });
    return notificationsStore[storeId].length;
  } else if (!storeId) {
    // Tandai semua notifikasi di semua toko
    let count = 0;
    for (const storeNotifications of Object.values(notificationsStore)) {
      storeNotifications.forEach(notification => {
        notification.read = true;
      });
      count += storeNotifications.length;
    }
    return count;
  }
  
  return 0;
}

/**
 * Hapus notifikasi
 */
export function dismissNotification(notificationId: string, storeId?: string): boolean {
  console.log(`[NotificationService] Dismissing notification: ${notificationId}, store: ${storeId || 'all'}`);
  
  if (isBrowser) {
    // Di browser, panggil API
    try {
      const url = new URL('/api/stock-alerts', window.location.origin);
      url.searchParams.append('action', 'dismiss');
      url.searchParams.append('notificationId', notificationId);
      if (storeId) {
        url.searchParams.append('storeId', storeId);
      }
      
      // API call in background
      fetch(url)
        .then(response => {
          if (!response.ok) {
            throw new Error('Failed to dismiss notification');
          }
        })
        .catch(error => {
          console.error('Error dismissing notification:', error);
        });
      
      return true;
    } catch (error) {
      console.error('Error dismissing notification:', error);
      return false;
    }
  }
  
  // Di server
  if (storeId && notificationsStore[storeId]) {
    // Hapus notifikasi dari toko ini
    const initialLength = notificationsStore[storeId].length;
    notificationsStore[storeId] = notificationsStore[storeId].filter(n => n.id !== notificationId);
    return initialLength > notificationsStore[storeId].length;
  } else if (!storeId) {
    // Hapus notifikasi dari semua toko
    let removed = false;
    for (const storeId in notificationsStore) {
      const initialLength = notificationsStore[storeId].length;
      notificationsStore[storeId] = notificationsStore[storeId].filter(n => n.id !== notificationId);
      if (initialLength > notificationsStore[storeId].length) {
        removed = true;
      }
    }
    return removed;
  }
  
  return false;
}

/**
 * Hapus semua notifikasi
 */
export function dismissAllNotifications(storeId?: string): number {
  console.log(`[NotificationService] Dismissing all notifications for store: ${storeId || 'all'}`);
  
  if (isBrowser) {
    // Di browser, panggil API
    try {
      const url = new URL('/api/stock-alerts', window.location.origin);
      url.searchParams.append('action', 'dismissAll');
      if (storeId) {
        url.searchParams.append('storeId', storeId);
      }
      
      // API call in background
      fetch(url)
        .then(response => {
          if (!response.ok) {
            throw new Error('Failed to dismiss all notifications');
          }
        })
        .catch(error => {
          console.error('Error dismissing all notifications:', error);
        });
      
      return 1; // Return dummy value
    } catch (error) {
      console.error('Error dismissing all notifications:', error);
      return 0;
    }
  }
  
  // Di server
  if (storeId && notificationsStore[storeId]) {
    // Hapus semua notifikasi toko ini
    const count = notificationsStore[storeId].length;
    notificationsStore[storeId] = [];
    return count;
  } else if (!storeId) {
    // Hapus semua notifikasi di semua toko
    let count = 0;
    for (const storeId in notificationsStore) {
      count += notificationsStore[storeId].length;
      notificationsStore[storeId] = [];
    }
    return count;
  }
  
  return 0;
}

/**
 * Inisialisasi layanan notifikasi
 * Catatan: Fungsi ini hanya boleh dipanggil dari server-side
 */
export async function initializeNotificationService(): Promise<void> {
  console.log('[NotificationService] Initializing notification service');
  
  // Skip initialization in browser environment
  if (isBrowser) {
    console.log('[NotificationService] Skipping initialization in browser environment');
    return;
  }
  
  try {
    // Di server, gunakan Prisma
    const prisma = await getPrisma();
    
    // Dapatkan semua toko
    const stores = await prisma.store.findMany({
      select: { id: true }
    });
    
    // Inisialisasi cache untuk setiap toko
    for (const store of stores) {
      // Check if notifications for this store already exist
      if (!notificationsStore[store.id]) {
        notificationsStore[store.id] = [];
      }
      
      // Get low stock products for this store
      await checkLowStockProducts(store.id);
    }
    
    console.log('[NotificationService] Notification service initialized successfully');
  } catch (error) {
    console.error('[NotificationService] Error initializing notification service:', error);
  }
} 