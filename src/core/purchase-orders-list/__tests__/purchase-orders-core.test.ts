/**
 * TDD Tests for purchase-orders-core.ts
 * Edge cases first, then normal cases
 */

import {
  // Status helpers
  getPurchaseOrderStatusBadge,
  getPaymentStatusBadge,
  canEditOrder,
  canDeleteOrder,
  canViewOrder,
  
  // Calculations
  calculateOrderTotalAmount,
  calculateItemCount,
  calculateRemaining,
  calculatePaymentProgress,
  
  // Filtering
  matchesSearch,
  matchesStatus,
  matchesSupplier,
  matchesDateRange,
  applyFilters,
  getUniqueSuppliers,
  getUniqueStatuses,
  
  // Sorting
  sortOrders,
  toggleSort,
  
  // Pagination
  calculatePagination,
  getPaginatedOrders,
  isValidPage,
  getPaginationRange,
  
  // Data transformation
  formatDateForDisplay,
  formatCurrencyForDisplay,
  getStatusCounts,
  getPaymentSummary,
  
  // Initialization
  createInitialFilterState,
  createInitialSortState,
  createInitialPaginationState,
  resetFilters,
  resetPagination,
  
  // Bulk actions
  hasSelectedOrders,
  canDeleteSelected,
  
  // Export
  prepareForExport
} from '../purchase-orders-core';
import { PurchaseOrder, PurchaseOrderItem } from '../purchase-orders-core';

// Mock data helpers
const createMockItem = (overrides: Partial<PurchaseOrderItem> = {}): PurchaseOrderItem => ({
  id: 'item-1',
  productId: 'prod-1',
  productName: 'Test Product',
  quantity: '100',
  unit: 'pcs',
  price: '15000',
  ...overrides,
});

const createMockOrder = (overrides: Partial<PurchaseOrder> = {}): PurchaseOrder => ({
  id: 'po-1',
  poNumber: 'PO-2025-001',
  supplierId: 'sup-1',
  supplierName: 'Test Supplier',
  status: 'draft',
  createdAt: '2025-01-15T10:00:00Z',
  estimatedDelivery: null,
  notes: null,
  items: [createMockItem()],
  paymentStatus: 'UNPAID',
  amountPaid: 0,
  remainingAmount: 1500000,
  dueDate: undefined,
  ...overrides,
});

describe('getPurchaseOrderStatusBadge', () => {
  // Edge cases
  describe('edge cases', () => {
    it('handles unknown status', () => {
      const result = getPurchaseOrderStatusBadge('unknown');
      expect(result.variant).toBe('outline');
      expect(result.label).toBe('unknown');
    });
  });
  
  // Normal cases
  describe('normal cases', () => {
    it('returns draft badge', () => {
      const result = getPurchaseOrderStatusBadge('draft');
      expect(result.variant).toBe('outline');
      expect(result.label).toBe('Draft');
    });
    
    it('returns processed badge for ordered', () => {
      const result = getPurchaseOrderStatusBadge('ordered');
      expect(result.variant).toBe('secondary');
      expect(result.label).toBe('Diproses');
    });
    
    it('returns received badge', () => {
      const result = getPurchaseOrderStatusBadge('received');
      expect(result.variant).toBe('success');
      expect(result.label).toBe('Diterima');
    });
  });
});

describe('getPaymentStatusBadge', () => {
  // Edge cases
  describe('edge cases', () => {
    it('returns default for undefined', () => {
      const result = getPaymentStatusBadge(undefined);
      expect(result.variant).toBe('secondary');
      expect(result.label).toBe('-');
    });
  });
  
  // Normal cases
  describe('normal cases', () => {
    it('returns success for PAID', () => {
      const result = getPaymentStatusBadge('PAID');
      expect(result.variant).toBe('success');
      expect(result.label).toBe('Lunas');
    });
    
    it('returns warning for PARTIAL', () => {
      const result = getPaymentStatusBadge('PARTIAL');
      expect(result.variant).toBe('warning');
      expect(result.label).toBe('Partial');
    });
    
    it('returns destructive for UNPAID', () => {
      const result = getPaymentStatusBadge('UNPAID');
      expect(result.variant).toBe('destructive');
      expect(result.label).toBe('Belum Lunas');
    });
  });
});

describe('canEditOrder', () => {
  it('returns true for draft', () => {
    expect(canEditOrder('draft')).toBe(true);
  });
  
  it('returns true for ordered', () => {
    expect(canEditOrder('ordered')).toBe(true);
  });
  
  it('returns false for received', () => {
    expect(canEditOrder('received')).toBe(false);
  });
});

describe('canDeleteOrder', () => {
  it('returns true for draft', () => {
    expect(canDeleteOrder('draft')).toBe(true);
  });
  
  it('returns false for ordered', () => {
    expect(canDeleteOrder('ordered')).toBe(false);
  });
});

describe('canViewOrder', () => {
  it('returns true for all statuses', () => {
    expect(canViewOrder('draft')).toBe(true);
    expect(canViewOrder('received')).toBe(true);
    expect(canViewOrder('cancelled')).toBe(true);
  });
});

describe('calculateOrderTotalAmount', () => {
  // Edge cases
  describe('edge cases', () => {
    it('returns 0 for empty items', () => {
      expect(calculateOrderTotalAmount([])).toBe(0);
    });
  });
  
  // Normal cases
  describe('normal cases', () => {
    it('calculates correctly', () => {
      const items = [
        createMockItem({ quantity: '10', price: '10000' }),
        createMockItem({ quantity: '5', price: '20000' })
      ];
      expect(calculateOrderTotalAmount(items)).toBe(200000);
    });
  });
});

describe('calculateItemCount', () => {
  it('calculates total items', () => {
    const items = [
      createMockItem({ quantity: '10' }),
      createMockItem({ quantity: '5' })
    ];
    expect(calculateItemCount(items)).toBe(15);
  });
});

describe('calculateRemaining', () => {
  it('calculates correctly', () => {
    expect(calculateRemaining(2000000, 500000)).toBe(1500000);
  });
  
  it('returns 0 when paid exceeds', () => {
    expect(calculateRemaining(1000000, 1500000)).toBe(0);
  });
});

describe('calculatePaymentProgress', () => {
  it('calculates percentage correctly', () => {
    expect(calculatePaymentProgress(2000000, 1000000)).toBe(50);
  });
  
  it('returns 0 when total is 0', () => {
    expect(calculatePaymentProgress(0, 0)).toBe(0);
  });
  
  it('caps at 100', () => {
    expect(calculatePaymentProgress(1000000, 1500000)).toBe(100);
  });
});

describe('matchesSearch', () => {
  // Edge cases
  describe('edge cases', () => {
    it('returns true for empty search', () => {
      expect(matchesSearch(createMockOrder(), '')).toBe(true);
    });
    
    it('returns true for whitespace search', () => {
      expect(matchesSearch(createMockOrder(), '   ')).toBe(true);
    });
  });
  
  // Normal cases
  describe('normal cases', () => {
    it('matches po number', () => {
      expect(matchesSearch(createMockOrder(), 'PO-2025')).toBe(true);
    });
    
    it('matches supplier name', () => {
      expect(matchesSearch(createMockOrder(), 'Supplier')).toBe(true);
    });
    
    it('matches product name', () => {
      expect(matchesSearch(createMockOrder(), 'Product')).toBe(true);
    });
    
    it('is case insensitive', () => {
      expect(matchesSearch(createMockOrder(), 'test supplier')).toBe(true);
    });
  });
});

describe('matchesStatus', () => {
  it('returns true for all filter', () => {
    expect(matchesStatus(createMockOrder(), 'all')).toBe(true);
  });
  
  it('matches status correctly', () => {
    expect(matchesStatus(createMockOrder({ status: 'draft' }), 'draft')).toBe(true);
    expect(matchesStatus(createMockOrder({ status: 'draft' }), 'ordered')).toBe(false);
  });
});

describe('matchesSupplier', () => {
  it('returns true for all filter', () => {
    expect(matchesSupplier(createMockOrder(), 'all')).toBe(true);
  });
  
  it('matches supplier correctly', () => {
    expect(matchesSupplier(createMockOrder({ supplierId: 'sup-1' }), 'sup-1')).toBe(true);
    expect(matchesSupplier(createMockOrder({ supplierId: 'sup-1' }), 'sup-2')).toBe(false);
  });
});

describe('matchesDateRange', () => {
  it('returns true when no date filters', () => {
    expect(matchesDateRange(createMockOrder(), '', '')).toBe(true);
  });
  
  it('filters by date from', () => {
    const order = createMockOrder({ createdAt: '2025-01-20T10:00:00Z' });
    expect(matchesDateRange(order, '2025-01-15', '')).toBe(true);
    expect(matchesDateRange(order, '2025-01-25', '')).toBe(false);
  });
  
  it('filters by date to', () => {
    const order = createMockOrder({ createdAt: '2025-01-20T10:00:00Z' });
    expect(matchesDateRange(order, '', '2025-01-25')).toBe(true);
    expect(matchesDateRange(order, '', '2025-01-15')).toBe(false);
  });
});

describe('applyFilters', () => {
  it('returns all when filters are empty', () => {
    const orders = [createMockOrder(), createMockOrder()];
    const result = applyFilters(orders, {
      search: '',
      status: 'all',
      supplier: 'all',
      dateFrom: '',
      dateTo: ''
    });
    expect(result.length).toBe(2);
  });
  
  it('filters by search', () => {
    const orders = [
      createMockOrder({ poNumber: 'PO-001' }),
      createMockOrder({ poNumber: 'PO-002' })
    ];
    const result = applyFilters(orders, {
      search: 'PO-001',
      status: 'all',
      supplier: 'all',
      dateFrom: '',
      dateTo: ''
    });
    expect(result.length).toBe(1);
    expect(result[0].poNumber).toBe('PO-001');
  });
});

describe('getUniqueSuppliers', () => {
  it('extracts unique suppliers', () => {
    const orders = [
      createMockOrder({ supplierId: 'sup-1', supplierName: 'Supplier 1' }),
      createMockOrder({ supplierId: 'sup-2', supplierName: 'Supplier 2' }),
      createMockOrder({ supplierId: 'sup-1', supplierName: 'Supplier 1' })
    ];
    const result = getUniqueSuppliers(orders);
    expect(result.length).toBe(2);
    expect(result.find(s => s.id === 'sup-1')).toBeDefined();
    expect(result.find(s => s.id === 'sup-2')).toBeDefined();
  });
});

describe('getUniqueStatuses', () => {
  it('extracts unique statuses', () => {
    const orders = [
      createMockOrder({ status: 'draft' }),
      createMockOrder({ status: 'ordered' }),
      createMockOrder({ status: 'draft' })
    ];
    const result = getUniqueStatuses(orders);
    expect(result.length).toBe(2);
    expect(result).toContain('draft');
    expect(result).toContain('ordered');
  });
});

describe('sortOrders', () => {
  it('sorts by createdAt desc by default', () => {
    const orders = [
      createMockOrder({ id: '1', createdAt: '2025-01-15T10:00:00Z' }),
      createMockOrder({ id: '2', createdAt: '2025-01-20T10:00:00Z' })
    ];
    const result = sortOrders(orders, { field: 'createdAt', direction: 'desc' });
    expect(result[0].id).toBe('2');
    expect(result[1].id).toBe('1');
  });
  
  it('sorts by poNumber asc', () => {
    const orders = [
      createMockOrder({ id: '1', poNumber: 'PO-BBB' }),
      createMockOrder({ id: '2', poNumber: 'PO-AAA' })
    ];
    const result = sortOrders(orders, { field: 'poNumber', direction: 'asc' });
    expect(result[0].poNumber).toBe('PO-AAA');
    expect(result[1].poNumber).toBe('PO-BBB');
  });
});

describe('toggleSort', () => {
  it('toggles direction when same field', () => {
    const result = toggleSort({ field: 'createdAt', direction: 'asc' }, 'createdAt');
    expect(result.field).toBe('createdAt');
    expect(result.direction).toBe('desc');
  });
  
  it('changes field with default desc', () => {
    const result = toggleSort({ field: 'createdAt', direction: 'asc' }, 'poNumber');
    expect(result.field).toBe('poNumber');
    expect(result.direction).toBe('desc');
  });
});

describe('calculatePagination', () => {
  it('calculates correctly', () => {
    const result = calculatePagination(25, 10);
    expect(result.totalPages).toBe(3);
    expect(result.startIndex).toBe(0);
    expect(result.endIndex).toBe(10);
  });
  
  it('handles exact division', () => {
    const result = calculatePagination(20, 10);
    expect(result.totalPages).toBe(2);
  });
});

describe('getPaginatedOrders', () => {
  it('returns correct page', () => {
    const orders = Array.from({ length: 25 }, (_, i) => 
      createMockOrder({ id: `po-${i}` })
    );
    const result = getPaginatedOrders(orders, { page: 2, pageSize: 10 });
    expect(result.length).toBe(10);
    expect(result[0].id).toBe('po-10');
  });
});

describe('isValidPage', () => {
  it('validates correctly', () => {
    expect(isValidPage(1, 5)).toBe(true);
    expect(isValidPage(5, 5)).toBe(true);
    expect(isValidPage(6, 5)).toBe(false);
    expect(isValidPage(0, 5)).toBe(false);
  });
});

describe('getPaginationRange', () => {
  it('returns correct range', () => {
    const result = getPaginationRange(3, 10, 5);
    expect(result).toEqual([1, 2, 3, 4, 5]);
  });
  
  it('adjusts for edge pages', () => {
    const result = getPaginationRange(1, 10, 5);
    expect(result).toEqual([1, 2, 3, 4, 5]);
    
    const result2 = getPaginationRange(10, 10, 5);
    expect(result2).toEqual([6, 7, 8, 9, 10]);
  });
});

describe('formatDateForDisplay', () => {
  it('returns dash for null', () => {
    expect(formatDateForDisplay(null)).toBe('-');
  });
  
  it('formats date correctly', () => {
    const result = formatDateForDisplay('2025-01-15T10:00:00Z');
    expect(result).toContain('2025');
    expect(result).toContain('Jan');
  });
});

describe('formatCurrencyForDisplay', () => {
  it('formats correctly', () => {
    const result = formatCurrencyForDisplay(1000000);
    expect(result).toContain('1.000.000');
  });
});

describe('getStatusCounts', () => {
  it('counts statuses correctly', () => {
    const orders = [
      createMockOrder({ status: 'draft' }),
      createMockOrder({ status: 'draft' }),
      createMockOrder({ status: 'ordered' })
    ];
    const result = getStatusCounts(orders);
    expect(result.draft).toBe(2);
    expect(result.ordered).toBe(1);
  });
});

describe('getPaymentSummary', () => {
  it('calculates summary correctly', () => {
    const orders = [
      createMockOrder({ 
        items: [createMockItem({ quantity: '10', price: '10000' })],
        paymentStatus: 'PAID',
        amountPaid: 100000
      }),
      createMockOrder({ 
        items: [createMockItem({ quantity: '10', price: '20000' })],
        paymentStatus: 'UNPAID',
        amountPaid: 0
      })
    ];
    const result = getPaymentSummary(orders);
    expect(result.totalAmount).toBe(300000);
    expect(result.totalPaid).toBe(100000);
    expect(result.totalRemaining).toBe(200000);
    expect(result.paidCount).toBe(1);
    expect(result.unpaidCount).toBe(1);
  });
});

describe('createInitialFilterState', () => {
  it('creates empty filters', () => {
    const result = createInitialFilterState();
    expect(result.search).toBe('');
    expect(result.status).toBe('all');
    expect(result.supplier).toBe('all');
    expect(result.dateFrom).toBe('');
    expect(result.dateTo).toBe('');
  });
});

describe('createInitialSortState', () => {
  it('creates default sort', () => {
    const result = createInitialSortState();
    expect(result.field).toBe('createdAt');
    expect(result.direction).toBe('desc');
  });
});

describe('createInitialPaginationState', () => {
  it('creates default pagination', () => {
    const result = createInitialPaginationState();
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(10);
  });
});

describe('resetFilters', () => {
  it('resets to initial state', () => {
    const current = {
      search: 'test',
      status: 'ordered',
      supplier: 'sup-1',
      dateFrom: '2025-01-01',
      dateTo: '2025-01-31'
    };
    const result = resetFilters(current);
    expect(result.search).toBe('');
    expect(result.status).toBe('all');
  });
});

describe('resetPagination', () => {
  it('resets page to 1', () => {
    const current = { page: 5, pageSize: 10 };
    const result = resetPagination(current);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(10);
  });
});

describe('hasSelectedOrders', () => {
  it('returns false for empty set', () => {
    expect(hasSelectedOrders(new Set())).toBe(false);
  });
  
  it('returns true when has items', () => {
    expect(hasSelectedOrders(new Set(['po-1']))).toBe(true);
  });
});

describe('canDeleteSelected', () => {
  it('returns false when any cannot be deleted', () => {
    const orders = [
      createMockOrder({ id: 'po-1', status: 'draft' }),
      createMockOrder({ id: 'po-2', status: 'ordered' })
    ];
    expect(canDeleteSelected(orders, new Set(['po-1', 'po-2']))).toBe(false);
  });
  
  it('returns true when all can be deleted', () => {
    const orders = [
      createMockOrder({ id: 'po-1', status: 'draft' }),
      createMockOrder({ id: 'po-2', status: 'draft' })
    ];
    expect(canDeleteSelected(orders, new Set(['po-1', 'po-2']))).toBe(true);
  });
});

describe('prepareForExport', () => {
  it('prepares data correctly', () => {
    const orders = [createMockOrder()];
    const result = prepareForExport(orders);
    expect(result.length).toBe(1);
    expect(result[0]['No. PO']).toBe('PO-2025-001');
    expect(result[0]['Supplier']).toBe('Test Supplier');
  });
});
