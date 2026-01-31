// Re-export types from core
export * from '../core/notification-types';

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
  generateExpiredNotificationMessage
} from '../core/notification-core';

// Re-export shell class
export { NotificationShell } from '../shell/notification-shell';

// Legacy class for backward compatibility
import { NotificationShell } from '../shell/notification-shell';
import { Prisma } from "@prisma/client";

export class NotificationService extends NotificationShell {
  
  // Keep static methods for backward compatibility
  // They delegate to parent class (NotificationShell)
  
  static override async createNotification(data: Prisma.NotificationUncheckedCreateInput) {
    return super.createNotification(data);
  }

  static override async getNotifications(storeId: string, filter?: { isRead?: boolean }) {
    return super.getNotifications(storeId, filter);
  }

  static override async markAsRead(id: string, storeId: string) {
    return super.markAsRead(id, storeId);
  }

  static override async markAllAsRead(storeId: string) {
    return super.markAllAsRead(storeId);
  }

  static override async deleteNotification(id: string, storeId: string) {
    return super.deleteNotification(id, storeId);
  }

  static override async dismissAllNotifications(storeId: string) {
    return super.dismissAllNotifications(storeId);
  }

  static override async snoozeNotification(id: string, storeId: string, minutes: number) {
    return super.snoozeNotification(id, storeId, minutes);
  }

  static override async checkLowStockProducts(storeId?: string) {
    return super.checkLowStockProducts(storeId);
  }

  static override async checkDebtDue(storeId: string) {
    return super.checkDebtDue(storeId);
  }

  static override async cleanupPaidDebtNotifications(storeId: string) {
    return super.cleanupPaidDebtNotifications(storeId);
  }

  static override async checkExpiredProducts(storeId: string) {
    return super.checkExpiredProducts(storeId);
  }
}
