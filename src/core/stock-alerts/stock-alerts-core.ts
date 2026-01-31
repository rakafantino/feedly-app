// ============================================================================
// TYPES
// ============================================================================

export interface StockNotification {
  id: string;
  type: 'LOW_STOCK' | 'OUT_OF_STOCK' | 'EXPIRED' | 'EXPIRING_SOON';
  productId: string;
  productName: string;
  productCode?: string | null;
  category?: string | null;
  currentStock: number;
  threshold?: number | null;
  storeId: string;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
  product?: {
    id: string;
    name: string;
    product_code?: string | null;
    category?: string | null;
    stock: number;
    threshold?: number | null;
    price?: number | null;
  };
}

export interface AlertFilter {
  type: string;
  search: string;
  showRead: boolean;
}

export interface AlertStats {
  total: number;
  unread: number;
  byType: Record<string, number>;
}

export interface PaginationState {
  page: number;
  pageSize: number;
  totalItems: number;
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Create initial filter state
 * Pure function - no side effects
 */
export function createInitialFilterState(): AlertFilter {
  return {
    type: 'all',
    search: '',
    showRead: false
  };
}

/**
 * Create initial pagination state
 * Pure function - no side effects
 */
export function createInitialPaginationState(): PaginationState {
  return {
    page: 1,
    pageSize: 20,
    totalItems: 0
  };
}

// ============================================================================
// FILTERING
// ============================================================================

/**
 * Filter notifications by all criteria
 * Pure function - no side effects
 */
export function filterNotifications(notifications: StockNotification[], filter: AlertFilter): StockNotification[] {
  return notifications.filter(notification => {
    // Filter by type
    if (filter.type !== 'all' && notification.type !== filter.type) {
      return false;
    }
    
    // Filter by read status
    if (!filter.showRead && notification.isRead) {
      return false;
    }
    
    // Filter by search
    if (filter.search.trim()) {
      const query = filter.search.toLowerCase();
      return (
        notification.productName.toLowerCase().includes(query) ||
        notification.productCode?.toLowerCase().includes(query) ||
        notification.category?.toLowerCase().includes(query)
      );
    }
    
    return true;
  });
}

/**
 * Filter by notification type
 * Pure function - no side effects
 */
export function filterByType(notifications: StockNotification[], type: string): StockNotification[] {
  if (type === 'all') return notifications;
  return notifications.filter(n => n.type === type);
}

/**
 * Filter unread only
 * Pure function - no side effects
 */
export function filterUnread(notifications: StockNotification[]): StockNotification[] {
  return notifications.filter(n => !n.isRead);
}

/**
 * Filter read only
 * Pure function - no side effects
 */
export function filterRead(notifications: StockNotification[]): StockNotification[] {
  return notifications.filter(n => n.isRead);
}

/**
 * Search notifications
 * Pure function - no side effects
 */
export function searchNotifications(notifications: StockNotification[], query: string): StockNotification[] {
  if (!query.trim()) return notifications;
  
  const searchTerm = query.toLowerCase();
  return notifications.filter(n =>
    n.productName.toLowerCase().includes(searchTerm) ||
    n.productCode?.toLowerCase().includes(searchTerm) ||
    n.category?.toLowerCase().includes(searchTerm)
  );
}

// ============================================================================
// SORTING
// ============================================================================

/**
 * Sort notifications by date (newest first)
 * Pure function - no side effects
 */
export function sortByDate(notifications: StockNotification[], direction: 'asc' | 'desc' = 'desc'): StockNotification[] {
  return [...notifications].sort((a, b) => {
    const dateA = new Date(a.createdAt).getTime();
    const dateB = new Date(b.createdAt).getTime();
    return direction === 'desc' ? dateB - dateA : dateA - dateB;
  });
}

/**
 * Sort by read status (unread first)
 * Pure function - no side effects
 */
export function sortByReadStatus(notifications: StockNotification[]): StockNotification[] {
  return [...notifications].sort((a, b) => {
    if (a.isRead === b.isRead) return 0;
    return a.isRead ? 1 : -1;
  });
}

/**
 * Sort by urgency (critical first)
 * Pure function - no side effects
 */
export function sortByUrgency(notifications: StockNotification[]): StockNotification[] {
  const urgencyOrder: Record<string, number> = {
    'OUT_OF_STOCK': 0,
    'EXPIRED': 1,
    'LOW_STOCK': 2,
    'EXPIRING_SOON': 3
  };
  
  return [...notifications].sort((a, b) => {
    const aOrder = urgencyOrder[a.type] ?? 99;
    const bOrder = urgencyOrder[b.type] ?? 99;
    return aOrder - bOrder;
  });
}

// ============================================================================
// STATISTICS
// ============================================================================

/**
 * Calculate alert statistics
 * Pure function - no side effects
 */
export function calculateAlertStats(notifications: StockNotification[]): AlertStats {
  const unread = notifications.filter(n => !n.isRead);
  const byType: Record<string, number> = {};
  
  notifications.forEach(n => {
    byType[n.type] = (byType[n.type] || 0) + 1;
  });
  
  return {
    total: notifications.length,
    unread: unread.length,
    byType
  };
}

/**
 * Get unread count
 * Pure function - no side effects
 */
export function getUnreadCount(notifications: StockNotification[]): number {
  return notifications.filter(n => !n.isRead).length;
}

/**
 * Get count by type
 * Pure function - no side effects
 */
export function getCountByType(notifications: StockNotification[], type: string): number {
  return notifications.filter(n => n.type === type).length;
}

/**
 * Check if there are critical alerts
 * Pure function - no side effects
 */
export function hasCriticalAlerts(notifications: StockNotification[]): boolean {
  return notifications.some(n => 
    n.type === 'OUT_OF_STOCK' || n.type === 'EXPIRED'
  );
}

/**
 * Get alerts by product
 * Pure function - no side effects
 */
export function getAlertsByProduct(notifications: StockNotification[]): Record<string, StockNotification[]> {
  const grouped: Record<string, StockNotification[]> = {};
  
  notifications.forEach(n => {
    if (!grouped[n.productId]) {
      grouped[n.productId] = [];
    }
    grouped[n.productId].push(n);
  });
  
  return grouped;
}

// ============================================================================
// PROCESSING
// ============================================================================

/**
 * Mark notification as read
 * Pure function - no side effects
 */
export function markAsRead(notifications: StockNotification[], id: string): StockNotification[] {
  return notifications.map(n =>
    n.id === id ? { ...n, isRead: true } : n
  );
}

/**
 * Mark all as read
 * Pure function - no side effects
 */
export function markAllAsRead(notifications: StockNotification[]): StockNotification[] {
  return notifications.map(n => ({ ...n, isRead: true }));
}

/**
 * Mark selected as read
 * Pure function - no side effects
 */
export function markSelectedAsRead(notifications: StockNotification[], ids: string[]): StockNotification[] {
  const idSet = new Set(ids);
  return notifications.map(n =>
    idSet.has(n.id) ? { ...n, isRead: true } : n
  );
}

/**
 * Delete notification
 * Pure function - no side effects
 */
export function deleteNotification(notifications: StockNotification[], id: string): StockNotification[] {
  return notifications.filter(n => n.id !== id);
}

/**
 * Delete selected notifications
 * Pure function - no side effects
 */
export function deleteSelected(notifications: StockNotification[], ids: string[]): StockNotification[] {
  const idSet = new Set(ids);
  return notifications.filter(n => !idSet.has(n.id));
}

/**
 * Clear all read notifications
 * Pure function - no side effects
 */
export function clearRead(notifications: StockNotification[]): StockNotification[] {
  return notifications.filter(n => !n.isRead);
}

/**
 * Group notifications by type
 * Pure function - no side effects
 */
export function groupByType(notifications: StockNotification[]): Record<string, StockNotification[]> {
  const grouped: Record<string, StockNotification[]> = {};
  
  notifications.forEach(n => {
    if (!grouped[n.type]) {
      grouped[n.type] = [];
    }
    grouped[n.type].push(n);
  });
  
  return grouped;
}

/**
 * Get unique products from notifications
 * Pure function - no side effects
 */
export function getUniqueProducts(notifications: StockNotification[]): string[] {
  return Array.from(new Set(notifications.map(n => n.productId)));
}

// ============================================================================
// PAGINATION
// ============================================================================

/**
 * Paginate notifications
 * Pure function - no side effects
 */
export function paginateNotifications(
  notifications: StockNotification[],
  page: number,
  pageSize: number
): StockNotification[] {
  const start = (page - 1) * pageSize;
  return notifications.slice(start, start + pageSize);
}

/**
 * Calculate pagination metadata
 * Pure function - no side effects
 */
export function calculatePagination(
  totalItems: number,
  page: number,
  pageSize: number
): PaginationState & { totalPages: number; hasNext: boolean; hasPrev: boolean } {
  const totalPages = Math.ceil(totalItems / pageSize);
  
  return {
    page,
    pageSize,
    totalItems,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1
  };
}

/**
 * Get page range
 * Pure function - no side effects
 */
export function getPageRange(currentPage: number, totalPages: number, maxVisible: number = 5): number[] {
  const pages: number[] = [];
  
  let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  const end = Math.min(totalPages, start + maxVisible - 1);
  
  if (end - start + 1 < maxVisible) {
    start = Math.max(1, end - maxVisible + 1);
  }
  
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }
  
  return pages;
}

// ============================================================================
// FORMATTING
// ============================================================================

/**
 * Get alert type label
 * Pure function - no side effects
 */
export function getAlertTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    'LOW_STOCK': 'Stok Rendah',
    'OUT_OF_STOCK': 'Habis',
    'EXPIRED': 'Kadaluarsa',
    'EXPIRING_SOON': 'Segera Kadaluarsa'
  };
  return labels[type] || type;
}

/**
 * Get alert type description
 * Pure function - no side effects
 */
export function getAlertTypeDescription(type: string, productName: string, currentStock: number): string {
  const descriptions: Record<string, string> = {
    'LOW_STOCK': `${productName} memiliki stok rendah (${currentStock} tersisa)`,
    'OUT_OF_STOCK': `${productName} sudah habis`,
    'EXPIRED': `${productName} telah kadaluarsa`,
    'EXPIRING_SOON': `${productName} akan segera kadaluarsa (${currentStock} tersisa)`
  };
  return descriptions[type] || '';
}

/**
 * Get alert icon name
 * Pure function - no side effects
 */
export function getAlertIcon(type: string): string {
  const icons: Record<string, string> = {
    'LOW_STOCK': 'AlertCircle',
    'OUT_OF_STOCK': 'Package',
    'EXPIRED': 'Clock',
    'EXPIRING_SOON': 'Clock'
  };
  return icons[type] || 'Bell';
}

/**
 * Get alert color class
 * Pure function - no side effects
 */
export function getAlertColor(type: string): string {
  const colors: Record<string, string> = {
    'LOW_STOCK': 'warning',
    'OUT_OF_STOCK': 'destructive',
    'EXPIRED': 'destructive',
    'EXPIRING_SOON': 'secondary'
  };
  return colors[type] || 'default';
}

/**
 * Format date for display
 * Pure function - no side effects
 */
export function formatAlertDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Get relative time
 * Pure function - no side effects
 */
export function getRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Baru saja';
  if (diffMins < 60) return `${diffMins} menit lalu`;
  if (diffHours < 24) return `${diffHours} jam lalu`;
  if (diffDays < 7) return `${diffDays} hari lalu`;
  
  return formatAlertDate(dateString);
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Check if notification is valid
 * Pure function - no side effects
 */
export function isValidNotification(notification: Partial<StockNotification>): boolean {
  return !!(
    notification.id &&
    notification.productId &&
    notification.productName &&
    notification.type &&
    notification.storeId
  );
}

/**
 * Check if can be marked as read
 * Pure function - no side effects
 */
export function canMarkAsRead(notification: StockNotification): boolean {
  return !notification.isRead;
}

/**
 * Check if can be deleted
 * Pure function - no side effects
 */
export function canDelete(): boolean {
  return true; // All notifications can be deleted
}

/**
 * Check if bulk action is available
 * Pure function - no side effects
 */
export function canPerformBulkAction(notifications: StockNotification[], selectedIds: string[]): {
  canMarkRead: boolean;
  canDelete: boolean;
} {
  const selected = notifications.filter(n => selectedIds.includes(n.id));
  
  return {
    canMarkRead: selected.some(n => !n.isRead),
    canDelete: selected.length > 0
  };
}

// ============================================================================
// EXPORT
// ============================================================================

/**
 * Prepare notifications for export
 * Pure function - no side effects
 */
export function prepareNotificationsExport(notifications: StockNotification[]): Array<Record<string, string>> {
  return notifications.map(n => ({
    'Produk': n.productName,
    'Kode': n.productCode || '-',
    'Jenis': getAlertTypeLabel(n.type),
    'Stok Saat Ini': n.currentStock.toString(),
    'Threshold': n.threshold?.toString() || '-',
    'Status': n.isRead ? 'Dibaca' : 'Belum Dibaca',
    'Tanggal': formatAlertDate(n.createdAt)
  }));
}

/**
 * Get summary text for export
 * Pure function - no side effects
 */
export function getExportSummary(stats: AlertStats): string {
  const parts: string[] = [];
  parts.push(`Total: ${stats.total}`);
  parts.push(`Belum Dibaca: ${stats.unread}`);
  
  Object.entries(stats.byType).forEach(([type, count]) => {
    parts.push(`${getAlertTypeLabel(type)}: ${count}`);
  });
  
  return parts.join(', ');
}
