/**
 * TDD Tests for purchase-order-core.ts
 * Edge cases first, then normal cases
 */

import {
  // Status helpers
  getStatusBadgeConfig,
  isEditableStatus,
  canReceiveGoods,
  canCancelOrder,
  getNextStatusOptions,
  
  // Calculations
  calculateTotalReceived,
  calculateOrderTotal,
  calculateRemainingAmount,
  calculatePaymentProgress,
  isFullyPaid,
  calculateItemSubtotal,
  calculateRemainingQuantity,
  
  // Batch management
  createBatchEntry,
  updateBatchEntry,
  addBatchRow,
  removeBatchRow,
  filterValidBatches,
  validateBatches,
  
  // Validation
  validateReceiveGoods,
  validatePaymentAmount,
  validateStatusUpdate,
  
  // Data transformation
  transformBatchesForApi,
  formatDateForDisplay,
  formatCurrencyForDisplay,
  
  // UI helpers
  isOrderFullyReceived,
  isOrderPartiallyReceived,
  getPaymentStatusType,
  calculateItemsProgress,
  initializeBatchesMap,
  canClosePo
} from '../purchase-order-core';
import { PurchaseOrderItem, BatchEntry } from '../purchase-order-core';

// Mock items for tests
const createMockItem = (overrides: Partial<PurchaseOrderItem> = {}): PurchaseOrderItem => ({
  id: 'item-1',
  productId: 'prod-1',
  productName: 'Test Product',
  quantity: '100',
  unit: 'pcs',
  price: '15000',
  ...overrides,
});

describe('getStatusBadgeConfig', () => {
  // Edge cases
  describe('edge cases', () => {
    it('handles unknown status', () => {
      const result = getStatusBadgeConfig('unknown-status');
      expect(result.variant).toBe('outline');
      expect(result.label).toBe('unknown-status');
    });
    
    it('handles empty string', () => {
      const result = getStatusBadgeConfig('');
      expect(result.variant).toBe('outline');
      expect(result.label).toBe('');
    });
  });
  
  // Normal cases
  describe('normal cases', () => {
    it('returns draft badge', () => {
      const result = getStatusBadgeConfig('draft');
      expect(result.variant).toBe('outline');
      expect(result.label).toBe('Draft');
    });
    
    it('returns processed badge for ordered', () => {
      const result = getStatusBadgeConfig('ordered');
      expect(result.variant).toBe('secondary');
      expect(result.label).toBe('Diproses');
    });
    
    it('returns received badge', () => {
      const result = getStatusBadgeConfig('received');
      expect(result.variant).toBe('success');
      expect(result.label).toBe('Diterima');
    });
    
    it('returns cancelled badge', () => {
      const result = getStatusBadgeConfig('cancelled');
      expect(result.variant).toBe('destructive');
      expect(result.label).toBe('Dibatalkan');
    });
  });
});

describe('isEditableStatus', () => {
  // Edge cases
  describe('edge cases', () => {
    it('returns false for empty string', () => {
      expect(isEditableStatus('')).toBe(false);
    });
  });
  
  // Normal cases
  describe('normal cases', () => {
    it('returns true for draft', () => {
      expect(isEditableStatus('draft')).toBe(true);
    });
    
    it('returns true for ordered', () => {
      expect(isEditableStatus('ordered')).toBe(true);
    });
    
    it('returns false for received', () => {
      expect(isEditableStatus('received')).toBe(false);
    });
    
    it('returns false for cancelled', () => {
      expect(isEditableStatus('cancelled')).toBe(false);
    });
  });
});

describe('canReceiveGoods', () => {
  // Edge cases
  describe('edge cases', () => {
    it('returns false for empty string', () => {
      expect(canReceiveGoods('')).toBe(false);
    });
  });
  
  // Normal cases
  describe('normal cases', () => {
    it('returns true for ordered', () => {
      expect(canReceiveGoods('ordered')).toBe(true);
    });
    
    it('returns true for partially_received', () => {
      expect(canReceiveGoods('partially_received')).toBe(true);
    });
    
    it('returns false for draft', () => {
      expect(canReceiveGoods('draft')).toBe(false);
    });
    
    it('returns false for received', () => {
      expect(canReceiveGoods('received')).toBe(false);
    });
  });
});

describe('canCancelOrder', () => {
  it('returns true for draft', () => {
    expect(canCancelOrder('draft')).toBe(true);
  });
  
  it('returns false for received', () => {
    expect(canCancelOrder('received')).toBe(false);
  });
});

describe('getNextStatusOptions', () => {
  // Edge cases
  describe('edge cases', () => {
    it('returns empty array for unknown status', () => {
      const result = getNextStatusOptions('unknown');
      expect(result).toEqual([]);
    });
  });
  
  // Normal cases
  describe('normal cases', () => {
    it('returns ordered and cancelled for draft', () => {
      const result = getNextStatusOptions('draft');
      expect(result).toEqual(['ordered', 'cancelled']);
    });
    
    it('returns partially_received and cancelled for ordered', () => {
      const result = getNextStatusOptions('ordered');
      expect(result).toEqual(['partially_received', 'cancelled']);
    });
    
    it('returns received for partially_received', () => {
      const result = getNextStatusOptions('partially_received');
      expect(result).toEqual(['received']);
    });
  });
});

describe('calculateTotalReceived', () => {
  // Edge cases
  describe('edge cases', () => {
    it('returns 0 for empty array', () => {
      expect(calculateTotalReceived([])).toBe(0);
    });
    
    it('returns 0 for zero quantities', () => {
      expect(calculateTotalReceived([{ quantity: 0 }, { quantity: 0 }])).toBe(0);
    });
  });
  
  // Normal cases
  describe('normal cases', () => {
    it('calculates correctly', () => {
      const batches: BatchEntry[] = [
        { quantity: 50 },
        { quantity: 30 },
        { quantity: 20 }
      ];
      expect(calculateTotalReceived(batches)).toBe(100);
    });
  });
});

describe('calculateOrderTotal', () => {
  // Edge cases
  describe('edge cases', () => {
    it('returns 0 for empty items', () => {
      expect(calculateOrderTotal([])).toBe(0);
    });
  });
  
  // Normal cases
  describe('normal cases', () => {
    it('calculates total correctly', () => {
      const items = [
        createMockItem({ quantity: '10', price: '10000' }),
        createMockItem({ quantity: '5', price: '20000' })
      ];
      // (10 * 10000) + (5 * 20000) = 100000 + 100000 = 200000
      expect(calculateOrderTotal(items)).toBe(200000);
    });
  });
});

describe('calculateRemainingAmount', () => {
  // Edge cases
  describe('edge cases', () => {
    it('returns 0 when paid exceeds total', () => {
      expect(calculateRemainingAmount(100000, 150000)).toBe(0);
    });
  });
  
  // Normal cases
  describe('normal cases', () => {
    it('calculates correctly', () => {
      expect(calculateRemainingAmount(200000, 50000)).toBe(150000);
    });
  });
});

describe('calculatePaymentProgress', () => {
  // Edge cases
  describe('edge cases', () => {
    it('returns 0 when total is 0', () => {
      expect(calculatePaymentProgress(50000, 0)).toBe(0);
    });
  });
  
  // Normal cases
  describe('normal cases', () => {
    it('calculates percentage correctly', () => {
      expect(calculatePaymentProgress(50000, 100000)).toBe(50);
    });
    
    it('caps at 100', () => {
      expect(calculatePaymentProgress(150000, 100000)).toBe(100);
    });
  });
});

describe('isFullyPaid', () => {
  it('returns true when paid equals total', () => {
    expect(isFullyPaid(100000, 100000)).toBe(true);
  });
  
  it('returns true when paid exceeds total', () => {
    expect(isFullyPaid(150000, 100000)).toBe(true);
  });
  
  it('returns false when paid is less', () => {
    expect(isFullyPaid(50000, 100000)).toBe(false);
  });
});

describe('calculateItemSubtotal', () => {
  it('calculates correctly', () => {
    expect(calculateItemSubtotal('10', '15000')).toBe(150000);
  });
  
  it('returns 0 for empty strings', () => {
    expect(calculateItemSubtotal('', '')).toBe(0);
  });
});

describe('calculateRemainingQuantity', () => {
  it('calculates correctly', () => {
    expect(calculateRemainingQuantity('100', 30)).toBe(70);
  });
  
  it('returns 0 when received exceeds ordered', () => {
    expect(calculateRemainingQuantity('100', 150)).toBe(0);
  });
});

describe('createBatchEntry', () => {
  it('creates batch with default values', () => {
    const result = createBatchEntry();
    expect(result.quantity).toBe(0);
    expect(result.batchNumber).toBe('');
    expect(result.expiryDate).toBe('');
  });
});

describe('updateBatchEntry', () => {
  // Edge cases
  describe('edge cases', () => {
    it('returns original array for invalid index', () => {
      const batches: BatchEntry[] = [{ quantity: 10 }];
      expect(updateBatchEntry(batches, 5, 'quantity', 20)).toEqual(batches);
    });
    
    it('returns original array for negative index', () => {
      const batches: BatchEntry[] = [{ quantity: 10 }];
      expect(updateBatchEntry(batches, -1, 'quantity', 20)).toEqual(batches);
    });
  });
  
  // Normal cases
  describe('normal cases', () => {
    it('updates field correctly', () => {
      const batches: BatchEntry[] = [{ quantity: 10, batchNumber: 'B1' }];
      const result = updateBatchEntry(batches, 0, 'quantity', 20);
      expect(result[0].quantity).toBe(20);
      expect(result[0].batchNumber).toBe('B1');
    });
  });
});

describe('addBatchRow', () => {
  it('adds new batch entry', () => {
    const batches: BatchEntry[] = [{ quantity: 10 }];
    const result = addBatchRow(batches);
    expect(result.length).toBe(2);
    expect(result[1].quantity).toBe(0);
  });
});

describe('removeBatchRow', () => {
  // Edge cases
  describe('edge cases', () => {
    it('returns original array for invalid index', () => {
      const batches: BatchEntry[] = [{ quantity: 10 }, { quantity: 20 }];
      expect(removeBatchRow(batches, 5)).toEqual(batches);
    });
  });
  
  // Normal cases
  describe('normal cases', () => {
    it('removes batch at index', () => {
      const batches: BatchEntry[] = [{ quantity: 10 }, { quantity: 20 }];
      const result = removeBatchRow(batches, 0);
      expect(result.length).toBe(1);
      expect(result[0].quantity).toBe(20);
    });
  });
});

describe('filterValidBatches', () => {
  it('filters out zero quantity batches', () => {
    const batches: BatchEntry[] = [
      { quantity: 10 },
      { quantity: 0 },
      { quantity: 5 }
    ];
    const result = filterValidBatches(batches);
    expect(result.length).toBe(2);
    expect(result[0].quantity).toBe(10);
    expect(result[1].quantity).toBe(5);
  });
});

describe('validateBatches', () => {
  // Edge cases
  describe('edge cases', () => {
    it('returns error for zero total', () => {
      const result = validateBatches([{ quantity: 0 }]);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('tidak boleh 0');
    });
    
    it('returns error for negative quantity', () => {
      const result = validateBatches([{ quantity: -5 }]);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('tidak boleh negatif');
    });
  });
  
  // Normal cases
  describe('normal cases', () => {
    it('returns valid for positive quantities', () => {
      const result = validateBatches([{ quantity: 10 }]);
      expect(result.valid).toBe(true);
    });
  });
});

describe('validateReceiveGoods', () => {
  // Edge cases
  describe('edge cases', () => {
    it('returns error for empty items and not closing', () => {
      const result = validateReceiveGoods({
        itemsToReceive: [],
        closePo: false
      });
      expect(result.valid).toBe(false);
    });
    
    it('returns valid when closing without items', () => {
      const result = validateReceiveGoods({
        itemsToReceive: [],
        closePo: true
      });
      expect(result.valid).toBe(true);
    });
  });
  
  // Normal cases
  describe('normal cases', () => {
    it('returns valid with items and closePo', () => {
      const result = validateReceiveGoods({
        itemsToReceive: [{ id: 'item-1', receivedQuantity: 10 }],
        closePo: true
      });
      expect(result.valid).toBe(true);
    });
  });
});

describe('validatePaymentAmount', () => {
  // Edge cases
  describe('edge cases', () => {
    it('returns error for zero amount', () => {
      const result = validatePaymentAmount({
        paymentAmount: 0,
        remainingAmount: 100000,
        currentAmountPaid: 0
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('lebih dari 0');
    });
    
    it('returns error when exceeding remaining', () => {
      const result = validatePaymentAmount({
        paymentAmount: 150000,
        remainingAmount: 100000,
        currentAmountPaid: 0
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('melebihi sisa');
    });
  });
  
  // Normal cases
  describe('normal cases', () => {
    it('returns valid for correct amount', () => {
      const result = validatePaymentAmount({
        paymentAmount: 50000,
        remainingAmount: 100000,
        currentAmountPaid: 0
      });
      expect(result.valid).toBe(true);
    });
  });
});

describe('validateStatusUpdate', () => {
  it('returns error when status same', () => {
    const result = validateStatusUpdate({
      currentStatus: 'draft',
      newStatus: 'draft'
    });
    expect(result.valid).toBe(false);
  });
  
  it('returns error for invalid transition', () => {
    const result = validateStatusUpdate({
      currentStatus: 'draft',
      newStatus: 'received'
    });
    expect(result.valid).toBe(false);
  });
  
  it('returns valid for correct transition', () => {
    const result = validateStatusUpdate({
      currentStatus: 'draft',
      newStatus: 'ordered'
    });
    expect(result.valid).toBe(true);
  });
});

describe('transformBatchesForApi', () => {
  it('filters zero quantity and transforms', () => {
    const batches: BatchEntry[] = [
      { quantity: 10, batchNumber: 'B1', expiryDate: '2025-12-31' },
      { quantity: 0 },
      { quantity: 5 }
    ];
    const result = transformBatchesForApi(batches);
    expect(result.length).toBe(2);
    expect(result[0].quantity).toBe(10);
    expect(result[0].batchNumber).toBe('B1');
  });
});

describe('formatDateForDisplay', () => {
  // Edge cases
  describe('edge cases', () => {
    it('returns dash for null', () => {
      expect(formatDateForDisplay(null)).toBe('-');
    });
    
    it('returns dash for empty string', () => {
      expect(formatDateForDisplay('')).toBe('-');
    });
    
    it('returns dash for invalid date', () => {
      expect(formatDateForDisplay('invalid-date')).toBe('-');
    });
  });
  
  // Normal cases
  describe('normal cases', () => {
    it('formats date correctly', () => {
      const result = formatDateForDisplay('2025-12-31');
      expect(result).toContain('2025');
      expect(result).toContain('Desember');
    });
  });
});

describe('formatCurrencyForDisplay', () => {
  it('formats currency correctly', () => {
    const result = formatCurrencyForDisplay(100000);
    expect(result).toContain('100.000');
  });
});

describe('isOrderFullyReceived', () => {
  it('returns true when all items fully received', () => {
    const items = [
      createMockItem({ quantity: '100', receivedQuantity: 100 }),
      createMockItem({ quantity: '50', receivedQuantity: 50 })
    ];
    expect(isOrderFullyReceived(items)).toBe(true);
  });
  
  it('returns false when some items not fully received', () => {
    const items = [
      createMockItem({ quantity: '100', receivedQuantity: 100 }),
      createMockItem({ quantity: '50', receivedQuantity: 30 })
    ];
    expect(isOrderFullyReceived(items)).toBe(false);
  });
});

describe('isOrderPartiallyReceived', () => {
  it('returns true when some received but not all', () => {
    const items = [
      createMockItem({ quantity: '100', receivedQuantity: 50 }),
      createMockItem({ quantity: '50', receivedQuantity: 0 })
    ];
    expect(isOrderPartiallyReceived(items)).toBe(true);
  });
});

describe('getPaymentStatusType', () => {
  it('returns success for PAID', () => {
    expect(getPaymentStatusType('PAID')).toBe('success');
  });
  
  it('returns warning for PARTIAL', () => {
    expect(getPaymentStatusType('PARTIAL')).toBe('warning');
  });
  
  it('returns destructive for UNPAID', () => {
    expect(getPaymentStatusType('UNPAID')).toBe('destructive');
  });
});

describe('calculateItemsProgress', () => {
  it('calculates progress correctly', () => {
    const items = [
      createMockItem({ quantity: '100', receivedQuantity: 100 }),
      createMockItem({ quantity: '50', receivedQuantity: 50 }),
      createMockItem({ quantity: '30', receivedQuantity: 0 })
    ];
    const result = calculateItemsProgress(items);
    expect(result.totalItems).toBe(3);
    expect(result.receivedItems).toBe(2);
    expect(result.percentage).toBeCloseTo(66.67);
  });
});

describe('initializeBatchesMap', () => {
  it('creates batches map for items', () => {
    const items = [
      createMockItem({ id: 'item-1' }),
      createMockItem({ id: 'item-2' })
    ];
    const result = initializeBatchesMap(items);
    expect(result['item-1']).toEqual([]);
    expect(result['item-2']).toEqual([]);
  });
});

describe('canClosePo', () => {
  it('returns true when all items received', () => {
    const items = [
      createMockItem({ quantity: '100', receivedQuantity: 100 })
    ];
    expect(canClosePo({ items })).toBe(true);
  });
  
  it('returns true when payment completed', () => {
    const items = [
      createMockItem({ quantity: '100', receivedQuantity: 50 })
    ];
    expect(canClosePo({ items, paymentStatus: 'PAID' })).toBe(true);
  });
  
  it('returns false otherwise', () => {
    const items = [
      createMockItem({ quantity: '100', receivedQuantity: 0 })
    ];
    expect(canClosePo({ items, paymentStatus: 'UNPAID' })).toBe(false);
  });
});
