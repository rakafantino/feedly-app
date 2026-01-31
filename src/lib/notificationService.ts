/**
 * notificationService.ts
 * Layanan untuk menangani notifikasi stok menipis dan piutang jatuh tempo
 * Ini adalah layer untuk frontend/in-memory notifications (berbeda dari service layer yang persistent)
 */

// Re-export types from core
export type { 
  StockNotificationMetadata,
  DebtNotificationMetadata,
  ExpiredNotificationMetadata,
  AppNotification,
  StockNotification
} from '../core/notification-types';

// Tipe lokal untuk frontend in-memory notifications (berbeda dari AppNotification di core)
export interface LocalStockNotification {
  type: 'STOCK';
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
  supplierId?: string | null;
}

export interface LocalDebtNotification {
  type: 'DEBT';
  id: string;
  transactionId: string;
  invoiceNumber: string;
  customerName: string;
  amountPaid: number;
  remainingAmount: number;
  dueDate: Date;
  timestamp: Date;
  read: boolean;
  storeId: string;
}

export type LocalAppNotification = LocalStockNotification | LocalDebtNotification;

// Menyimpan notifikasi aktif untuk setiap toko
const notificationsStore: Record<string, LocalAppNotification[]> = {};

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
export async function getStoreNotifications(storeId?: string | null): Promise<LocalAppNotification[]> {
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
  console.log(`[NotificationService] Checking notifications/stock for store: ${storeId || 'all'}, forceCheck: ${forceCheck}`);

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
      console.log('[NotificationService] No specific storeId provided. Checking all stores.');
      const stores = await prisma.store.findMany({ select: { id: true } });
      let totalNotificationsAcrossAllStores = 0;
      for (const store of stores) {
        const result = await checkLowStockProducts(store.id, forceCheck); // Panggil rekursif dengan storeId
        totalNotificationsAcrossAllStores += result.count;
      }
      return { count: totalNotificationsAcrossAllStores };
    }

    // --- CHECK STOCK ALERTS ---
    const products = await prisma.product.findMany({
      where: {
        storeId: storeId,
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
        price: true,
        supplierId: true
      }
    });

    console.log(`[NotificationService] Found ${products.length} low stock products for store: ${storeId}`);

    const now = new Date();
    
    // Initial notifications if empty
    if (!notificationsStore[storeId]) {
      notificationsStore[storeId] = [];
    }

    // --- CHECK DEBT ALERTS ---
    await checkDebtDue(storeId);
    
    // Merge Stock Notifications
    const currentNotifications = notificationsStore[storeId] || [];
    // Keep non-stock notifications (Debts are handled by checkDebtDue/or we merge here if we want strict separation, 
    // but better to manipulate the store directly or return lists and merge them)
    // Detailed implementation:
    // We will update the `notificationsStore[storeId]` array with valid Stock Notifications.
    // However, we must preserve existing read status if possible, and remove obsolete ones.
    
    // Valid Product IDs from current DB check
    const validProductIds = products.map(p => p.id);
    
    // Remove Stock notifications that are no longer valid (e.g. stock increased properly handled by cleanup logic below,
    // but here we ensure what we found IS in the list)
    
    for (const product of products) {
      const existingNotificationIndex = currentNotifications.findIndex(n => n.type === 'STOCK' && n.productId === product.id);
      
      if (existingNotificationIndex === -1 || forceCheck) {
        // Create New or Overwrite if forced
         const notification: LocalStockNotification = {
          type: 'STOCK',
          id: `stock-${product.id}`, // Stable ID based on product ID
          productId: product.id,
          productName: product.name,
          currentStock: product.stock,
          threshold: product.threshold || 0,
          unit: product.unit || 'pcs',
          timestamp: now,
          read: existingNotificationIndex !== -1 ? currentNotifications[existingNotificationIndex].read : false, // Preserve read status if simple update, else unread? Usually low stock nag should be unread if condition persists/worsens? 
          // Logic: If forceCheck, maybe re-alert? Let's keep read status if existing.
          category: product.category || undefined,
          storeId: product.storeId,
          price: product.price || 0,
          supplierId: product.supplierId || null
        };
        
        if (existingNotificationIndex !== -1) {
           // Update in place
           currentNotifications[existingNotificationIndex] = notification;
           // If stock changed significantly maybe unread it?
           if (currentNotifications[existingNotificationIndex].currentStock !== product.stock) {
             currentNotifications[existingNotificationIndex].read = false;
             currentNotifications[existingNotificationIndex].timestamp = now;
           }
        } else {
           // Add new
           currentNotifications.push(notification);
        }
      } else {
        // Valid existing notification, check if update needed
         const existing = currentNotifications[existingNotificationIndex] as LocalStockNotification;
         if (existing.currentStock !== product.stock) {
            existing.currentStock = product.stock;
            existing.timestamp = now;
            existing.read = false; // Re-alert on change
         }
      }
    }
    
    // Remove Stock Notifications for products that are no longer low stock
    // (We do this by keeping only those that are either NOT stock type OR are in validProductIds)
    // Wait, checkDebtDue adds debt notifications to the same array? Yes.
    // So filter carefully.
    
    const updatedNotifications = currentNotifications.filter(n => {
      if (n.type === 'STOCK') {
        return validProductIds.includes(n.productId);
      }
      return true; // Keep Debt notifications (handled by checkDebtDue generally, but we need to ensure we don't wipe them here if checkDebtDue was called BEFORE)
      // Actually checkDebtDue will handle its own add/remove. 
    });
    
    notificationsStore[storeId] = updatedNotifications;
    
    // Sort
    notificationsStore[storeId].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    // Broadcast
    const unreadCount = notificationsStore[storeId].filter(n => !n.read).length;
    broadcastStockAlerts(storeId, {
      type: 'update',
      storeId,
      notifications: notificationsStore[storeId],
      unreadCount,
    });

    return {
      count: notificationsStore[storeId].length
    };
  } catch (error) {
    console.error('[NotificationService] Error checking low stock products:', error);
    throw error;
  }
}

/**
 * Memeriksa piutang jatuh tempo
 */
export async function checkDebtDue(storeId: string): Promise<void> {
    console.log(`[NotificationService] Checking debt due for store: ${storeId}`);
    try {
        const prisma = await getPrisma();
        const now = new Date();
        // Set time to end of day to include all debts due today? 
        // Or simply check if dueDate <= now (inclusive of time if stored, or date part)
        // Usually dueDate is a Date object (midnight). If dueDate is today 00:00, and now is 19:00, it is due.
        
        const dueTransactions = await prisma.transaction.findMany({
            where: {
                storeId: storeId,
                paymentStatus: { in: ['UNPAID', 'PARTIAL'] },
                remainingAmount: { gt: 0 },
                dueDate: {
                    lte: new Date(now.setHours(23, 59, 59, 999)) // Include today
                }
            },
            include: {
                customer: true
            }
        });

        console.log(`[NotificationService] Found ${dueTransactions.length} due transactions for store: ${storeId}`);
        
        const currentNotifications = notificationsStore[storeId] || [];
        const validTransactionIds = dueTransactions.map(t => t.id);

        // Add or Update Debt Notifications
        for (const transaction of dueTransactions) {
            const existingIndex = currentNotifications.findIndex(n => n.type === 'DEBT' && n.transactionId === transaction.id);
            
            const notification: LocalDebtNotification = {
                type: 'DEBT',
                id: `debt-${transaction.id}`,
                transactionId: transaction.id,
                invoiceNumber: transaction.invoiceNumber || '-',
                customerName: transaction.customer?.name || 'Unknown',
                amountPaid: transaction.amountPaid,
                remainingAmount: transaction.remainingAmount,
                dueDate: transaction.dueDate!,
                timestamp: existingIndex !== -1 ? currentNotifications[existingIndex].timestamp : new Date(), // Keep original timestamp of alert? Or update?
                read: existingIndex !== -1 ? currentNotifications[existingIndex].read : false, 
                storeId: transaction.storeId
            };
            
            if (existingIndex !== -1) {
                // Update
                currentNotifications[existingIndex] = notification;
                // If remaining amount changed (e.g. partial payment made), unread it?
                const oldNotif = currentNotifications[existingIndex] as LocalDebtNotification;
                if (oldNotif.remainingAmount !== transaction.remainingAmount) {
                     currentNotifications[existingIndex].read = false;
                     currentNotifications[existingIndex].timestamp = new Date();
                }
            } else {
                currentNotifications.push(notification);
            }
        }
        
        // Remove Debt Notifications that are no longer due or paid
        const finalNotifications = currentNotifications.filter(n => {
            if (n.type === 'DEBT') {
                return validTransactionIds.includes(n.transactionId);
            }
            return true; // Keep Stock notifications
        });
        
        notificationsStore[storeId] = finalNotifications;

    } catch (error) {
        console.error('[NotificationService] Error checking debt due:', error);
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

      // Get low stock products & debt due for this store
      await checkLowStockProducts(store.id);
    }

    console.log('[NotificationService] Notification service initialized successfully');
  } catch (error) {
    console.error('[NotificationService] Error initializing notification service:', error);
  }
}