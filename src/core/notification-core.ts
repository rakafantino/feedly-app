import { 
  AppNotification, 
  StockNotificationMetadata, 
  DebtNotificationMetadata, 
  ExpiredNotificationMetadata,
  NotificationWithRelations 
} from './notification-types';

/**
 * Pure function: Transform Prisma Notification to AppNotification
 * No side effects, no I/O - just transformation
 */
export function toAppNotification(
  n: NotificationWithRelations
): AppNotification {
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

/**
 * Pure function: Format currency to Rupiah
 * No side effects, no I/O
 */
export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', { 
    style: 'currency', 
    currency: 'IDR' 
  }).format(amount);
}

/**
 * Pure function: Calculate snooze until time
 * No side effects, no I/O
 */
export function calculateSnoozeUntil(minutes: number): Date {
  const until = new Date();
  until.setMinutes(until.getMinutes() + minutes);
  return until;
}

/**
 * Pure function: Check if snooze is still active
 * No side effects, no I/O
 */
export function isSnoozed(snoozedUntil: Date | null | undefined): boolean {
  if (!snoozedUntil) return false;
  return new Date(snoozedUntil) > new Date();
}

/**
 * Pure function: Calculate hours since a given date
 * No side effects, no I/O
 */
export function hoursSince(date: Date): number {
  return (new Date().getTime() - new Date(date).getTime()) / (1000 * 60 * 60);
}

/**
 * Pure function: Generate notification title for stock alert
 * No side effects, no I/O
 */
export function generateStockNotificationTitle(
  productName: string, 
  isReminder: boolean
): string {
  return isReminder 
    ? `Reminder: Stok Menipis - ${productName}` 
    : `Stok Menipis: ${productName}`;
}

/**
 * Pure function: Generate notification message for stock alert
 * No side effects, no I/O
 */
export function generateStockNotificationMessage(
  productName: string,
  currentStock: number,
  unit: string
): string {
  return `Stok saat ini: ${currentStock} ${unit}`;
}

/**
 * Pure function: Generate notification title for debt reminder
 * No side effects, no I/O
 */
export function generateDebtNotificationTitle(
  customerName: string,
  isSupplier: boolean,
  isReminder: boolean
): string {
  const label = isSupplier ? 'Hutang Jatuh Tempo' : 'Jatuh Tempo';
  const name = isSupplier ? '' : ` - ${customerName}`;
  return isReminder 
    ? `Reminder: ${label}${name}` 
    : isSupplier && !customerName 
      ? `${label}:` 
      : `${label}: ${customerName || 'Pelanggan'}`;
}

/**
 * Pure function: Generate notification message for debt
 * No side effects, no I/O
 */
export function generateDebtNotificationMessage(
  invoiceNumber: string,
  remainingAmount: number,
  isSupplier: boolean
): string {
  const label = isSupplier ? 'hutang' : 'tagihan';
  return `Sisa ${label}: ${formatRupiah(remainingAmount)}`;
}

/**
 * Pure function: Generate notification title for expired product
 * No side effects, no I/O
 */
export function generateExpiredNotificationTitle(
  productName: string,
  daysLeft: number
): string {
  return daysLeft < 0 
    ? `Kadaluarsa: ${productName}` 
    : `Hampir Kadaluarsa: ${productName}`;
}

/**
 * Pure function: Generate notification message for expired product
 * No side effects, no I/O
 */
export function generateExpiredNotificationMessage(
  productName: string,
  daysLeft: number,
  batchNumber?: string
): string {
  const batchInfo = `Batch: ${batchNumber || '-'}`;
  if (daysLeft < 0) {
    return `Produk telah kadaluarsa ${Math.abs(daysLeft)} hari yang lalu (${batchInfo})`;
  }
  return `Akan kadaluarsa dalam ${daysLeft} hari (${batchInfo})`;
}

// ============================================================================
// PURE FUNCTIONS FOR COMPLEX BUSINESS LOGIC (Plan 2)
// ============================================================================

/**
 * Pure function: Calculate IDs of stale stock notifications
 * Identifies notifications for products that are no longer low stock
 */
export function calculateStaleStockNotificationIds(
  existingNotifications: Array<{ id: string; productId: string | null }>,
  currentLowStockProductIds: Set<string>
): string[] {
  return existingNotifications
    .filter(n => !n.productId || !currentLowStockProductIds.has(n.productId))
    .map(n => n.id);
}

/**
 * Pure function: Determine if stock notification should be updated
 * Returns object with update info
 */
export function shouldUpdateStockNotification(params: {
  existing: { snoozedUntil: Date | null; metadata: any; isRead: boolean; updatedAt: Date; createdAt: Date };
  currentStock: number;
  intervalHours: number;
}): { shouldUpdate: boolean; isReminder: boolean; stockChanged: boolean } {
  const { existing, currentStock, intervalHours } = params;

  // Skip if snoozed
  if (isSnoozed(existing.snoozedUntil)) {
    return { shouldUpdate: false, isReminder: false, stockChanged: false };
  }

  const existingMeta = existing.metadata as any || {};
  const lastUpdated = new Date(existing.updatedAt || existing.createdAt);
  const hoursSinceUpdate = hoursSince(lastUpdated);

  const stockChanged = existingMeta.currentStock !== currentStock;
  const shouldRemind = existing.isRead && hoursSinceUpdate > intervalHours;

  return {
    shouldUpdate: stockChanged || shouldRemind,
    isReminder: shouldRemind,
    stockChanged
  };
}

/**
 * Pure function: Create stock notification metadata
 */
export function createStockMetadata(params: {
  currentStock: number;
  threshold: number;
  unit: string;
  category?: string;
  price?: number;
  supplierId?: string | null;
}): StockNotificationMetadata {
  return {
    currentStock: params.currentStock,
    threshold: params.threshold,
    unit: params.unit,
    category: params.category ?? undefined,
    price: params.price ?? undefined,
    supplierId: params.supplierId ?? null
  };
}

/**
 * Pure function: Create debt notification metadata
 */
export function createDebtMetadata(params: {
  invoiceNumber: string;
  customerName: string;
  amountPaid: number;
  remainingAmount: number;
  dueDate: Date;
  isSupplier?: boolean;
}): DebtNotificationMetadata & { isSupplier?: boolean } {
  return {
    invoiceNumber: params.invoiceNumber,
    customerName: params.customerName,
    amountPaid: params.amountPaid,
    remainingAmount: params.remainingAmount,
    dueDate: params.dueDate,
    isSupplier: params.isSupplier
  };
}

/**
 * Pure function: Determine if debt notification should be updated
 */
export function shouldUpdateDebtNotification(params: {
  existing: { snoozedUntil: Date | null; metadata: any; isRead: boolean; updatedAt: Date; createdAt: Date };
  remainingAmount: number;
  intervalHours: number;
}): { shouldUpdate: boolean; isReminder: boolean; amountChanged: boolean } {
  const { existing, remainingAmount, intervalHours } = params;

  if (isSnoozed(existing.snoozedUntil)) {
    return { shouldUpdate: false, isReminder: false, amountChanged: false };
  }

  const existingMeta = existing.metadata as any || {};
  const lastUpdated = new Date(existing.updatedAt || existing.createdAt);
  const hoursSinceUpdate = hoursSince(lastUpdated);

  const amountChanged = existingMeta.remainingAmount !== remainingAmount;
  const shouldRemind = existing.isRead && hoursSinceUpdate > intervalHours;

  return {
    shouldUpdate: amountChanged || shouldRemind,
    isReminder: shouldRemind,
    amountChanged
  };
}

/**
 * Pure function: Create expired notification metadata
 */
export function createExpiredMetadata(params: {
  expiryDate: Date;
  batchNumber?: string;
  daysLeft: number;
  currentStock: number;
  unit: string;
}): ExpiredNotificationMetadata {
  return {
    expiryDate: params.expiryDate,
    batchNumber: params.batchNumber,
    daysLeft: params.daysLeft,
    currentStock: params.currentStock,
    unit: params.unit
  };
}

/**
 * Pure function: Determine if expired notification should be updated
 */
export function shouldUpdateExpiredNotification(params: {
  existing: { snoozedUntil: Date | null; isRead: boolean; updatedAt: Date; createdAt: Date; metadata: any };
  intervalHours: number;
  currentDaysLeft: number;
}): { shouldUpdate: boolean; isReminder: boolean; daysChanged: boolean } {
  const { existing, intervalHours, currentDaysLeft } = params;

  if (isSnoozed(existing.snoozedUntil)) {
    return { shouldUpdate: false, isReminder: false, daysChanged: false };
  }

  const lastUpdated = new Date(existing.updatedAt || existing.createdAt);
  const hoursSinceUpdate = hoursSince(lastUpdated);

  const shouldRemind = existing.isRead && hoursSinceUpdate > intervalHours;
  const daysChanged = (existing.metadata as any)?.daysLeft !== currentDaysLeft;

  return {
    shouldUpdate: shouldRemind || daysChanged,
    isReminder: shouldRemind,
    daysChanged
  };
}

/**
 * Pure function: Calculate expired notification signatures for cleanup
 */
export function calculateExpiredNotificationSignatures(
  expiringItems: Array<{ originalId?: string; id: string; batch_number?: string }>
): Set<string> {
  return new Set(expiringItems.map(item => {
    return `${item.originalId || item.id}|${item.batch_number || ''}`;
  }));
}

/**
 * Pure function: Filter notifications to delete for expired items cleanup
 */
export function filterExpiredNotificationsToDelete(
  activeNotifications: Array<{ id: string; productId: string | null; metadata: any }>,
  validSignatures: Set<string>
): string[] {
  return activeNotifications
    .filter(n => {
      const m = n.metadata as any;
      const signature = `${n.productId}|${m?.batchNumber || ''}`;
      return !validSignatures.has(signature);
    })
    .map(n => n.id);
}

/**
 * Pure function: Find matching expired notification by batch number
 */
export function findMatchingExpiredNotification(
  allNotifications: Array<{ metadata: any }>,
  batchNumber: string | undefined
): boolean {
  return allNotifications.some(n => {
    const m = n.metadata as any;
    return m?.batchNumber === batchNumber;
  });
}

/**
 * Pure function: Check if paid transaction/PO IDs match notification IDs
 */
export function filterPaidNotificationIds(
  notifications: Array<{ id: string; transactionId?: string | null; purchaseOrderId?: string | null }>,
  paidIds: Set<string>
): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  
  for (const n of notifications) {
    if (n.transactionId && paidIds.has(n.transactionId) && !seen.has(n.id)) {
      result.push(n.id);
      seen.add(n.id);
    }
    if (n.purchaseOrderId && paidIds.has(n.purchaseOrderId) && !seen.has(n.id)) {
      result.push(n.id);
      seen.add(n.id);
    }
  }
  
  return result;
}
