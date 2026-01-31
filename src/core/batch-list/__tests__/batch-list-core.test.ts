/**
 * TDD Tests for batch-list-core.ts
 */

import {
    // Constants
    NEAR_EXPIRY_DAYS,
    EXPIRY_STATUS,
    BADGE_CONFIG,
    
    // Initialization
    createEmptyBatchList,
    createBatchDisplayItem,
    createBatchDisplayList,
    
    // Date Calculations
    parseDate,
    getDaysUntilExpiry,
    isExpired,
    isNearExpiry,
    determineExpiryStatus,
    
    // Formatting
    formatCurrency,
    formatDateString,
    formatExpiryDate,
    
    // State Management
    isBatchListEmpty,
    filterActiveBatches,
    filterExpiredBatches,
    filterNearExpiryBatches,
    getTotalStock,
    sortBatchesByExpiry,
    
    // Comparison
    hasBatchChanged,
    findBatchById,
    batchExists,
    
    // Validation
    validateBatch,
    validateBatchList,
    
    // Summary
    getBatchSummary,
    formatBatchSummary,
    
    // Export
    prepareBatchesExport,
    getTableHeaders,
    getBadgeVariant,
    getBadgeLabel
} from '../batch-list-core';
import { ProductBatch } from '../batch-list-core';

describe('Constants', () => {
    it('has correct NEAR_EXPIRY_DAYS', () => {
        expect(NEAR_EXPIRY_DAYS).toBe(30);
    });
    
    it('has EXPIRY_STATUS', () => {
        expect(EXPIRY_STATUS.EXPIRED).toBe('expired');
        expect(EXPIRY_STATUS.NEAR).toBe('near');
        expect(EXPIRY_STATUS.GOOD).toBe('good');
    });
    
    it('has BADGE_CONFIG', () => {
        expect(BADGE_CONFIG.expired.label).toBe('Kadaluarsa');
        expect(BADGE_CONFIG.near.label).toBe('Hampir Exp');
        expect(BADGE_CONFIG.good.label).toBe('Baik');
    });
});

describe('createEmptyBatchList', () => {
    it('creates empty array', () => {
        const result = createEmptyBatchList();
        expect(result).toEqual([]);
        expect(result.length).toBe(0);
    });
});

describe('createBatchDisplayItem', () => {
    it('creates display item from batch', () => {
        const batch: ProductBatch = {
            id: '1',
            batchNumber: 'BATCH-001',
            stock: 100,
            expiryDate: '2026-12-31', // Use future date
            purchasePrice: 50000,
            inDate: '2025-01-15'
        };
        const result = createBatchDisplayItem(batch);
        expect(result.id).toBe('1');
        expect(result.batchNumber).toBe('BATCH-001');
        expect(result.stock).toBe(100);
        expect(result.expiryStatus).toBe('good');
        expect(result.purchasePrice).toContain('50');
    });
    
    it('handles null batch number', () => {
        const batch: ProductBatch = {
            id: '1',
            batchNumber: null,
            stock: 100,
            inDate: '2025-01-15'
        };
        const result = createBatchDisplayItem(batch);
        expect(result.batchNumber).toBe('-');
    });
    
    it('handles null expiry date', () => {
        const batch: ProductBatch = {
            id: '1',
            stock: 100,
            expiryDate: null,
            inDate: '2025-01-15'
        };
        const result = createBatchDisplayItem(batch);
        expect(result.expiryDate).toBeNull();
        expect(result.expiryStatus).toBe('good');
    });
    
    it('handles null purchase price', () => {
        const batch: ProductBatch = {
            id: '1',
            stock: 100,
            purchasePrice: null,
            inDate: '2025-01-15'
        };
        const result = createBatchDisplayItem(batch);
        expect(result.purchasePrice).toBe('-');
    });
});

describe('createBatchDisplayList', () => {
    it('creates display list from batches', () => {
        const batches: ProductBatch[] = [
            { id: '1', stock: 100, inDate: '2025-01-15' },
            { id: '2', stock: 200, inDate: '2025-01-16' }
        ];
        const result = createBatchDisplayList(batches);
        expect(result.length).toBe(2);
        expect(result[0].id).toBe('1');
        expect(result[1].id).toBe('2');
    });
    
    it('returns empty for null input', () => {
        const result = createBatchDisplayList(null as any);
        expect(result).toEqual([]);
    });
    
    it('returns empty for empty array', () => {
        const result = createBatchDisplayList([]);
        expect(result).toEqual([]);
    });
});

describe('parseDate', () => {
    it('parses valid date string', () => {
        const result = parseDate('2025-12-31');
        expect(result).not.toBeNull();
        expect(result?.getFullYear()).toBe(2025);
    });
    
    it('returns null for null input', () => {
        expect(parseDate(null)).toBeNull();
    });
    
    it('returns null for undefined input', () => {
        expect(parseDate(undefined)).toBeNull();
    });
    
    it('returns null for invalid date string', () => {
        expect(parseDate('invalid')).toBeNull();
    });
});

describe('getDaysUntilExpiry', () => {
    it('returns null for null expiry', () => {
        expect(getDaysUntilExpiry(null)).toBeNull();
    });
    
    it('returns positive days for future date', () => {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 30);
        const result = getDaysUntilExpiry(futureDate.toISOString());
        expect(result).toBeGreaterThan(0);
        expect(result).toBeLessThanOrEqual(31);
    });
});

describe('isExpired', () => {
    it('returns false for null expiry', () => {
        expect(isExpired(null)).toBe(false);
    });
    
    it('returns true for past date', () => {
        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - 1);
        expect(isExpired(pastDate.toISOString())).toBe(true);
    });
    
    it('returns false for future date', () => {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 30);
        expect(isExpired(futureDate.toISOString())).toBe(false);
    });
});

describe('isNearExpiry', () => {
    it('returns false for null expiry', () => {
        expect(isNearExpiry(null)).toBe(false);
    });
    
    it('returns false for expired date', () => {
        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - 1);
        expect(isNearExpiry(pastDate.toISOString())).toBe(false);
    });
    
    it('returns true for date within 30 days', () => {
        const nearDate = new Date();
        nearDate.setDate(nearDate.getDate() + 15);
        expect(isNearExpiry(nearDate.toISOString())).toBe(true);
    });
    
    it('returns false for date beyond 30 days', () => {
        const farDate = new Date();
        farDate.setDate(farDate.getDate() + 60);
        expect(isNearExpiry(farDate.toISOString())).toBe(false);
    });
});

describe('determineExpiryStatus', () => {
    it('returns expired for past date', () => {
        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - 1);
        expect(determineExpiryStatus(pastDate.toISOString())).toBe('expired');
    });
    
    it('returns near for date within 30 days', () => {
        const nearDate = new Date();
        nearDate.setDate(nearDate.getDate() + 15);
        expect(determineExpiryStatus(nearDate.toISOString())).toBe('near');
    });
    
    it('returns good for date beyond 30 days', () => {
        const farDate = new Date();
        farDate.setDate(farDate.getDate() + 60);
        expect(determineExpiryStatus(farDate.toISOString())).toBe('good');
    });
    
    it('returns good for null date', () => {
        expect(determineExpiryStatus(null)).toBe('good');
    });
});

describe('formatCurrency', () => {
    it('formats number as currency', () => {
        const result = formatCurrency(50000);
        expect(result).toContain('50');
        expect(result).toContain('000');
    });
    
    it('formats zero', () => {
        const result = formatCurrency(0);
        expect(result).toContain('0');
    });
});

describe('formatDateString', () => {
    it('formats date string', () => {
        const result = formatDateString('2025-12-31');
        expect(result).toContain('2025');
        expect(result).toContain('31');
    });
});

describe('formatExpiryDate', () => {
    it('formats expiry date', () => {
        const result = formatExpiryDate('2025-12-31');
        expect(result).not.toBe('-');
    });
    
    it('returns dash for null', () => {
        expect(formatExpiryDate(null)).toBe('-');
    });
});

describe('isBatchListEmpty', () => {
    it('returns true for null', () => {
        expect(isBatchListEmpty(null)).toBe(true);
    });
    
    it('returns true for empty array', () => {
        expect(isBatchListEmpty([])).toBe(true);
    });
    
    it('returns false for non-empty array', () => {
        expect(isBatchListEmpty([{ id: '1', stock: 100, inDate: '2025-01-15' }])).toBe(false);
    });
});

describe('filterActiveBatches', () => {
    it('filters active batches', () => {
        const batches: ProductBatch[] = [
            { id: '1', stock: 100, inDate: '2025-01-15', isDeleted: false },
            { id: '2', stock: 200, inDate: '2025-01-16', isDeleted: true },
            { id: '3', stock: 300, inDate: '2025-01-17', isDeleted: false }
        ];
        const result = filterActiveBatches(batches);
        expect(result.length).toBe(2);
        expect(result[0].id).toBe('1');
        expect(result[2]).toBeUndefined();
    });
});

describe('filterExpiredBatches', () => {
    it('filters expired batches', () => {
        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - 1);
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 30);
        
        const batches: ProductBatch[] = [
            { id: '1', stock: 100, expiryDate: pastDate.toISOString(), inDate: '2025-01-15' },
            { id: '2', stock: 200, expiryDate: futureDate.toISOString(), inDate: '2025-01-16' }
        ];
        const result = filterExpiredBatches(batches);
        expect(result.length).toBe(1);
        expect(result[0].id).toBe('1');
    });
});

describe('filterNearExpiryBatches', () => {
    it('filters near expiry batches', () => {
        const nearDate = new Date();
        nearDate.setDate(nearDate.getDate() + 15);
        const farDate = new Date();
        farDate.setDate(farDate.getDate() + 60);
        
        const batches: ProductBatch[] = [
            { id: '1', stock: 100, expiryDate: nearDate.toISOString(), inDate: '2025-01-15' },
            { id: '2', stock: 200, expiryDate: farDate.toISOString(), inDate: '2025-01-16' }
        ];
        const result = filterNearExpiryBatches(batches);
        expect(result.length).toBe(1);
        expect(result[0].id).toBe('1');
    });
});

describe('getTotalStock', () => {
    it('calculates total stock', () => {
        const batches: ProductBatch[] = [
            { id: '1', stock: 100, inDate: '2025-01-15' },
            { id: '2', stock: 200, inDate: '2025-01-16' },
            { id: '3', stock: 50, inDate: '2025-01-17' }
        ];
        expect(getTotalStock(batches)).toBe(350);
    });
    
    it('handles empty array', () => {
        expect(getTotalStock([])).toBe(0);
    });
});

describe('sortBatchesByExpiry', () => {
    it('sorts by expiry ascending', () => {
        const date1 = new Date();
        date1.setDate(date1.getDate() + 10);
        const date2 = new Date();
        date2.setDate(date2.getDate() + 30);
        
        const batches: ProductBatch[] = [
            { id: '1', stock: 100, expiryDate: date2.toISOString(), inDate: '2025-01-15' },
            { id: '2', stock: 200, expiryDate: date1.toISOString(), inDate: '2025-01-16' }
        ];
        const result = sortBatchesByExpiry(batches, true);
        expect(result[0].id).toBe('2');
        expect(result[1].id).toBe('1');
    });
    
    it('sorts by expiry descending', () => {
        const date1 = new Date();
        date1.setDate(date1.getDate() + 10);
        const date2 = new Date();
        date2.setDate(date2.getDate() + 30);
        
        const batches: ProductBatch[] = [
            { id: '1', stock: 100, expiryDate: date2.toISOString(), inDate: '2025-01-15' },
            { id: '2', stock: 200, expiryDate: date1.toISOString(), inDate: '2025-01-16' }
        ];
        const result = sortBatchesByExpiry(batches, false);
        expect(result[0].id).toBe('1');
        expect(result[1].id).toBe('2');
    });
});

describe('hasBatchChanged', () => {
    it('detects changes', () => {
        const original: ProductBatch = { id: '1', stock: 100, inDate: '2025-01-15' };
        const current: ProductBatch = { id: '1', stock: 200, inDate: '2025-01-15' };
        expect(hasBatchChanged(original, current)).toBe(true);
    });
    
    it('detects no changes', () => {
        const original: ProductBatch = { id: '1', stock: 100, inDate: '2025-01-15' };
        const current: ProductBatch = { id: '1', stock: 100, inDate: '2025-01-15' };
        expect(hasBatchChanged(original, current)).toBe(false);
    });
});

describe('findBatchById', () => {
    it('finds batch by ID', () => {
        const batches: ProductBatch[] = [
            { id: '1', stock: 100, inDate: '2025-01-15' },
            { id: '2', stock: 200, inDate: '2025-01-16' }
        ];
        const result = findBatchById(batches, '2');
        expect(result?.id).toBe('2');
    });
    
    it('returns undefined for non-existent ID', () => {
        const batches: ProductBatch[] = [
            { id: '1', stock: 100, inDate: '2025-01-15' }
        ];
        expect(findBatchById(batches, '3')).toBeUndefined();
    });
});

describe('batchExists', () => {
    it('returns true if batch exists', () => {
        const batches: ProductBatch[] = [
            { id: '1', stock: 100, inDate: '2025-01-15' }
        ];
        expect(batchExists(batches, '1')).toBe(true);
    });
    
    it('returns false if batch does not exist', () => {
        const batches: ProductBatch[] = [
            { id: '1', stock: 100, inDate: '2025-01-15' }
        ];
        expect(batchExists(batches, '2')).toBe(false);
    });
});

describe('validateBatch', () => {
    it('returns valid for complete batch', () => {
        const batch: ProductBatch = {
            id: '1',
            stock: 100,
            inDate: '2025-01-15'
        };
        const result = validateBatch(batch);
        expect(result.valid).toBe(true);
        expect(result.errors.length).toBe(0);
    });
    
    it('returns error for missing ID', () => {
        const batch = { stock: 100, inDate: '2025-01-15' } as any;
        const result = validateBatch(batch);
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain('ID');
    });
    
    it('returns error for negative stock', () => {
        const batch: ProductBatch = { id: '1', stock: -10, inDate: '2025-01-15' };
        const result = validateBatch(batch);
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain('negatif');
    });
    
    it('returns error for missing inDate', () => {
        const batch = { id: '1', stock: 100 } as any;
        const result = validateBatch(batch);
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain('Tanggal');
    });
});

describe('validateBatchList', () => {
    it('returns valid for valid list', () => {
        const batches: ProductBatch[] = [
            { id: '1', stock: 100, inDate: '2025-01-15' },
            { id: '2', stock: 200, inDate: '2025-01-16' }
        ];
        const result = validateBatchList(batches);
        expect(result.valid).toBe(true);
        expect(result.totalErrors).toBe(0);
    });
    
    it('counts errors in list', () => {
        const batches: ProductBatch[] = [
            { id: '1', stock: -10, inDate: '2025-01-15' },
            { id: '2', stock: 200, inDate: '' as any }
        ];
        const result = validateBatchList(batches);
        expect(result.valid).toBe(false);
        expect(result.totalErrors).toBeGreaterThan(0);
    });
});

describe('getBatchSummary', () => {
    it('returns summary', () => {
        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - 1);
        const nearDate = new Date();
        nearDate.setDate(nearDate.getDate() + 15);
        const farDate = new Date();
        farDate.setDate(farDate.getDate() + 60);
        
        const batches: ProductBatch[] = [
            { id: '1', stock: 100, expiryDate: pastDate.toISOString(), inDate: '2025-01-15' },
            { id: '2', stock: 200, expiryDate: nearDate.toISOString(), inDate: '2025-01-16' },
            { id: '3', stock: 300, expiryDate: farDate.toISOString(), inDate: '2025-01-17' }
        ];
        const result = getBatchSummary(batches);
        expect(result.total).toBe(3);
        expect(result.expired).toBe(1);
        expect(result.nearExpiry).toBe(1);
        expect(result.good).toBe(1);
        expect(result.totalStock).toBe(600);
    });
});

describe('formatBatchSummary', () => {
    it('formats summary', () => {
        const batches: ProductBatch[] = [
            { id: '1', stock: 100, inDate: '2025-01-15' },
            { id: '2', stock: 200, inDate: '2025-01-16' }
        ];
        const result = formatBatchSummary(batches);
        expect(result).toContain('Total: 2');
        expect(result).toContain('Stok: 300');
    });
});

describe('prepareBatchesExport', () => {
    it('prepares export data', () => {
        const batches: ProductBatch[] = [
            { id: '1', batchNumber: 'BATCH-001', stock: 100, expiryDate: '2025-12-31', purchasePrice: 50000, inDate: '2025-01-15' }
        ];
        const result = prepareBatchesExport(batches);
        expect(result.length).toBe(1);
        expect(result[0]['No. Batch']).toBe('BATCH-001');
        expect(result[0]['Stok']).toBe('100');
    });
});

describe('getTableHeaders', () => {
    it('returns table headers', () => {
        const result = getTableHeaders();
        expect(result).toContain('No. Batch');
        expect(result).toContain('Stok');
        expect(result).toContain('Status');
    });
});

describe('getBadgeVariant', () => {
    it('returns badge variant', () => {
        expect(getBadgeVariant('expired')).toBe('destructive');
        expect(getBadgeVariant('near')).toBe('secondary');
        expect(getBadgeVariant('good')).toBe('outline');
    });
});

describe('getBadgeLabel', () => {
    it('returns badge label', () => {
        expect(getBadgeLabel('expired')).toBe('Kadaluarsa');
        expect(getBadgeLabel('near')).toBe('Hampir Exp');
        expect(getBadgeLabel('good')).toBe('Baik');
    });
});
