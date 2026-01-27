
import prisma from "@/lib/prisma";
import { broadcastStockAlerts } from "@/lib/notificationEvents";
import { Notification, Prisma } from "@prisma/client";
import { calculateExpiringItems } from "@/lib/stock-utils";

// Re-defining types to match frontend expectations (compatible with legacy AppNotification)
export interface StockNotificationMetadata {
  currentStock: number;
  threshold: number;
  unit: string;
  category?: string;
  price?: number;
  supplierId?: string | null;
}

export interface DebtNotificationMetadata {
  invoiceNumber: string;
  customerName: string;
  amountPaid: number;
  remainingAmount: number;
  dueDate: Date;
}

export interface ExpiredNotificationMetadata {
  expiryDate: Date;
  batchNumber?: string;
  daysLeft: number;
  currentStock: number;
  unit: string;
}

export interface AppNotification {
  id: string;
  type: 'STOCK' | 'DEBT' | 'EXPIRED';
  title: string; // Used as productName or generic title
  message: string;
  timestamp: Date;
  read: boolean;
  storeId: string;
  
  // Optional specific fields (flattened for frontend compatibility)
  productId?: string;
  productName?: string;
  currentStock?: number;
  threshold?: number;
  unit?: string;
  
  transactionId?: string;
  purchaseOrderId?: string;
  invoiceNumber?: string;
  customerName?: string;
  supplierName?: string; // Added for Supplier Debt
  amountPaid?: number;
  remainingAmount?: number;
  dueDate?: Date;
  
  // Expired specific
  expiryDate?: Date;
  batchNumber?: string;
  daysLeft?: number;

  
  snoozedUntil?: Date | null;
  metadata?: any;
}

export type StockNotification = AppNotification;

export class NotificationService {
  
  private static toAppNotification(n: Notification & { product?: any, transaction?: any, purchaseOrder?: any }): AppNotification {
    const metadata = n.metadata as any || {};
    
    const base: AppNotification = {
      id: n.id,
      type: n.type as 'STOCK' | 'DEBT' | 'EXPIRED',
      title: n.title,
      message: n.message,
      timestamp: n.createdAt,
      read: n.isRead,
      storeId: n.storeId,
      snoozedUntil: n.snoozedUntil,
      metadata: metadata,
    };

    if (n.type === 'STOCK') {
      return {
        ...base,
        productId: n.productId || undefined,
        productName: n.product?.name || n.title,
        currentStock: metadata.currentStock,
        threshold: metadata.threshold,
        unit: metadata.unit || 'pcs',
      };
    } else if (n.type === 'DEBT') {
      return {
        ...base,
        transactionId: n.transactionId || undefined,
        purchaseOrderId: n.purchaseOrderId || undefined,
        invoiceNumber: metadata.invoiceNumber || n.transaction?.invoiceNumber || (n as any).purchaseOrder?.poNumber,
        customerName: metadata.customerName || (metadata.isSupplier ? 'Supplier' : (n.transaction?.customer?.name || 'Unknown')),
        amountPaid: metadata.amountPaid,
        remainingAmount: metadata.remainingAmount,
        dueDate: metadata.dueDate ? new Date(metadata.dueDate) : undefined,
      };
    } else if (n.type === 'EXPIRED') {
       return {
          ...base,
          productId: n.productId || undefined,
          productName: n.product?.name || n.title,
          expiryDate: metadata.expiryDate ? new Date(metadata.expiryDate) : undefined,
          batchNumber: metadata.batchNumber,
          daysLeft: metadata.daysLeft,
          currentStock: metadata.currentStock,
          unit: metadata.unit || 'pcs'
       }
    }

    return base;
  }

  static async createNotification(data: Prisma.NotificationUncheckedCreateInput) {
    const notification = await prisma.notification.create({
      data,
    });
    
    // Broadcast update
    await this.broadcastUpdate(data.storeId);
    
    return notification;
  }

  static async getNotifications(storeId: string, filter?: { isRead?: boolean }): Promise<AppNotification[]> {
    const where: Prisma.NotificationWhereInput = {
      storeId,
    };

    if (filter?.isRead !== undefined) {
      where.isRead = filter.isRead;
    }


    // @ts-ignore
    const notifications = await (prisma.notification as any).findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        product: true,
        transaction: { include: { customer: true } },
        purchaseOrder: true
      }
    });

    return notifications.map(this.toAppNotification);
  }

  static async markAsRead(id: string, storeId: string) {
    const notification = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    await this.broadcastUpdate(storeId);
    return notification;
  }

  static async markAllAsRead(storeId: string) {
    const result = await prisma.notification.updateMany({
      where: { storeId, isRead: false },
      data: { isRead: true },
    });

    await this.broadcastUpdate(storeId);
    return result;
  }

  static async deleteNotification(id: string, storeId: string) {
    const result = await prisma.notification.delete({
      where: { id },
    });

    await this.broadcastUpdate(storeId);
    return result;
  }

  static async dismissAllNotifications(storeId: string) {
    const result = await prisma.notification.deleteMany({
      where: { storeId },
    });
    
    await this.broadcastUpdate(storeId);
    return result;
  }

  static async snoozeNotification(id: string, storeId: string, minutes: number) {
    const until = new Date();
    until.setMinutes(until.getMinutes() + minutes);

    const result = await prisma.notification.update({
        where: { id },
        data: {
            snoozedUntil: until,
            isRead: true // Auto read when snoozed
        }
    });

    await this.broadcastUpdate(storeId);
    return result;
  }

  private static async broadcastUpdate(storeId: string) {
    // Fetch latest state for broadcast
    const notifications = await this.getNotifications(storeId);
    const unreadCount = await prisma.notification.count({
      where: { storeId, isRead: false }
    });

    broadcastStockAlerts(storeId, {
      type: 'update',
      storeId,
      notifications,
      unreadCount,
    });
  }


  /**
   * Check for low stock products and upsert notifications
   * Implements "Remind Me Later" logic: If notification exists and is read, but stock is still low,
   * notify again after COOLDOWN_HOURS to ensure user doesn't forget.
  /**
   * Check for low stock products and upsert notifications
   * Implements "Remind Me Later" logic: If notification exists and is read, but stock is still low,
   * notify again after configured INTERVAL (default 60m) to ensure user doesn't forget.
   */
  static async checkLowStockProducts(storeId?: string) {
     const stores = await prisma.store.findMany({
        where: storeId ? { id: storeId } : {},
        select: { id: true, stockNotificationInterval: true }
     });
     
     let totalCount = 0;

     for (const store of stores) {
        // Default interval 60 minutes if not set (though schema has default)
        const INTERVAL_HOURS = (store.stockNotificationInterval || 60) / 60; 

        const products = await prisma.product.findMany({
           where: {
             storeId: store.id,
             isDeleted: false,
             threshold: { not: null },
             stock: {
                lte: prisma.product.fields.threshold
             }
           }
        });

        for (const p of products) {
           // Check for ANY existing notification for this product
           const existing = await prisma.notification.findFirst({
              where: {
                productId: p.id,
                type: 'STOCK'
              },
              orderBy: {
                 createdAt: 'desc'
              }
           });

           const metadata: StockNotificationMetadata = {
              currentStock: p.stock,
              threshold: p.threshold || 0,
              unit: p.unit,
              category: p.category,
              price: p.price,
              supplierId: p.supplierId
           };

           if (existing) {
              // Skip if snoozed
              if (existing.snoozedUntil && new Date(existing.snoozedUntil) > new Date()) {
                  continue; 
              }

              const existingMeta = existing.metadata as any;
              const lastUpdated = new Date(existing.updatedAt || existing.createdAt);
              const hoursSinceUpdate = (new Date().getTime() - lastUpdated.getTime()) / (1000 * 60 * 60);
              
              const stockChanged = existingMeta.currentStock !== p.stock;
              const shouldRemind = existing.isRead && hoursSinceUpdate > INTERVAL_HOURS;

              // Update if stock CHANGED OR if it's time for a reminder
              if (stockChanged || shouldRemind) {
                 await prisma.notification.update({
                    where: { id: existing.id },
                    data: {
                       metadata: metadata as any,
                       message: `Stok saat ini: ${p.stock} ${p.unit}`,
                       updatedAt: new Date(),
                       isRead: false, // Mark as unread to notify user again
                       title: shouldRemind ? `Reminder: Stok Menipis - ${p.name}` : `Stok Menipis: ${p.name}`,
                       snoozedUntil: null // Clear snooze on new alert/reminder
                    }
                 });
              }
           } else {
              // Create new
              await prisma.notification.create({
                 data: {
                    type: 'STOCK',
                    storeId: store.id,
                    productId: p.id,
                    title: `Stok Menipis: ${p.name}`,
                    message: `Stok tersisa ${p.stock} ${p.unit}`,
                    metadata: metadata as any
                 }
              });
           }
        }
        totalCount += products.length;
        
        await this.broadcastUpdate(store.id);
     }
     
     return { count: totalCount };
  }

  /**
   * Check for debts due today and CLEANUP paid debts
   */
  static async checkDebtDue(storeId: string) {
      // 1. First, cleanup notifications for debts that are now PAID
      await this.cleanupPaidDebtNotifications(storeId);

      const store = await prisma.store.findUnique({ 
          where: { id: storeId },
          select: { stockNotificationInterval: true } 
      });
      const intervalMinutes = store?.stockNotificationInterval || 60;

      const now = new Date();
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);

      // --- CUSTOMER DEBTS (TRANSACTIONS) ---
      const dueTransactions = await prisma.transaction.findMany({
          where: {
              storeId,
              paymentStatus: { in: ['UNPAID', 'PARTIAL'] },
              remainingAmount: { gt: 0 },
              dueDate: {
                  lte: endOfDay
              }
          },
          include: {
              customer: true
          }
      });

      for (const t of dueTransactions) {
          const existing = await prisma.notification.findFirst({
              where: {
                  transactionId: t.id,
                  type: 'DEBT'
              }
          });

          const metadata: DebtNotificationMetadata = {
              invoiceNumber: t.invoiceNumber || '-',
              customerName: t.customer?.name || 'Unknown',
              amountPaid: t.amountPaid,
              remainingAmount: t.remainingAmount,
              dueDate: t.dueDate!
          };

          if (existing) {
             // Skip if snoozed
             if (existing.snoozedUntil && new Date(existing.snoozedUntil) > new Date()) {
                 continue; 
             }

             const existingMeta = existing.metadata as any;
             const lastUpdated = new Date(existing.updatedAt || existing.createdAt);
             
             const hoursSinceUpdate = (new Date().getTime() - lastUpdated.getTime()) / (1000 * 60 * 60);
             
             // Check if amount changed
             const amountChanged = existingMeta.remainingAmount !== t.remainingAmount;
             // Check if reminder needed
             const shouldRemind = existing.isRead && hoursSinceUpdate > (intervalMinutes / 60);

             if (amountChanged || shouldRemind) {
                 await prisma.notification.update({
                     where: { id: existing.id },
                     data: {
                         metadata: metadata as any,
                         message: `Sisa tagihan: ${formatRupiah(t.remainingAmount)}`,
                         updatedAt: new Date(),
                         isRead: false, // Notify again
                         title: shouldRemind ? `Reminder: Jatuh Tempo - ${t.customer?.name}` : `Jatuh Tempo: ${t.customer?.name || 'Pelanggan'}`,
                         snoozedUntil: null
                     }
                 });
             }
          } else {
              await prisma.notification.create({
                  data: {
                      type: 'DEBT',
                      storeId,
                      transactionId: t.id,
                      title: `Jatuh Tempo: ${t.customer?.name || 'Pelanggan'}`,
                      message: `Tagihan ${t.invoiceNumber} jatuh tempo hari ini. Sisa: ${formatRupiah(t.remainingAmount)}`,
                      metadata: metadata as any
                  }
              });
          }
      }

      // --- SUPPLIER DEBTS (PURCHASE ORDERS) ---
      // @ts-ignore
      const duePOs = await (prisma.purchaseOrder as any).findMany({
        where: {
          storeId,
          paymentStatus: { in: ['UNPAID', 'PARTIAL'] },
          remainingAmount: { gt: 0 },
          dueDate: {
            lte: endOfDay
          }
        },
        include: {
          supplier: true
        }
      });

      for (const po of duePOs) {
        const existing = await prisma.notification.findFirst({
          where: {
            purchaseOrderId: po.id,
            type: 'DEBT'
          } as any
        });

        // Use compatible metadata structure, reuse customerName for supplier for now or add supplierName to interface if needed
        // For compatibility with `toAppNotification`, we map fields there.
        const metadata = {
          invoiceNumber: po.poNumber,
          customerName: po.supplier.name, // Using customerName field for Supplier Name to reuse FE components if possible, or we distinguish in type
          amountPaid: po.amountPaid,
          remainingAmount: po.remainingAmount,
          dueDate: po.dueDate!,
          isSupplier: true // Flag to distinguish
        };

        if (existing) {
          if (existing.snoozedUntil && new Date(existing.snoozedUntil) > new Date()) continue;

          const existingMeta = existing.metadata as any;
          const lastUpdated = new Date(existing.updatedAt || existing.createdAt);
          const hoursSinceUpdate = (new Date().getTime() - lastUpdated.getTime()) / (1000 * 60 * 60);
          
          const amountChanged = existingMeta.remainingAmount !== po.remainingAmount;
          const shouldRemind = existing.isRead && hoursSinceUpdate > (intervalMinutes / 60);

          if (amountChanged || shouldRemind) {
            await prisma.notification.update({
              where: { id: existing.id },
              data: {
                metadata: metadata as any,
                message: `Sisa hutang: ${formatRupiah(po.remainingAmount)}`,
                updatedAt: new Date(),
                isRead: false,
                title: shouldRemind ? `Reminder: Hutang Jatuh Tempo - ${po.supplier.name}` : `Hutang Jatuh Tempo: ${po.supplier.name}`,
                snoozedUntil: null
              }
            });
          }
        } else {
          await prisma.notification.create({
            data: {
              type: 'DEBT',
              storeId,
              purchaseOrderId: po.id,
              title: `Hutang Jatuh Tempo: ${po.supplier.name}`,
              message: `PO ${po.poNumber} jatuh tempo. Sisa: ${formatRupiah(po.remainingAmount)}`,
              metadata: metadata as any
            } as any
          });
        }
      }
      
      await this.broadcastUpdate(storeId);
  }

  /**
   * Remove notifications for transactions that are fully paid
   */
  static async cleanupPaidDebtNotifications(storeId: string) {
      // Find all DEBT notifications
      const debtNotifications = await prisma.notification.findMany({
          where: {
              storeId,
              type: 'DEBT',
              transactionId: { not: null }
          },
          select: { id: true, transactionId: true }
      });

      if (debtNotifications.length === 0) return;

      const transactionIds = debtNotifications.map(n => n.transactionId!);
      
      // Check current status of these transactions
      const paidTransactions = await prisma.transaction.findMany({
          where: {
              id: { in: transactionIds },
              paymentStatus: 'PAID'
          },
          select: { id: true }
      });

      const paidIds = new Set(paidTransactions.map(t => t.id));
      const notificationsToDelete = debtNotifications
          .filter((n: { transactionId: string | null }) => paidIds.has(n.transactionId!))
          .map((n: { id: string }) => n.id);

      if (notificationsToDelete.length > 0) {
          await prisma.notification.deleteMany({
              where: {
                  id: { in: notificationsToDelete }
              }
          });
      }
  }

  /**
   * Check for expiring products
   */
  static async checkExpiredProducts(storeId: string): Promise<{ count: number }> {
     const store = await prisma.store.findUnique({
        where: { id: storeId },
        select: { expiryNotificationDays: true, stockNotificationInterval: true }
     });

     if (!store) return { count: 0 };

     const expiryDays = store.expiryNotificationDays || 30;
     const intervalMinutes = store.stockNotificationInterval || 60;
     const intervalHours = intervalMinutes / 60;

     // 1. Get products with batches
     const products = await prisma.product.findMany({
         where: {
             storeId: storeId,
             isDeleted: false,
             // Optimization: only fetch products that MIGHT expire (have expiring batches or legacy date)
             OR: [
                 { batches: { some: { expiryDate: { not: null }, stock: { gt: 0 } } } },
                 { expiry_date: { not: null }, stock: { gt: 0 } }
             ]
         },
         include: {
             batches: true
         }
     });

     // 2. Calculate expiring items using shared logic
     const allExpiringItems = calculateExpiringItems(products as any[]);

     // 3. Filter by notification threshold
     const expiringSoon = allExpiringItems.filter(item => item.daysLeft <= expiryDays && item.daysLeft >= -365); // Just sanity check on lower bound, or accept negative as "Already Expired"
     
     // 4. Upsert notifications
     for (const item of expiringSoon) {
         // Identify unique key for notification. 
         // If it is batch-based, we might want to track by batch ID to allow multiple batches of same product to notify separately?
         // Or one notification per product listing the earliest expiry?
         // The `calculateExpiringItems` flattens batches. item.id is `${product.id}-${batch.id}` if batch.
         // Let's us product ID + Batch ID (if available) as key concept, but Notification model links to Product.
         // We can store batchNumber in metadata.
         
         // const notificationKey = item.isBatch && item.batch_number ? `${item.originalId}-${item.batch_number}` : item.originalId || item.id;
         
         // Try to find existing notification
         // We can use metadata to store the unique batch identifier to distinguish
         // Or just check if we have an ACTIVE (unread/read) notification for this product with type EXPIRED AND matches batch info
         

         
         const allProductNotifications = await prisma.notification.findMany({
             where: {
                 storeId,
                 productId: item.originalId || item.id,
                 type: 'EXPIRED'
             }
         });
         
         // Find matching by unique key (batch number) in metadata
         const match = allProductNotifications.find(n => {
             const m = n.metadata as any;
             return m?.batchNumber === item.batch_number; // item.batch_number is from utility
         });

         const metadata: ExpiredNotificationMetadata = {
             expiryDate: item.expiry_date!,
             batchNumber: item.batch_number || undefined,
             daysLeft: item.daysLeft,
             currentStock: item.stock,
             unit: item.unit || 'pcs'
         };

         const title = item.daysLeft < 0 
            ? `Kadaluarsa: ${item.name}` 
            : `Hampir Kadaluarsa: ${item.name}`;
            
         const message = item.daysLeft < 0
            ? `Produk telah kadaluarsa ${Math.abs(item.daysLeft)} hari yang lalu (Batch: ${item.batch_number || '-'})`
            : `Akan kadaluarsa dalam ${item.daysLeft} hari (Batch: ${item.batch_number || '-'})`;

         if (match) {
             // Update logic
             if (match.snoozedUntil && new Date(match.snoozedUntil) > new Date()) continue;

             const lastUpdated = new Date(match.updatedAt || match.createdAt);
             const hoursSinceUpdate = (new Date().getTime() - lastUpdated.getTime()) / (1000 * 60 * 60);
             
             // Remind if:
             // 1. Days left changed significantly (e.g. crossing a threshold)? Or just daily update?
             // 2. Interval passed and it is unread? No, if it is Read, we remind.
             // Let's follow stock logic: Update if changed or remind time passed.
             
             const shouldRemind = match.isRead && hoursSinceUpdate > intervalHours;
             const daysChanged = (match.metadata as any)?.daysLeft !== item.daysLeft;

             if (shouldRemind || daysChanged) {
                 await prisma.notification.update({
                     where: { id: match.id },
                     data: {
                         title: shouldRemind ? `Reminder: ${title}` : title,
                         message,
                         metadata: metadata as any,
                         isRead: false,
                         updatedAt: new Date(),
                         snoozedUntil: null
                     }
                 });
             }
         } else {
             // Create New
             await prisma.notification.create({
                 data: {
                     type: 'EXPIRED',
                     storeId,
                     productId: item.originalId || item.id,
                     title,
                     message,
                     metadata: metadata as any
                 }
             });
         }
     }
     
     await this.broadcastUpdate(storeId);

     return { count: expiringSoon.length };
  }
}

// Helper for formatting logic in service layer if needed, or import
function formatRupiah(amount: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(amount);
}
