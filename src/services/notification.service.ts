// Re-export types from core
export * from "../core/notification-types";

// Re-export pure functions from core
export {
  toAppNotification,
  formatRupiah,
  calculateSnoozeUntil,
  isSnoozed,
  hoursSince,
  generateStockNotificationTitle,
  generateStockNotificationMessage,
  generateDebtNotificationTitle,
  generateDebtNotificationMessage,
  generateExpiredNotificationTitle,
  generateExpiredNotificationMessage,
} from "../core/notification-core";

// Re-export shell class
export { NotificationShell } from "../shell/notification-shell";

// Legacy class for backward compatibility
import { NotificationShell } from "../shell/notification-shell";
import { Prisma } from "@prisma/client";
import defaultPrisma from "@/lib/prisma";

export class NotificationService extends NotificationShell {
  // Keep static methods for backward compatibility
  // They delegate to parent class (NotificationShell)

  static override async createNotification(data: Prisma.NotificationUncheckedCreateInput, tx: any = defaultPrisma) {
    return super.createNotification(data, tx);
  }

  static override async getNotifications(storeId: string, filter?: { isRead?: boolean }, tx: any = defaultPrisma) {
    return super.getNotifications(storeId, filter, tx);
  }

  static override async markAsRead(id: string, storeId: string, tx: any = defaultPrisma) {
    return super.markAsRead(id, storeId, tx);
  }

  static override async markAllAsRead(storeId: string, tx: any = defaultPrisma) {
    return super.markAllAsRead(storeId, tx);
  }

  static override async deleteNotification(id: string, storeId: string, tx: any = defaultPrisma) {
    return super.deleteNotification(id, storeId, tx);
  }

  static override async dismissAllNotifications(storeId: string, tx: any = defaultPrisma) {
    return super.dismissAllNotifications(storeId, tx);
  }

  static override async snoozeNotification(id: string, storeId: string, minutes: number, tx: any = defaultPrisma) {
    return super.snoozeNotification(id, storeId, minutes, tx);
  }

  static override async checkLowStockProducts(storeId?: string, tx: any = defaultPrisma) {
    return super.checkLowStockProducts(storeId, tx);
  }

  static override async checkDebtDue(storeId: string, tx: any = defaultPrisma) {
    return super.checkDebtDue(storeId, tx);
  }

  static override async cleanupPaidDebtNotifications(storeId: string, tx: any = defaultPrisma) {
    return super.cleanupPaidDebtNotifications(storeId, tx);
  }

  static override async checkExpiredProducts(storeId: string, tx: any = defaultPrisma) {
    return super.checkExpiredProducts(storeId, tx);
  }
}
