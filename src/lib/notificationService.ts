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

// SSE event hub untuk broadcast perubahan notifikasi
import { broadcastStockAlerts } from '@/lib/notificationEvents';

// Cek apakah kode berjalan di browser
const isBrowser = typeof window !== 'undefined';

// Fungsi helper untuk mendapatkan PrismaClient hanya di server-side
async function getPrisma() {
  if (isBrowser) {
    throw new Error('Cannot use Prisma on the client');
  }
  // Import the singleton instance which is correctly configured with the adapter
  const prismaModule = await import('@/lib/prisma');
  return prismaModule.default;
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
    // Jika tidak ada storeId spesifik, kembalikan semua notifikasi dari semua toko.
    // Ini berguna untuk admin atau sistem internal yang mungkin perlu melihat semua notifikasi.
    // Pastikan di sisi klien, storeId yang benar selalu dikirim untuk pengguna biasa.
    console.log('[NotificationService] getStoreNotifications called without storeId. Returning all notifications.');
    return Object.values(notificationsStore).flat().sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
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

    if (!storeId) {
      // Jika tidak ada storeId spesifik, iterasi semua toko dan panggil fungsi ini untuk masing-masing toko
      console.log('[NotificationService] No specific storeId provided. Checking all stores.');
      const stores = await prisma.store.findMany({ select: { id: true } });
      let totalNotificationsAcrossAllStores = 0;
      for (const store of stores) {
        const result = await checkLowStockProducts(store.id, forceCheck); // Panggil rekursif dengan storeId
        totalNotificationsAcrossAllStores += result.count;
      }
      return { count: totalNotificationsAcrossAllStores };
    }

    // Logika untuk storeId spesifik
    // Dapatkan produk dengan stok menipis dari database untuk storeId yang diberikan
    const products = await prisma.product.findMany({
      where: {
        storeId: storeId, // Selalu filter berdasarkan storeId di sini
        isDeleted: false,
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

    console.log(`[NotificationService] Found ${products.length} low stock products for store: ${storeId}`);

    const now = new Date();
    const newNotifications: StockNotification[] = [];

    for (const product of products) {
      // Karena kita sudah memfilter berdasarkan storeId di query Prisma,
      // kita bisa asumsikan product.storeId === storeId
      const productStoreNotifications = notificationsStore[product.storeId] || [];
      const existingNotification = productStoreNotifications.find(n => n.productId === product.id);

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

    // Proses notifikasi baru dan yang diperbarui
    for (const notification of newNotifications) {
      if (notification.storeId) {
        // Hapus notifikasi lama jika ada (untuk kasus forceCheck)
        notificationsStore[notification.storeId] = (notificationsStore[notification.storeId] || []).filter(n => n.productId !== notification.productId);
        // Tambahkan notifikasi baru/diperbarui di awal array
        notificationsStore[notification.storeId] = [notification, ...(notificationsStore[notification.storeId] || [])];
      } else {
        console.warn(`[NotificationService] Notification for product ${notification.productName} is missing storeId.`);
      }
    }

    // Urutkan notifikasi di setiap toko berdasarkan waktu terbaru setelah pembaruan
    Object.keys(notificationsStore).forEach(sId => {
      if (notificationsStore[sId]) {
        notificationsStore[sId].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      }
    });

    // Hapus notifikasi untuk produk yang stoknya sudah di atas threshold
    // Logika ini harus berlaku per toko, baik storeId spesifik diberikan atau tidak.
    const storesToClean = storeId ? [storeId] : Object.keys(notificationsStore);

    for (const currentCleaningStoreId of storesToClean) {
      const currentStoreNotifications = notificationsStore[currentCleaningStoreId] || [];
      if (currentStoreNotifications.length === 0) continue;

      const productsAboveThreshold = await prisma.product.findMany({
        where: {
          storeId: currentCleaningStoreId,
          isDeleted: false,
          threshold: { not: null },
          stock: {
            gt: prisma.product.fields.threshold
          },
          // Hanya periksa produk yang memiliki notifikasi aktif di toko ini
          id: { in: currentStoreNotifications.map(n => n.productId) }
        },
        select: { id: true }
      });

      if (productsAboveThreshold.length > 0) {
        const productIdsToRemove = productsAboveThreshold.map((p: { id: string }) => p.id);
        notificationsStore[currentCleaningStoreId] = currentStoreNotifications.filter(
          n => !productIdsToRemove.includes(n.productId)
        );
        console.log(`[NotificationService] Cleaned ${productIdsToRemove.length} notifications for store ${currentCleaningStoreId} as stock is above threshold.`);
      }
    }

    // Broadcast perubahan ke subscriber SSE untuk store ini (jika storeId spesifik)
    if (storeId) {
      const currentStoreNotifications = notificationsStore[storeId] || [];
      const unreadCount = currentStoreNotifications.filter(n => !n.read).length;
      broadcastStockAlerts(storeId, {
        type: 'update',
        storeId,
        notifications: currentStoreNotifications,
        unreadCount,
      });
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
      // Broadcast perubahan untuk store ini
      const currentStoreNotifications = notificationsStore[storeId] || [];
      const unreadCount = currentStoreNotifications.filter(n => !n.read).length;
      broadcastStockAlerts(storeId, {
        type: 'update',
        storeId,
        notifications: currentStoreNotifications,
        unreadCount,
      });
      return true;
    }
  } else if (!storeId) {
    // Cari di semua toko
    for (const [sId, storeNotifications] of Object.entries(notificationsStore)) {
      const notification = storeNotifications.find(n => n.id === notificationId);
      if (notification) {
        notification.read = true;
        const unreadCount = storeNotifications.filter(n => !n.read).length;
        broadcastStockAlerts(sId, {
          type: 'update',
          storeId: sId,
          notifications: storeNotifications,
          unreadCount,
        });
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
    // Broadcast perubahan untuk store ini
    const currentStoreNotifications = notificationsStore[storeId] || [];
    const unreadCount = currentStoreNotifications.filter(n => !n.read).length;
    broadcastStockAlerts(storeId, {
      type: 'update',
      storeId,
      notifications: currentStoreNotifications,
      unreadCount,
    });
    return notificationsStore[storeId].length;
  } else if (!storeId) {
    // Tandai semua notifikasi di semua toko
    let count = 0;
    for (const [sId, storeNotifications] of Object.entries(notificationsStore)) {
      storeNotifications.forEach(notification => {
        notification.read = true;
      });
      count += storeNotifications.length;
      const unreadCount = storeNotifications.filter(n => !n.read).length;
      broadcastStockAlerts(sId, {
        type: 'update',
        storeId: sId,
        notifications: storeNotifications,
        unreadCount,
      });
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
    const removed = initialLength > notificationsStore[storeId].length;
    if (removed) {
      const currentStoreNotifications = notificationsStore[storeId] || [];
      const unreadCount = currentStoreNotifications.filter(n => !n.read).length;
      broadcastStockAlerts(storeId, {
        type: 'update',
        storeId,
        notifications: currentStoreNotifications,
        unreadCount,
      });
    }
    return removed;
  } else if (!storeId) {
    // Hapus notifikasi dari semua toko
    let removed = false;
    for (const storeId in notificationsStore) {
      const initialLength = notificationsStore[storeId].length;
      notificationsStore[storeId] = notificationsStore[storeId].filter(n => n.id !== notificationId);
      if (initialLength > notificationsStore[storeId].length) {
        removed = true;
        const currentStoreNotifications = notificationsStore[storeId] || [];
        const unreadCount = currentStoreNotifications.filter(n => !n.read).length;
        broadcastStockAlerts(storeId, {
          type: 'update',
          storeId,
          notifications: currentStoreNotifications,
          unreadCount,
        });
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
    // Broadcast perubahan untuk store ini (kosong)
    broadcastStockAlerts(storeId, {
      type: 'update',
      storeId,
      notifications: [],
      unreadCount: 0,
    });
    return count;
  } else if (!storeId) {
    // Hapus semua notifikasi di semua toko
    let count = 0;
    for (const sId in notificationsStore) {
      count += notificationsStore[sId].length;
      notificationsStore[sId] = [];
      broadcastStockAlerts(sId, {
        type: 'update',
        storeId: sId,
        notifications: [],
        unreadCount: 0,
      });
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