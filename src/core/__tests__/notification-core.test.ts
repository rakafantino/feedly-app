/**
 * TDD Tests for notification-core.ts pure functions
 * Edge cases first, then error cases, then normal cases
 */

import {
  // Basic helpers
  formatRupiah,
  calculateSnoozeUntil,
  isSnoozed,
  hoursSince,
  
  // Generators
  generateStockNotificationTitle,
  generateStockNotificationMessage,
  generateDebtNotificationTitle,
  
  // Plan 2 - Business logic
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
} from '../notification-core';

describe('formatRupiah', () => {
  // Edge cases
  describe('edge cases', () => {
    it('returns 0 for zero amount', () => {
      expect(formatRupiah(0)).toContain('Rp');
      expect(formatRupiah(0)).toContain('0');
    });
    
    it('handles large numbers correctly', () => {
      const result = formatRupiah(1000000);
      expect(result).toContain('1.000.000');
    });
    
    it('handles decimal amounts', () => {
      const result = formatRupiah(1000);
      expect(result).toContain('1.000');
    });
  });
});

describe('calculateSnoozeUntil', () => {
  // Edge cases
  describe('edge cases', () => {
    it('returns current time + 0 minutes when minutes is 0', () => {
      const before = new Date();
      const result = calculateSnoozeUntil(0);
      const after = new Date();
      
      expect(result.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.getTime()).toBeLessThanOrEqual(after.getTime() + 1000);
    });
    
    it('handles negative minutes (returns past date)', () => {
      const result = calculateSnoozeUntil(-60);
      const now = new Date();
      expect(result.getTime()).toBeLessThan(now.getTime());
    });
    
    it('handles large minutes value', () => {
      const result = calculateSnoozeUntil(100000);
      const expected = new Date();
      expected.setMinutes(expected.getMinutes() + 100000);
      expect(result.getTime()).toBe(expected.getTime());
    });
  });
});

describe('isSnoozed', () => {
  // Edge cases
  describe('edge cases', () => {
    it('returns false for null', () => {
      expect(isSnoozed(null)).toBe(false);
    });
    
    it('returns false for undefined', () => {
      expect(isSnoozed(undefined)).toBe(false);
    });
    
    it('returns false for past date', () => {
      const past = new Date(Date.now() - 100000);
      expect(isSnoozed(past)).toBe(false);
    });
  });
  
  // Normal cases
  describe('normal cases', () => {
    it('returns true for future date', () => {
      const future = new Date(Date.now() + 100000);
      expect(isSnoozed(future)).toBe(true);
    });
  });
});

describe('hoursSince', () => {
  // Edge cases
  describe('edge cases', () => {
    it('returns 0 for current time', () => {
      const now = new Date();
      const result = hoursSince(now);
      expect(result).toBeLessThan(0.001); // essentially 0
    });
    
    it('handles very old dates', () => {
      const oldDate = new Date('2000-01-01');
      const result = hoursSince(oldDate);
      expect(result).toBeGreaterThan(200000); // more than 200k hours
    });
  });
});

describe('generateStockNotificationTitle', () => {
  // Edge cases
  describe('edge cases', () => {
    it('handles empty product name', () => {
      expect(generateStockNotificationTitle('', false)).toBe('Stok Menipis: ');
      expect(generateStockNotificationTitle('', true)).toBe('Reminder: Stok Menipis - ');
    });
  });
  
  // Normal cases
  describe('normal cases', () => {
    it('generates correct title for normal case', () => {
      expect(generateStockNotificationTitle('Gula', false)).toBe('Stok Menipis: Gula');
    });
    
    it('generates correct reminder title', () => {
      expect(generateStockNotificationTitle('Gula', true)).toBe('Reminder: Stok Menipis - Gula');
    });
  });
});

describe('generateStockNotificationMessage', () => {
  // Edge cases
  describe('edge cases', () => {
    it('handles 0 stock', () => {
      expect(generateStockNotificationMessage('Gula', 0, 'pcs')).toBe('Stok saat ini: 0 pcs');
    });
    
    it('handles very large stock', () => {
      const msg = generateStockNotificationMessage('Gula', 999999, 'pcs');
      expect(msg).toContain('999999');
      expect(msg).toContain('pcs');
    });
    
    it('handles empty unit', () => {
      expect(generateStockNotificationMessage('Gula', 10, '')).toBe('Stok saat ini: 10 ');
    });
  });
});

describe('generateDebtNotificationTitle', () => {
  // Edge cases
  describe('edge cases', () => {
    it('handles empty customer name for non-supplier', () => {
      expect(generateDebtNotificationTitle('', false, false)).toBe('Jatuh Tempo: Pelanggan');
    });
    
    it('handles empty supplier name', () => {
      expect(generateDebtNotificationTitle('', true, false)).toBe('Hutang Jatuh Tempo:');
    });
  });
  
  // Normal cases
  describe('normal cases', () => {
    it('generates correct customer debt title', () => {
      expect(generateDebtNotificationTitle('John', false, false)).toBe('Jatuh Tempo: John');
    });
    
    it('generates correct supplier debt title', () => {
      expect(generateDebtNotificationTitle('Supplier A', true, false)).toBe('Hutang Jatuh Tempo: Supplier A');
    });
    
    it('generates correct reminder title', () => {
      expect(generateDebtNotificationTitle('John', false, true)).toBe('Reminder: Jatuh Tempo - John');
    });
  });
});

describe('calculateStaleStockNotificationIds', () => {
  // Edge cases
  describe('edge cases', () => {
    it('returns empty array for empty input', () => {
      const result = calculateStaleStockNotificationIds([], new Set());
      expect(result).toEqual([]);
    });
    
    it('returns all IDs when no products in low stock', () => {
      const notifications = [
        { id: 'n1', productId: 'p1' },
        { id: 'n2', productId: 'p2' }
      ];
      const result = calculateStaleStockNotificationIds(notifications, new Set());
      expect(result).toEqual(['n1', 'n2']);
    });
    
    it('handles notifications without productId', () => {
      const notifications = [
        { id: 'n1', productId: null },
        { id: 'n2', productId: 'p1' }
      ];
      const result = calculateStaleStockNotificationIds(notifications, new Set(['p1']));
      expect(result).toEqual(['n1']);
    });
  });
  
  // Normal cases
  describe('normal cases', () => {
    it('filters correctly when products exist', () => {
      const notifications = [
        { id: 'n1', productId: 'p1' },
        { id: 'n2', productId: 'p2' },
        { id: 'n3', productId: 'p3' }
      ];
      const result = calculateStaleStockNotificationIds(
        notifications,
        new Set(['p1', 'p3'])
      );
      expect(result).toEqual(['n2']);
    });
  });
});

describe('shouldUpdateStockNotification', () => {
  // Edge cases
  describe('edge cases', () => {
    it('returns shouldUpdate: false when snoozed', () => {
      const snoozedUntil = new Date(Date.now() + 100000);
      const result = shouldUpdateStockNotification({
        existing: {
          snoozedUntil,
          metadata: { currentStock: 10 },
          isRead: false,
          updatedAt: new Date(),
          createdAt: new Date()
        },
        currentStock: 5,
        intervalHours: 1
      });
      expect(result.shouldUpdate).toBe(false);
    });
    
    it('handles metadata as null', () => {
      const result = shouldUpdateStockNotification({
        existing: {
          snoozedUntil: null,
          metadata: null,
          isRead: false,
          updatedAt: new Date(),
          createdAt: new Date()
        },
        currentStock: 5,
        intervalHours: 1
      });
      expect(result.stockChanged).toBe(true); // null !== 5
    });
  });
  
  // Normal cases
  describe('normal cases', () => {
    it('returns shouldUpdate: true when stock changed', () => {
      const result = shouldUpdateStockNotification({
        existing: {
          snoozedUntil: null,
          metadata: { currentStock: 10 },
          isRead: false,
          updatedAt: new Date(),
          createdAt: new Date()
        },
        currentStock: 5,
        intervalHours: 1
      });
      expect(result.shouldUpdate).toBe(true);
      expect(result.stockChanged).toBe(true);
    });
  });
});

describe('createStockMetadata', () => {
  // Edge cases
  describe('edge cases', () => {
    it('handles undefined optional fields', () => {
      const result = createStockMetadata({
        currentStock: 10,
        threshold: 5,
        unit: 'pcs'
      });
      expect(result.category).toBeUndefined();
      expect(result.price).toBeUndefined();
      expect(result.supplierId).toBeNull();
    });
  });
  
  // Normal cases
  describe('normal cases', () => {
    it('creates correct metadata object', () => {
      const result = createStockMetadata({
        currentStock: 10,
        threshold: 5,
        unit: 'kg',
        category: 'Bahan Pokok',
        price: 15000,
        supplierId: 'sup-1'
      });
      expect(result.currentStock).toBe(10);
      expect(result.threshold).toBe(5);
      expect(result.unit).toBe('kg');
    });
  });
});

describe('createDebtMetadata', () => {
  // Edge cases
  describe('edge cases', () => {
    it('handles undefined isSupplier', () => {
      const result = createDebtMetadata({
        invoiceNumber: 'INV-001',
        customerName: 'John',
        amountPaid: 50000,
        remainingAmount: 50000,
        dueDate: new Date()
      });
      expect(result.isSupplier).toBeUndefined();
    });
  });
  
  // Normal cases
  describe('normal cases', () => {
    it('creates correct metadata with isSupplier flag', () => {
      const dueDate = new Date();
      const result = createDebtMetadata({
        invoiceNumber: 'PO-001',
        customerName: 'Supplier A',
        amountPaid: 100000,
        remainingAmount: 500000,
        dueDate,
        isSupplier: true
      });
      expect(result.isSupplier).toBe(true);
    });
  });
});

describe('shouldUpdateDebtNotification', () => {
  // Edge cases
  describe('edge cases', () => {
    it('returns shouldUpdate: false when snoozed', () => {
      const snoozedUntil = new Date(Date.now() + 100000);
      const result = shouldUpdateDebtNotification({
        existing: {
          snoozedUntil,
          metadata: { remainingAmount: 100000 },
          isRead: false,
          updatedAt: new Date(),
          createdAt: new Date()
        },
        remainingAmount: 50000,
        intervalHours: 1
      });
      expect(result.shouldUpdate).toBe(false);
    });
  });
  
  // Normal cases
  describe('normal cases', () => {
    it('returns shouldUpdate: true when amount changed', () => {
      const result = shouldUpdateDebtNotification({
        existing: {
          snoozedUntil: null,
          metadata: { remainingAmount: 100000 },
          isRead: false,
          updatedAt: new Date(),
          createdAt: new Date()
        },
        remainingAmount: 50000,
        intervalHours: 1
      });
      expect(result.shouldUpdate).toBe(true);
      expect(result.amountChanged).toBe(true);
    });
  });
});

describe('createExpiredMetadata', () => {
  // Edge cases
  describe('edge cases', () => {
    it('handles undefined batchNumber', () => {
      const result = createExpiredMetadata({
        expiryDate: new Date(),
        daysLeft: 10,
        currentStock: 50,
        unit: 'pcs'
      });
      expect(result.batchNumber).toBeUndefined();
    });
  });
  
  // Normal cases
  describe('normal cases', () => {
    it('creates correct metadata', () => {
      const expiryDate = new Date();
      const result = createExpiredMetadata({
        expiryDate,
        batchNumber: 'BATCH-001',
        daysLeft: 5,
        currentStock: 100,
        unit: 'kg'
      });
      expect(result.batchNumber).toBe('BATCH-001');
      expect(result.daysLeft).toBe(5);
    });
  });
});

describe('shouldUpdateExpiredNotification', () => {
  // Edge cases
  describe('edge cases', () => {
    it('returns shouldUpdate: false when snoozed', () => {
      const snoozedUntil = new Date(Date.now() + 100000);
      const result = shouldUpdateExpiredNotification({
        existing: {
          snoozedUntil,
          isRead: false,
          updatedAt: new Date(),
          createdAt: new Date(),
          metadata: { daysLeft: 10 }
        },
        intervalHours: 1,
        currentDaysLeft: 5
      });
      expect(result.shouldUpdate).toBe(false);
    });
  });
  
  // Normal cases
  describe('normal cases', () => {
    it('returns shouldUpdate: true when days changed', () => {
      const result = shouldUpdateExpiredNotification({
        existing: {
          snoozedUntil: null,
          isRead: false,
          updatedAt: new Date(),
          createdAt: new Date(),
          metadata: { daysLeft: 10 }
        },
        intervalHours: 1,
        currentDaysLeft: 5
      });
      expect(result.shouldUpdate).toBe(true);
      expect(result.daysChanged).toBe(true);
    });
  });
});

describe('calculateExpiredNotificationSignatures', () => {
  // Edge cases
  describe('edge cases', () => {
    it('returns empty Set for empty array', () => {
      const result = calculateExpiredNotificationSignatures([]);
      expect(result.size).toBe(0);
    });
    
    it('handles items without batch_number', () => {
      const items = [
        { id: 'p1' },
        { id: 'p2' }
      ];
      const result = calculateExpiredNotificationSignatures(items);
      expect(result.has('p1|')).toBe(true);
      expect(result.has('p2|')).toBe(true);
    });
  });
  
  // Normal cases
  describe('normal cases', () => {
    it('creates correct signatures', () => {
      const items = [
        { originalId: 'p1', id: 'batch-1', batch_number: 'B-001' },
        { originalId: 'p2', id: 'batch-2', batch_number: 'B-002' }
      ];
      const result = calculateExpiredNotificationSignatures(items);
      expect(result.has('p1|B-001')).toBe(true);
      expect(result.has('p2|B-002')).toBe(true);
    });
  });
});

describe('filterExpiredNotificationsToDelete', () => {
  // Edge cases
  describe('edge cases', () => {
    it('returns empty array for empty notifications', () => {
      const result = filterExpiredNotificationsToDelete([], new Set());
      expect(result).toEqual([]);
    });
    
    it('returns all IDs when no valid signatures', () => {
      const notifications = [
        { id: 'n1', productId: 'p1', metadata: { batchNumber: 'B-001' } }
      ];
      const result = filterExpiredNotificationsToDelete(notifications, new Set(['p2|B-002']));
      expect(result).toEqual(['n1']);
    });
  });
  
  // Normal cases
  describe('normal cases', () => {
    it('filters correctly', () => {
      const notifications = [
        { id: 'n1', productId: 'p1', metadata: { batchNumber: 'B-001' } },
        { id: 'n2', productId: 'p2', metadata: { batchNumber: 'B-002' } }
      ];
      const validSignatures = new Set(['p1|B-001']); // Only p1 is valid
      const result = filterExpiredNotificationsToDelete(notifications, validSignatures);
      expect(result).toEqual(['n2']);
    });
  });
});

describe('filterPaidNotificationIds', () => {
  // Edge cases
  describe('edge cases', () => {
    it('returns empty array for empty notifications', () => {
      const result = filterPaidNotificationIds([], new Set());
      expect(result).toEqual([]);
    });
    
    it('returns empty when no matches', () => {
      const notifications = [
        { id: 'n1', transactionId: 't1' }
      ];
      const result = filterPaidNotificationIds(notifications, new Set(['t2']));
      expect(result).toEqual([]);
    });
  });
  
  // Normal cases
  describe('normal cases', () => {
    it('filters correctly for transactions', () => {
      const notifications = [
        { id: 'n1', transactionId: 't1' },
        { id: 'n2', transactionId: 't2' },
        { id: 'n3', transactionId: 't3' }
      ];
      const result = filterPaidNotificationIds(notifications, new Set(['t1', 't3']));
      expect(result).toEqual(['n1', 'n3']);
    });
    
    it('handles mixed transaction and PO', () => {
      const notifications = [
        { id: 'n1', transactionId: 't1' },
        { id: 'n2', purchaseOrderId: 'po1' }
      ];
      const result = filterPaidNotificationIds(notifications, new Set(['t1', 'po1']));
      expect(result).toEqual(['n1', 'n2']);
    });
  });
});
