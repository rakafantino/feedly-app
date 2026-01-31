import prisma from "@/lib/prisma";
import { broadcastStockAlerts } from "@/lib/notificationEvents";
import { Prisma } from "@prisma/client";
import { calculateExpiringItems } from "@/lib/stock-utils";
import { 
  AppNotification, 
  NotificationWithRelations 
} from '../core/notification-types';
import { 
  toAppNotification,
  calculateSnoozeUntil,
  generateStockNotificationTitle,
  generateStockNotificationMessage,
  generateDebtNotificationTitle,
  generateDebtNotificationMessage,
  generateExpiredNotificationTitle,
  generateExpiredNotificationMessage,
  // Plan 2 pure functions
  calculateStaleStockNotificationIds,
  shouldUpdateStockNotification,
  createStockMetadata,
  createDebtMetadata,
  shouldUpdateDebtNotification,
  createExpiredMetadata,
  shouldUpdateExpiredNotification,
  calculateExpiredNotificationSignatures,
  filterExpiredNotificationsToDelete,
  filterPaidNotificationIds
} from '../core/notification-core';

export class NotificationShell {
  
  static async createNotification(data: Prisma.NotificationUncheckedCreateInput) {
    const notification = await prisma.notification.create({
      data,
    });
    
    // Broadcast update
    await this.broadcastUpdate(data.storeId as string);
    
    return notification;
  }

  static async getNotifications(
    storeId: string, 
    filter?: { isRead?: boolean }
  ): Promise<AppNotification[]> {
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

    return notifications.map((n: NotificationWithRelations) => toAppNotification(n));
  }

  static async markAsRead(id: string, storeId: string) {
    const notification = await prisma.notification.updateMany({
      where: { id, storeId },
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
    const result = await prisma.notification.deleteMany({
      where: { id, storeId },
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
    const until = calculateSnoozeUntil(minutes);

    const result = await prisma.notification.updateMany({
        where: { id, storeId },
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
   * Uses pure functions for business logic
   */
  static async checkLowStockProducts(storeId?: string) {
     const stores = await prisma.store.findMany({
        where: storeId ? { id: storeId } : {},
        select: { id: true, stockNotificationInterval: true }
     });
     
     let totalCount = 0;

     for (const store of stores) {
        // Default interval 60 minutes if not set
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

        // --- CLEANUP LOGIC using pure function ---
        const existingStockNotifications = await prisma.notification.findMany({
            where: {
                storeId: store.id,
                type: 'STOCK'
            },
            select: { id: true, productId: true }
        });

        const currentLowStockIds = new Set(products.map(p => p.id));
        const staleNotificationIds = calculateStaleStockNotificationIds(
          existingStockNotifications,
          currentLowStockIds
        );

        if (staleNotificationIds.length > 0) {
            await prisma.notification.deleteMany({
                where: { id: { in: staleNotificationIds } }
            });
        }
        // --- END CLEANUP LOGIC ---

        for (const p of products) {
           const existing = await prisma.notification.findFirst({
              where: {
                productId: p.id,
                type: 'STOCK'
              },
              orderBy: { createdAt: 'desc' }
           });

           const metadata = createStockMetadata({
              currentStock: p.stock,
              threshold: p.threshold || 0,
              unit: p.unit,
              category: p.category,
              price: p.price,
              supplierId: p.supplierId
           });

           if (existing) {
              // Use pure function for business logic decision
              const { shouldUpdate, isReminder } = shouldUpdateStockNotification({
                existing,
                currentStock: p.stock,
                intervalHours: INTERVAL_HOURS
              });

              if (shouldUpdate) {
                 await prisma.notification.update({
                    where: { id: existing.id },
                    data: {
                       metadata: metadata as any,
                       message: generateStockNotificationMessage(p.name, p.stock, p.unit),
                       updatedAt: new Date(),
                       isRead: false,
                       title: generateStockNotificationTitle(p.name, isReminder),
                       snoozedUntil: null
                    }
                 });
              }
           } else {
              await prisma.notification.create({
                 data: {
                    type: 'STOCK',
                    storeId: store.id,
                    productId: p.id,
                    title: generateStockNotificationTitle(p.name, false),
                    message: generateStockNotificationMessage(p.name, p.stock, p.unit),
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
   * Uses pure functions for business logic
   */
  static async checkDebtDue(storeId: string) {
      await this.cleanupPaidDebtNotifications(storeId);

      const store = await prisma.store.findUnique({ 
          where: { id: storeId },
          select: { stockNotificationInterval: true } 
      });
      const intervalMinutes = store?.stockNotificationInterval || 60;
      const intervalHours = intervalMinutes / 60;

      const now = new Date();
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);

      // --- CUSTOMER DEBTS ---
      const dueTransactions = await prisma.transaction.findMany({
          where: {
              storeId,
              paymentStatus: { in: ['UNPAID', 'PARTIAL'] },
              remainingAmount: { gt: 0 },
              dueDate: { lte: endOfDay }
          },
          include: { customer: true }
      });

      for (const t of dueTransactions) {
          const existing = await prisma.notification.findFirst({
              where: { transactionId: t.id, type: 'DEBT' }
          });

          const metadata = createDebtMetadata({
              invoiceNumber: t.invoiceNumber || '-',
              customerName: t.customer?.name || 'Unknown',
              amountPaid: t.amountPaid,
              remainingAmount: t.remainingAmount,
              dueDate: t.dueDate!
          });

          if (existing) {
             const { shouldUpdate, isReminder } = shouldUpdateDebtNotification({
               existing,
               remainingAmount: t.remainingAmount,
               intervalHours
             });

             if (shouldUpdate) {
                 await prisma.notification.update({
                     where: { id: existing.id },
                     data: {
                         metadata: metadata as any,
                         message: generateDebtNotificationMessage(
                           t.invoiceNumber || '-', 
                           t.remainingAmount, 
                           false
                         ),
                         updatedAt: new Date(),
                         isRead: false,
                         title: generateDebtNotificationTitle(
                           t.customer?.name || 'Unknown', 
                           false, 
                           isReminder
                         ),
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
                      title: generateDebtNotificationTitle(
                        t.customer?.name || 'Unknown', 
                        false, 
                        false
                      ),
                      message: generateDebtNotificationMessage(
                        t.invoiceNumber || '-', 
                        t.remainingAmount, 
                        false
                      ),
                      metadata: metadata as any
                  }
              });
          }
      }

      // --- SUPPLIER DEBTS ---
      // @ts-ignore
      const duePOs = await (prisma.purchaseOrder as any).findMany({
        where: {
          storeId,
          paymentStatus: { in: ['UNPAID', 'PARTIAL'] },
          remainingAmount: { gt: 0 },
          dueDate: { lte: endOfDay }
        },
        include: { supplier: true }
      });

      for (const po of duePOs) {
        const existing = await prisma.notification.findFirst({
          where: { purchaseOrderId: po.id, type: 'DEBT' } as any
        });

        const metadata = createDebtMetadata({
            invoiceNumber: po.poNumber,
            customerName: po.supplier.name,
            amountPaid: po.amountPaid,
            remainingAmount: po.remainingAmount,
            dueDate: po.dueDate!,
            isSupplier: true
        });

        if (existing) {
          const { shouldUpdate, isReminder } = shouldUpdateDebtNotification({
            existing,
            remainingAmount: po.remainingAmount,
            intervalHours
          });

          if (shouldUpdate) {
            await prisma.notification.update({
              where: { id: existing.id },
              data: {
                metadata: metadata as any,
                message: generateDebtNotificationMessage(
                  po.poNumber, 
                  po.remainingAmount, 
                  true
                ),
                updatedAt: new Date(),
                isRead: false,
                title: generateDebtNotificationTitle(
                  po.supplier.name, 
                  true, 
                  isReminder
                ),
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
              title: generateDebtNotificationTitle(po.supplier.name, true, false),
              message: generateDebtNotificationMessage(po.poNumber, po.remainingAmount, true),
              metadata: metadata as any
            } as any
          });
        }
      }
      
      await this.broadcastUpdate(storeId);
  }

  /**
   * Remove notifications for transactions that are fully paid
   * Uses pure function for filtering
   */
  static async cleanupPaidDebtNotifications(storeId: string) {
      const debtNotifications = await prisma.notification.findMany({
          where: {
              storeId,
              type: 'DEBT',
              OR: [
                  { transactionId: { not: null } },
                  { purchaseOrderId: { not: null } }
              ]
          },
          select: { id: true, transactionId: true, purchaseOrderId: true }
      });

      if (debtNotifications.length === 0) return;

      // 1. Check Customer Debts
      const transactionIds = debtNotifications.filter(n => n.transactionId).map(n => n.transactionId!);
      if (transactionIds.length > 0) {
          const paidTransactions = await prisma.transaction.findMany({
              where: { id: { in: transactionIds }, paymentStatus: 'PAID' },
              select: { id: true }
          });
          const paidIds = new Set(paidTransactions.map(t => t.id));
          
          const toDelete = filterPaidNotificationIds(debtNotifications, paidIds);
          
          if (toDelete.length > 0) {
              await prisma.notification.deleteMany({
                  where: { id: { in: toDelete } }
              });
          }
      }

      // 2. Check Supplier Debts
      const poIds = debtNotifications.filter(n => n.purchaseOrderId).map(n => n.purchaseOrderId!);
      if (poIds.length > 0) {
          // @ts-ignore
          const paidPOs = await (prisma.purchaseOrder as any).findMany({
              where: { id: { in: poIds }, paymentStatus: 'PAID' },
              select: { id: true }
          });
          const paidPOIds = new Set<string>(paidPOs.map((p: any) => p.id));
          
          const toDelete = filterPaidNotificationIds(debtNotifications, paidPOIds);
          
          if (toDelete.length > 0) {
              await prisma.notification.deleteMany({
                  where: { id: { in: toDelete } }
              });
          }
      }
  }

  /**
   * Check for expiring products
   * Uses pure functions for business logic
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

     const products = await prisma.product.findMany({
         where: {
             storeId: storeId,
             isDeleted: false,
             OR: [
                 { batches: { some: { expiryDate: { not: null }, stock: { gt: 0 } } } },
                 { expiry_date: { not: null }, stock: { gt: 0 } }
             ]
         },
         include: { batches: true }
     });

     const allExpiringItems = calculateExpiringItems(products as any[]);
     const expiringSoon = allExpiringItems.filter(item => item.daysLeft <= expiryDays && item.daysLeft >= -365);
     
     // --- CLEANUP LOGIC using pure function ---
     const activeExpiredNotifications = await prisma.notification.findMany({
         where: { storeId, type: 'EXPIRED' },
         select: { id: true, productId: true, metadata: true }
     });

     const validSignatures = calculateExpiredNotificationSignatures(
       expiringSoon.map(item => ({ originalId: item.originalId, id: item.id, batch_number: item.batch_number || undefined }))
     );
     // Transform Prisma result to match expected format
     const notificationsToDelete = filterExpiredNotificationsToDelete(
       activeExpiredNotifications.map(n => ({ id: n.id, productId: n.productId || '', metadata: n.metadata })),
       validSignatures
     );

     if (notificationsToDelete.length > 0) {
         await prisma.notification.deleteMany({
             where: { id: { in: notificationsToDelete } }
         });
     }
     // --- END CLEANUP LOGIC ---

     for (const item of expiringSoon) {
         const allProductNotifications = await prisma.notification.findMany({
             where: {
                 storeId,
                 productId: item.originalId || item.id,
                 type: 'EXPIRED'
             }
         });
         
         const match = allProductNotifications.find(n => {
             const m = n.metadata as any;
             return m?.batchNumber === item.batch_number;
         });

         const metadata = createExpiredMetadata({
             expiryDate: item.expiry_date!,
             batchNumber: item.batch_number || undefined,
             daysLeft: item.daysLeft,
             currentStock: item.stock,
             unit: item.unit || 'pcs'
         });

         const title = generateExpiredNotificationTitle(item.name, item.daysLeft);
         const message = generateExpiredNotificationMessage(
           item.name, 
           item.daysLeft, 
           item.batch_number || undefined
         );

         if (match) {
             const { shouldUpdate, isReminder } = shouldUpdateExpiredNotification({
               existing: match,
               intervalHours,
               currentDaysLeft: item.daysLeft
             });

             if (shouldUpdate) {
                 await prisma.notification.update({
                     where: { id: match.id },
                     data: {
                         title: isReminder ? `Reminder: ${title}` : title,
                         message,
                         metadata: metadata as any,
                         isRead: false,
                         updatedAt: new Date(),
                         snoozedUntil: null
                     }
                 });
             }
         } else {
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
