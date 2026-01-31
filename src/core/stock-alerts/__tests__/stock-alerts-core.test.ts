/**
 * TDD Tests for stock-alerts-core.ts
 * Edge cases first, then normal cases
 */

import {
  // Initialization
  createInitialFilterState,
  createInitialPaginationState,
  
  // Filtering
  filterNotifications,
  filterByType,
  filterUnread,
  filterRead,
  searchNotifications,
  
  // Sorting
  sortByDate,
  sortByReadStatus,
  sortByUrgency,
  
  // Statistics
  calculateAlertStats,
  getUnreadCount,
  getCountByType,
  hasCriticalAlerts,
  getAlertsByProduct,
  
  // Processing
  markAsRead,
  markAllAsRead,
  markSelectedAsRead,
  deleteNotification,
  deleteSelected,
  clearRead,
  groupByType,
  getUniqueProducts,
  
  // Pagination
  paginateNotifications,
  calculatePagination,
  getPageRange,
  
  // Formatting
  getAlertTypeLabel,
  getAlertTypeDescription,
  getAlertIcon,
  getAlertColor,
  formatAlertDate,
  getRelativeTime,
  
  // Validation
  isValidNotification,
  canMarkAsRead,
  canDelete,
  canPerformBulkAction,
  
  // Export
  prepareNotificationsExport,
  getExportSummary
} from '../stock-alerts-core';
import { StockNotification, AlertFilter } from '../stock-alerts-core';

// Mock helpers
const createMockNotification = (overrides: Partial<StockNotification> = {}): StockNotification => ({
  id: 'notif-1',
  type: 'LOW_STOCK',
  productId: 'prod-1',
  productName: 'Test Product',
  productCode: 'TEST-001',
  category: 'Electronics',
  currentStock: 5,
  threshold: 10,
  storeId: 'store-1',
  isRead: false,
  createdAt: '2025-01-15T10:00:00Z',
  updatedAt: '2025-01-15T10:00:00Z',
  ...overrides
});

describe('createInitialFilterState', () => {
  it('creates default filter state', () => {
    const result = createInitialFilterState();
    expect(result.type).toBe('all');
    expect(result.search).toBe('');
    expect(result.showRead).toBe(false);
  });
});

describe('createInitialPaginationState', () => {
  it('creates default pagination state', () => {
    const result = createInitialPaginationState();
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
    expect(result.totalItems).toBe(0);
  });
});

describe('filterNotifications', () => {
  it('returns all when no filters', () => {
    const notifications = [createMockNotification(), createMockNotification()];
    const result = filterNotifications(notifications, createInitialFilterState());
    expect(result.length).toBe(2);
  });
  
  it('filters by type', () => {
    const notifications = [
      createMockNotification({ type: 'LOW_STOCK' }),
      createMockNotification({ type: 'OUT_OF_STOCK' })
    ];
    const filter: AlertFilter = { ...createInitialFilterState(), type: 'OUT_OF_STOCK' };
    const result = filterNotifications(notifications, filter);
    expect(result.length).toBe(1);
    expect(result[0].type).toBe('OUT_OF_STOCK');
  });
  
  it('filters unread only', () => {
    const notifications = [
      createMockNotification({ isRead: false }),
      createMockNotification({ isRead: true })
    ];
    const filter: AlertFilter = { ...createInitialFilterState(), showRead: false };
    const result = filterNotifications(notifications, filter);
    expect(result.length).toBe(1);
    expect(result[0].isRead).toBe(false);
  });
  
  it('filters by search', () => {
    const notifications = [
      createMockNotification({ productName: 'Laptop' }),
      createMockNotification({ productName: 'Mouse' })
    ];
    const filter: AlertFilter = { ...createInitialFilterState(), search: 'lap' };
    const result = filterNotifications(notifications, filter);
    expect(result.length).toBe(1);
    expect(result[0].productName).toBe('Laptop');
  });
});

describe('filterByType', () => {
  it('returns all for all type', () => {
    const notifications = [createMockNotification(), createMockNotification()];
    const result = filterByType(notifications, 'all');
    expect(result.length).toBe(2);
  });
  
  it('filters correctly', () => {
    const notifications = [
      createMockNotification({ type: 'LOW_STOCK' }),
      createMockNotification({ type: 'OUT_OF_STOCK' })
    ];
    const result = filterByType(notifications, 'OUT_OF_STOCK');
    expect(result.length).toBe(1);
  });
});

describe('filterUnread', () => {
  it('filters unread only', () => {
    const notifications = [
      createMockNotification({ isRead: false }),
      createMockNotification({ isRead: true })
    ];
    const result = filterUnread(notifications);
    expect(result.length).toBe(1);
    expect(result[0].isRead).toBe(false);
  });
});

describe('filterRead', () => {
  it('filters read only', () => {
    const notifications = [
      createMockNotification({ isRead: false }),
      createMockNotification({ isRead: true })
    ];
    const result = filterRead(notifications);
    expect(result.length).toBe(1);
    expect(result[0].isRead).toBe(true);
  });
});

describe('searchNotifications', () => {
  it('searches by product name', () => {
    const notifications = [
      createMockNotification({ productName: 'Laptop Gaming' }),
      createMockNotification({ productName: 'Mouse Wireless' })
    ];
    const result = searchNotifications(notifications, 'gaming');
    expect(result.length).toBe(1);
  });
  
  it('searches by product code', () => {
    const notifications = [
      createMockNotification({ productCode: 'LAP-001' }),
      createMockNotification({ productCode: 'MOU-001' })
    ];
    const result = searchNotifications(notifications, 'LAP');
    expect(result.length).toBe(1);
  });
});

describe('sortByDate', () => {
  it('sorts newest first by default', () => {
    const notifications = [
      createMockNotification({ id: '1', createdAt: '2025-01-15T10:00:00Z' }),
      createMockNotification({ id: '2', createdAt: '2025-01-15T12:00:00Z' })
    ];
    const result = sortByDate(notifications);
    expect(result[0].id).toBe('2');
  });
  
  it('sorts oldest first when asc', () => {
    const notifications = [
      createMockNotification({ id: '1', createdAt: '2025-01-15T10:00:00Z' }),
      createMockNotification({ id: '2', createdAt: '2025-01-15T12:00:00Z' })
    ];
    const result = sortByDate(notifications, 'asc');
    expect(result[0].id).toBe('1');
  });
});

describe('sortByReadStatus', () => {
  it('sorts unread first', () => {
    const notifications = [
      createMockNotification({ id: '1', isRead: true }),
      createMockNotification({ id: '2', isRead: false })
    ];
    const result = sortByReadStatus(notifications);
    expect(result[0].id).toBe('2');
  });
});

describe('sortByUrgency', () => {
  it('sorts by urgency order', () => {
    const notifications = [
      createMockNotification({ id: '1', type: 'LOW_STOCK' }),
      createMockNotification({ id: '2', type: 'OUT_OF_STOCK' }),
      createMockNotification({ id: '3', type: 'EXPIRED' })
    ];
    const result = sortByUrgency(notifications);
    expect(result[0].type).toBe('OUT_OF_STOCK');
    expect(result[1].type).toBe('EXPIRED');
    expect(result[2].type).toBe('LOW_STOCK');
  });
});

describe('calculateAlertStats', () => {
  it('calculates stats correctly', () => {
    const notifications = [
      createMockNotification({ type: 'LOW_STOCK', isRead: false }),
      createMockNotification({ type: 'OUT_OF_STOCK', isRead: false }),
      createMockNotification({ type: 'LOW_STOCK', isRead: true })
    ];
    const result = calculateAlertStats(notifications);
    expect(result.total).toBe(3);
    expect(result.unread).toBe(2);
    expect(result.byType['LOW_STOCK']).toBe(2);
    expect(result.byType['OUT_OF_STOCK']).toBe(1);
  });
});

describe('getUnreadCount', () => {
  it('counts unread correctly', () => {
    const notifications = [
      createMockNotification({ isRead: false }),
      createMockNotification({ isRead: true }),
      createMockNotification({ isRead: false })
    ];
    expect(getUnreadCount(notifications)).toBe(2);
  });
});

describe('getCountByType', () => {
  it('counts by type correctly', () => {
    const notifications = [
      createMockNotification({ type: 'LOW_STOCK' }),
      createMockNotification({ type: 'OUT_OF_STOCK' }),
      createMockNotification({ type: 'LOW_STOCK' })
    ];
    expect(getCountByType(notifications, 'LOW_STOCK')).toBe(2);
    expect(getCountByType(notifications, 'OUT_OF_STOCK')).toBe(1);
  });
});

describe('hasCriticalAlerts', () => {
  it('returns true for critical alerts', () => {
    const notifications = [
      createMockNotification({ type: 'OUT_OF_STOCK' })
    ];
    expect(hasCriticalAlerts(notifications)).toBe(true);
  });
  
  it('returns false for non-critical', () => {
    const notifications = [
      createMockNotification({ type: 'LOW_STOCK' })
    ];
    expect(hasCriticalAlerts(notifications)).toBe(false);
  });
});

describe('getAlertsByProduct', () => {
  it('groups by product', () => {
    const notifications = [
      createMockNotification({ id: '1', productId: 'prod-1', type: 'LOW_STOCK' }),
      createMockNotification({ id: '2', productId: 'prod-1', type: 'OUT_OF_STOCK' }),
      createMockNotification({ id: '3', productId: 'prod-2', type: 'LOW_STOCK' })
    ];
    const result = getAlertsByProduct(notifications);
    expect(result['prod-1'].length).toBe(2);
    expect(result['prod-2'].length).toBe(1);
  });
});

describe('markAsRead', () => {
  it('marks specific notification as read', () => {
    const notifications = [
      createMockNotification({ id: '1', isRead: false }),
      createMockNotification({ id: '2', isRead: false })
    ];
    const result = markAsRead(notifications, '1');
    expect(result[0].isRead).toBe(true);
    expect(result[1].isRead).toBe(false);
  });
});

describe('markAllAsRead', () => {
  it('marks all as read', () => {
    const notifications = [
      createMockNotification({ isRead: false }),
      createMockNotification({ isRead: false })
    ];
    const result = markAllAsRead(notifications);
    expect(result.every(n => n.isRead)).toBe(true);
  });
});

describe('markSelectedAsRead', () => {
  it('marks selected as read', () => {
    const notifications = [
      createMockNotification({ id: '1', isRead: false }),
      createMockNotification({ id: '2', isRead: false })
    ];
    const result = markSelectedAsRead(notifications, ['1']);
    expect(result[0].isRead).toBe(true);
    expect(result[1].isRead).toBe(false);
  });
});

describe('deleteNotification', () => {
  it('removes notification by id', () => {
    const notifications = [
      createMockNotification({ id: '1' }),
      createMockNotification({ id: '2' })
    ];
    const result = deleteNotification(notifications, '1');
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('2');
  });
});

describe('deleteSelected', () => {
  it('removes selected notifications', () => {
    const notifications = [
      createMockNotification({ id: '1' }),
      createMockNotification({ id: '2' }),
      createMockNotification({ id: '3' })
    ];
    const result = deleteSelected(notifications, ['1', '3']);
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('2');
  });
});

describe('clearRead', () => {
  it('removes only read notifications', () => {
    const notifications = [
      createMockNotification({ id: '1', isRead: false }),
      createMockNotification({ id: '2', isRead: true }),
      createMockNotification({ id: '3', isRead: false })
    ];
    const result = clearRead(notifications);
    expect(result.length).toBe(2);
    expect(result.every(n => !n.isRead)).toBe(true);
  });
});

describe('groupByType', () => {
  it('groups by type', () => {
    const notifications = [
      createMockNotification({ type: 'LOW_STOCK' }),
      createMockNotification({ type: 'OUT_OF_STOCK' }),
      createMockNotification({ type: 'LOW_STOCK' })
    ];
    const result = groupByType(notifications);
    expect(result['LOW_STOCK'].length).toBe(2);
    expect(result['OUT_OF_STOCK'].length).toBe(1);
  });
});

describe('getUniqueProducts', () => {
  it('returns unique product ids', () => {
    const notifications = [
      createMockNotification({ productId: 'prod-1' }),
      createMockNotification({ productId: 'prod-2' }),
      createMockNotification({ productId: 'prod-1' })
    ];
    const result = getUniqueProducts(notifications);
    expect(result.length).toBe(2);
    expect(result).toContain('prod-1');
    expect(result).toContain('prod-2');
  });
});

describe('paginateNotifications', () => {
  it('returns correct page', () => {
    const notifications = Array.from({ length: 25 }, (_, i) => 
      createMockNotification({ id: String(i) })
    );
    const result = paginateNotifications(notifications, 1, 10);
    expect(result.length).toBe(10);
    expect(result[0].id).toBe('0');
  });
  
  it('returns second page', () => {
    const notifications = Array.from({ length: 25 }, (_, i) => 
      createMockNotification({ id: String(i) })
    );
    const result = paginateNotifications(notifications, 2, 10);
    expect(result.length).toBe(10);
    expect(result[0].id).toBe('10');
  });
});

describe('calculatePagination', () => {
  it('calculates correctly', () => {
    const result = calculatePagination(50, 2, 10);
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(10);
    expect(result.totalItems).toBe(50);
    expect(result.totalPages).toBe(5);
    expect(result.hasNext).toBe(true);
    expect(result.hasPrev).toBe(true);
  });
  
  it('handles last page', () => {
    const result = calculatePagination(50, 5, 10);
    expect(result.hasNext).toBe(false);
    expect(result.hasPrev).toBe(true);
  });
});

describe('getPageRange', () => {
  it('returns correct range', () => {
    const result = getPageRange(3, 10, 5);
    expect(result).toEqual([1, 2, 3, 4, 5]);
  });
  
  it('adjusts for edge pages', () => {
    expect(getPageRange(10, 10, 5)).toEqual([6, 7, 8, 9, 10]);
  });
});

describe('getAlertTypeLabel', () => {
  it('returns correct labels', () => {
    expect(getAlertTypeLabel('LOW_STOCK')).toBe('Stok Rendah');
    expect(getAlertTypeLabel('OUT_OF_STOCK')).toBe('Habis');
    expect(getAlertTypeLabel('EXPIRED')).toBe('Kadaluarsa');
    expect(getAlertTypeLabel('EXPIRING_SOON')).toBe('Segera Kadaluarsa');
  });
});

describe('getAlertTypeDescription', () => {
  it('returns correct description', () => {
    const result = getAlertTypeDescription('LOW_STOCK', 'Laptop', 5);
    expect(result).toContain('Laptop');
    expect(result).toContain('5');
  });
});

describe('getAlertIcon', () => {
  it('returns correct icons', () => {
    expect(getAlertIcon('LOW_STOCK')).toBe('AlertCircle');
    expect(getAlertIcon('OUT_OF_STOCK')).toBe('Package');
    expect(getAlertIcon('EXPIRED')).toBe('Clock');
  });
});

describe('getAlertColor', () => {
  it('returns correct colors', () => {
    expect(getAlertColor('LOW_STOCK')).toBe('warning');
    expect(getAlertColor('OUT_OF_STOCK')).toBe('destructive');
    expect(getAlertColor('EXPIRED')).toBe('destructive');
    expect(getAlertColor('EXPIRING_SOON')).toBe('secondary');
  });
});

describe('formatAlertDate', () => {
  it('formats date correctly', () => {
    const result = formatAlertDate('2025-01-15T10:30:00Z');
    expect(result).toContain('2025');
    expect(result).toContain('Jan');
  });
});

describe('getRelativeTime', () => {
  it('returns relative time for minutes', () => {
    const now = new Date();
    const fiveMinsAgo = new Date(now.getTime() - 5 * 60000);
    const result = getRelativeTime(fiveMinsAgo.toISOString());
    expect(result).toContain('menit');
  });
  
  it('returns relative time for hours', () => {
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 3600000);
    const result = getRelativeTime(twoHoursAgo.toISOString());
    expect(result).toContain('jam');
  });
});

describe('isValidNotification', () => {
  it('validates correctly', () => {
    expect(isValidNotification({
      id: '1',
      productId: 'p1',
      productName: 'Test',
      type: 'LOW_STOCK',
      storeId: 's1',
      currentStock: 5
    })).toBe(true);
  });
  
  it('rejects invalid', () => {
    expect(isValidNotification({ id: '1' })).toBe(false);
  });
});

describe('canMarkAsRead', () => {
  it('returns true for unread', () => {
    expect(canMarkAsRead(createMockNotification({ isRead: false }))).toBe(true);
  });
  
  it('returns false for read', () => {
    expect(canMarkAsRead(createMockNotification({ isRead: true }))).toBe(false);
  });
});

describe('canDelete', () => {
  it('always returns true', () => {
    expect(canDelete()).toBe(true);
  });
});

describe('canPerformBulkAction', () => {
  it('returns correct permissions', () => {
    const notifications = [
      createMockNotification({ id: '1', isRead: false }),
      createMockNotification({ id: '2', isRead: true })
    ];
    const result = canPerformBulkAction(notifications, ['1', '2']);
    expect(result.canMarkRead).toBe(true);
    expect(result.canDelete).toBe(true);
  });
  
  it('returns false when no unread selected', () => {
    const notifications = [
      createMockNotification({ id: '1', isRead: true }),
      createMockNotification({ id: '2', isRead: true })
    ];
    const result = canPerformBulkAction(notifications, ['1']);
    expect(result.canMarkRead).toBe(false);
  });
});

describe('prepareNotificationsExport', () => {
  it('prepares data correctly', () => {
    const notifications = [createMockNotification()];
    const result = prepareNotificationsExport(notifications);
    expect(result.length).toBe(1);
    expect(result[0]['Produk']).toBe('Test Product');
    expect(result[0]['Jenis']).toBe('Stok Rendah');
    expect(result[0]['Status']).toBe('Belum Dibaca');
  });
});

describe('getExportSummary', () => {
  it('returns summary text', () => {
    const stats = {
      total: 10,
      unread: 5,
      byType: { 'LOW_STOCK': 8, 'OUT_OF_STOCK': 2 }
    };
    const result = getExportSummary(stats);
    expect(result).toContain('Total: 10');
    expect(result).toContain('Belum Dibaca: 5');
  });
});
