import defaultPrisma from "@/lib/prisma";
import { broadcastStockAlerts } from "@/lib/notificationEvents";
import { Prisma } from "@prisma/client";
import { calculateExpiringItems } from "@/lib/stock-utils";
import { AppNotification, NotificationWithRelations } from "../core/notification-types";
import {
  toAppNotification,
  calculateSnoozeUntil,
  generateStockNotificationTitle,
  generateStockNotificationMessage,
  generateDebtNotificationTitle,
  generateDebtNotificationMessage,
  generateExpiredNotificationTitle,
  generateExpiredNotificationMessage,
  calculateStaleStockNotificationIds,
  shouldUpdateStockNotification,
  createStockMetadata,
  createDebtMetadata,
  shouldUpdateDebtNotification,
  createExpiredMetadata,
  shouldUpdateExpiredNotification,
  calculateExpiredNotificationSignatures,
  filterExpiredNotificationsToDelete,
  filterPaidNotificationIds,
} from "../core/notification-core";

export class NotificationShell {
  static async createNotification(data: Prisma.NotificationUncheckedCreateInput, tx: any = defaultPrisma) {
    const notification = await tx.notification.create({
      data,
    });

    await this.broadcastUpdate(data.storeId as string, tx);

    return notification;
  }

  static async getNotifications(storeId: string, filter?: { isRead?: boolean }, tx: any = defaultPrisma): Promise<AppNotification[]> {
    const where: Prisma.NotificationWhereInput = {
      storeId,
    };

    if (filter?.isRead !== undefined) {
      where.isRead = filter.isRead;
    }

    // @ts-ignore
    const notifications = await (tx.notification as any).findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        product: true,
        transaction: { include: { customer: true } },
        purchaseOrder: true,
      },
    });

    return notifications.map((n: NotificationWithRelations) => toAppNotification(n));
  }

  static async markAsRead(id: string, storeId: string, tx: any = defaultPrisma) {
    const notification = await tx.notification.updateMany({
      where: { id, storeId },
      data: { isRead: true },
    });

    await this.broadcastUpdate(storeId, tx);
    return notification;
  }

  static async markAllAsRead(storeId: string, tx: any = defaultPrisma) {
    const result = await tx.notification.updateMany({
      where: { storeId, isRead: false },
      data: { isRead: true },
    });

    await this.broadcastUpdate(storeId, tx);
    return result;
  }

  static async deleteNotification(id: string, storeId: string, tx: any = defaultPrisma) {
    const result = await tx.notification.deleteMany({
      where: { id, storeId },
    });

    await this.broadcastUpdate(storeId, tx);
    return result;
  }

  static async dismissAllNotifications(storeId: string, tx: any = defaultPrisma) {
    const result = await tx.notification.deleteMany({
      where: { storeId },
    });

    await this.broadcastUpdate(storeId, tx);
    return result;
  }

  static async snoozeNotification(id: string, storeId: string, minutes: number, tx: any = defaultPrisma) {
    const until = calculateSnoozeUntil(minutes);

    const result = await tx.notification.updateMany({
      where: { id, storeId },
      data: {
        snoozedUntil: until,
        isRead: true,
      },
    });

    await this.broadcastUpdate(storeId, tx);
    return result;
  }

  private static async broadcastUpdate(storeId: string, tx: any = defaultPrisma) {
    const notifications = await this.getNotifications(storeId, undefined, tx);
    const unreadCount = await tx.notification.count({
      where: { storeId, isRead: false },
    });

    broadcastStockAlerts(storeId, {
      type: "update",
      storeId,
      notifications,
      unreadCount,
    });
  }

  static async checkLowStockProducts(storeId?: string, tx: any = defaultPrisma) {
    const stores = await tx.store.findMany({
      where: storeId ? { id: storeId } : {},
      select: { id: true, stockNotificationInterval: true },
    });

    let totalCount = 0;

    for (const store of stores) {
      const INTERVAL_HOURS = (store.stockNotificationInterval || 60) / 60;

      const products = await tx.product.findMany({
        where: {
          storeId: store.id,
          isDeleted: false,
          threshold: { not: null },
          stock: {
            lte: tx.product.fields.threshold,
          },
        },
      });

      const existingStockNotifications = await tx.notification.findMany({
        where: {
          storeId: store.id,
          type: "STOCK",
        },
      });

      const currentLowStockIds = new Set<string>(products.map((p: any) => p.id));
      const staleNotificationIds = calculateStaleStockNotificationIds(
        existingStockNotifications.map((n: any) => ({ id: n.id, productId: n.productId })),
        currentLowStockIds,
      );

      if (staleNotificationIds.length > 0) {
        await tx.notification.deleteMany({
          where: { id: { in: staleNotificationIds } },
        });
      }

      const notificationMap = new Map();
      existingStockNotifications.forEach((n: any) => {
        if (n.productId) notificationMap.set(n.productId, n);
      });

      const promises: Promise<any>[] = [];

      for (const p of products) {
        const existing = notificationMap.get(p.id);

        const metadata = createStockMetadata({
          currentStock: p.stock,
          threshold: p.threshold || 0,
          unit: p.unit,
          category: p.category,
          price: p.price,
          supplierId: p.supplierId,
        });

        if (existing) {
          const { shouldUpdate, isReminder } = shouldUpdateStockNotification({
            existing,
            currentStock: p.stock,
            intervalHours: INTERVAL_HOURS,
          });

          if (shouldUpdate) {
            promises.push(
              tx.notification.update({
                where: { id: existing.id },
                data: {
                  metadata: metadata as any,
                  message: generateStockNotificationMessage(p.name, p.stock, p.unit),
                  updatedAt: new Date(),
                  isRead: false,
                  title: generateStockNotificationTitle(p.name, isReminder),
                  snoozedUntil: null,
                },
              }),
            );
          }
        } else {
          promises.push(
            tx.notification.create({
              data: {
                type: "STOCK",
                storeId: store.id,
                productId: p.id,
                title: generateStockNotificationTitle(p.name, false),
                message: generateStockNotificationMessage(p.name, p.stock, p.unit),
                metadata: metadata as any,
              },
            }),
          );
        }
      }

      await Promise.all(promises);
      totalCount += products.length;
      await this.broadcastUpdate(store.id, tx);
    }

    return { count: totalCount };
  }

  /**
   * Optimized check for debts using Batch Processing to avoid N+1 queries
   */
  static async checkDebtDue(storeId: string, tx: any = defaultPrisma) {
    await this.cleanupPaidDebtNotifications(storeId, tx);

    const store = await tx.store.findUnique({
      where: { id: storeId },
      select: { stockNotificationInterval: true },
    });
    const intervalMinutes = store?.stockNotificationInterval || 60;
    const intervalHours = intervalMinutes / 60;

    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    // --- CUSTOMER DEBTS ---
    const dueTransactions = await tx.transaction.findMany({
      where: {
        storeId,
        paymentStatus: { in: ["UNPAID", "PARTIAL"] },
        remainingAmount: { gt: 0 },
        dueDate: { lte: endOfDay },
      },
      include: { customer: true },
    });

    const promises: Promise<any>[] = [];

    if (dueTransactions.length > 0) {
      const transactionIds = dueTransactions.map((t: any) => t.id);

      // Batch fetch existing notifications
      const existingNotifications = await tx.notification.findMany({
        where: {
          storeId,
          type: "DEBT",
          transactionId: { in: transactionIds },
        },
      });

      const notificationMap = new Map();
      existingNotifications.forEach((n: any) => notificationMap.set(n.transactionId, n));

      // Process in memory
      for (const t of dueTransactions) {
        const existing = notificationMap.get(t.id);

        const metadata = createDebtMetadata({
          invoiceNumber: t.invoiceNumber || "-",
          customerName: t.customer?.name || "Unknown",
          amountPaid: t.amountPaid,
          remainingAmount: t.remainingAmount,
          dueDate: t.dueDate!,
        });

        if (existing) {
          const { shouldUpdate, isReminder } = shouldUpdateDebtNotification({
            existing,
            remainingAmount: t.remainingAmount,
            intervalHours,
          });

          if (shouldUpdate) {
            promises.push(
              tx.notification.update({
                where: { id: existing.id },
                data: {
                  metadata: metadata as any,
                  message: generateDebtNotificationMessage(t.invoiceNumber || "-", t.remainingAmount, false),
                  updatedAt: new Date(),
                  isRead: false,
                  title: generateDebtNotificationTitle(t.customer?.name || "Unknown", false, isReminder),
                  snoozedUntil: null,
                },
              }),
            );
          }
        } else {
          promises.push(
            tx.notification.create({
              data: {
                type: "DEBT",
                storeId,
                transactionId: t.id,
                title: generateDebtNotificationTitle(t.customer?.name || "Unknown", false, false),
                message: generateDebtNotificationMessage(t.invoiceNumber || "-", t.remainingAmount, false),
                metadata: metadata as any,
              },
            }),
          );
        }
      }
    }

    // --- SUPPLIER DEBTS ---
    // @ts-ignore
    const duePOs = await (tx.purchaseOrder as any).findMany({
      where: {
        storeId,
        paymentStatus: { in: ["UNPAID", "PARTIAL"] },
        remainingAmount: { gt: 0 },
        dueDate: { lte: endOfDay },
      },
      include: { supplier: true },
    });

    if (duePOs.length > 0) {
      const poIds = duePOs.map((p: any) => p.id);

      // Batch fetch existing notifications
      const existingPONotifications = await tx.notification.findMany({
        where: {
          storeId,
          type: "DEBT",
          purchaseOrderId: { in: poIds },
        },
      });

      const poNotificationMap = new Map();
      existingPONotifications.forEach((n: any) => poNotificationMap.set(n.purchaseOrderId, n));

      for (const po of duePOs) {
        const existing = poNotificationMap.get(po.id);

        const metadata = createDebtMetadata({
          invoiceNumber: po.poNumber,
          customerName: po.supplier.name,
          amountPaid: po.amountPaid,
          remainingAmount: po.remainingAmount,
          dueDate: po.dueDate!,
          isSupplier: true,
        });

        if (existing) {
          const { shouldUpdate, isReminder } = shouldUpdateDebtNotification({
            existing,
            remainingAmount: po.remainingAmount,
            intervalHours,
          });

          if (shouldUpdate) {
            promises.push(
              tx.notification.update({
                where: { id: existing.id },
                data: {
                  metadata: metadata as any,
                  message: generateDebtNotificationMessage(po.poNumber, po.remainingAmount, true),
                  updatedAt: new Date(),
                  isRead: false,
                  title: generateDebtNotificationTitle(po.supplier.name, true, isReminder),
                  snoozedUntil: null,
                },
              }),
            );
          }
        } else {
          promises.push(
            tx.notification.create({
              data: {
                type: "DEBT",
                storeId,
                purchaseOrderId: po.id,
                title: generateDebtNotificationTitle(po.supplier.name, true, false),
                message: generateDebtNotificationMessage(po.poNumber, po.remainingAmount, true),
                metadata: metadata as any,
              } as any,
            }),
          );
        }
      }
    }

    await Promise.all(promises);

    await this.broadcastUpdate(storeId, tx);
  }

  static async cleanupPaidDebtNotifications(storeId: string, tx: any = defaultPrisma) {
    const debtNotifications = await tx.notification.findMany({
      where: {
        storeId,
        type: "DEBT",
        OR: [{ transactionId: { not: null } }, { purchaseOrderId: { not: null } }],
      },
      select: { id: true, transactionId: true, purchaseOrderId: true },
    });

    if (debtNotifications.length === 0) return;

    // 1. Check Customer Debts
    const transactionIds = debtNotifications.filter((n: any) => n.transactionId).map((n: any) => n.transactionId!);
    if (transactionIds.length > 0) {
      const paidTransactions = await tx.transaction.findMany({
        where: { id: { in: transactionIds }, paymentStatus: "PAID" },
        select: { id: true },
      });
      const paidIds = new Set<string>(paidTransactions.map((t: any) => t.id));

      const toDelete = filterPaidNotificationIds(debtNotifications, paidIds);

      if (toDelete.length > 0) {
        await tx.notification.deleteMany({
          where: { id: { in: toDelete } },
        });
      }
    }

    // 2. Check Supplier Debts
    const poIds = debtNotifications.filter((n: any) => n.purchaseOrderId).map((n: any) => n.purchaseOrderId!);
    if (poIds.length > 0) {
      // @ts-ignore
      const paidPOs = await (tx.purchaseOrder as any).findMany({
        where: { id: { in: poIds }, paymentStatus: "PAID" },
        select: { id: true },
      });
      const paidPOIds = new Set<string>(paidPOs.map((p: any) => p.id));

      const toDelete = filterPaidNotificationIds(debtNotifications, paidPOIds);

      if (toDelete.length > 0) {
        await tx.notification.deleteMany({
          where: { id: { in: toDelete } },
        });
      }
    }
  }

  static async checkExpiredProducts(storeId: string, tx: any = defaultPrisma): Promise<{ count: number }> {
    const store = await tx.store.findUnique({
      where: { id: storeId },
      select: { expiryNotificationDays: true, stockNotificationInterval: true },
    });

    if (!store) return { count: 0 };

    const expiryDays = store.expiryNotificationDays || 30;
    const intervalMinutes = store.stockNotificationInterval || 60;
    const intervalHours = intervalMinutes / 60;

    const products = await tx.product.findMany({
      where: {
        storeId: storeId,
        isDeleted: false,
        OR: [{ batches: { some: { expiryDate: { not: null }, stock: { gt: 0 } } } }, { expiry_date: { not: null }, stock: { gt: 0 } }],
      },
      include: { batches: true },
    });

    const allExpiringItems = calculateExpiringItems(products as any[]);
    const expiringSoon = allExpiringItems.filter((item) => item.daysLeft <= expiryDays && item.daysLeft >= -365);

    const activeExpiredNotifications = await tx.notification.findMany({
      where: { storeId, type: "EXPIRED" },
    });

    const validSignatures = calculateExpiredNotificationSignatures(expiringSoon.map((item) => ({ originalId: item.originalId, id: item.id, batch_number: item.batch_number || undefined })));
    const notificationsToDelete = filterExpiredNotificationsToDelete(
      activeExpiredNotifications.map((n: any) => ({ id: n.id, productId: n.productId || "", metadata: n.metadata })),
      validSignatures,
    );

    if (notificationsToDelete.length > 0) {
      await tx.notification.deleteMany({
        where: { id: { in: notificationsToDelete } },
      });
    }

    const promises: Promise<any>[] = [];

    for (const item of expiringSoon) {
      const match = activeExpiredNotifications.find((n: any) => {
        const m = n.metadata as any;
        return n.productId === (item.originalId || item.id) && m?.batchNumber === item.batch_number;
      });

      const metadata = createExpiredMetadata({
        expiryDate: item.expiry_date!,
        batchNumber: item.batch_number || undefined,
        daysLeft: item.daysLeft,
        currentStock: item.stock,
        unit: item.unit || "pcs",
      });

      const title = generateExpiredNotificationTitle(item.name, item.daysLeft);
      const message = generateExpiredNotificationMessage(item.name, item.daysLeft, item.batch_number || undefined);

      if (match) {
        const { shouldUpdate, isReminder } = shouldUpdateExpiredNotification({
          existing: match,
          intervalHours,
          currentDaysLeft: item.daysLeft,
        });

        if (shouldUpdate) {
          promises.push(
            tx.notification.update({
              where: { id: match.id },
              data: {
                title: isReminder ? `Reminder: ${title}` : title,
                message,
                metadata: metadata as any,
                isRead: false,
                updatedAt: new Date(),
                snoozedUntil: null,
              },
            }),
          );
        }
      } else {
        promises.push(
          tx.notification.create({
            data: {
              type: "EXPIRED",
              storeId,
              productId: item.originalId || item.id,
              title,
              message,
              metadata: metadata as any,
            },
          }),
        );
      }
    }

    await Promise.all(promises);

    await this.broadcastUpdate(storeId, tx);

    return { count: expiringSoon.length };
  }
}
