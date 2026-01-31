/**
 * TDD Tests for expiry-analysis-core.ts
 * Edge cases first, then normal cases
 */

import {
  // Initialization
  createInitialFilterState,
  createInitialDiscardState,
  
  // Date Calculations
  calculateDaysUntilExpiry,
  getExpiryStatus,
  isExpired,
  isExpiringSoon,
  getExpiryColorClass,
  
  // Filtering
  filterByExpiryStatus,
  filterByCategory,
  searchProducts,
  applyFilters,
  getUniqueCategories,
  
  // Processing
  calculateExpiringProducts,
  sortByDaysLeft,
  groupByCategory,
  toggleGroupExpansion,
  getDisplayLimit,
  resetDisplayLimit,
  
  // Discard Management
  prepareDiscardState,
  updateDiscardQuantity,
  updateDiscardReason,
  resetDiscardState,
  validateDiscardQuantity,
  buildDiscardPayload,
  
  // Statistics
  calculateExpiryStats,
  getUrgencyBreakdown,
  calculatePotentialLoss,
  getMostUrgentProducts,
  
  // Formatting
  formatExpiryDate,
  formatDaysLeft,
  getStatusBadgeText,
  formatStockValue,
  calculateStockValue,
  
  // Validation
  isValidFilter,
  hasExpiringProducts,
  hasExpiredProducts,
  hasCriticalProducts,
  canDiscard,
  
  // Export
  prepareExpiryExport,
  getExpirySummary
} from '../expiry-analysis-core';
import { ExpiringProduct, ExpiryFilter, ProductBatch } from '../expiry-analysis-core';

// Mock helpers
const createMockProduct = (overrides: Partial<ExpiringProduct> = {}): ExpiringProduct => ({
  id: 'prod-1',
  name: 'Test Product',
  product_code: 'TEST-001',
  barcode: '1234567890123',
  description: 'Test description',
  category: 'Electronics',
  price: 100000,
  stock: 50,
  unit: 'pcs',
  threshold: 10,
  purchase_price: 80000,
  min_selling_price: 90000,
  supplierId: 'sup-1',
  expiryDate: '2025-12-31',
  storeId: 'store-1',
  createdAt: '2025-01-15T10:00:00Z',
  updatedAt: '2025-01-15T10:00:00Z',
  isDeleted: false,
  daysLeft: 30,
  ...overrides
});

const createMockBatch = (overrides: Partial<ProductBatch> = {}): ProductBatch => ({
  id: 'batch-1',
  stock: 20,
  expiryDate: '2025-12-31',
  batchNumber: 'B001',
  purchasePrice: 80000,
  productId: 'prod-1',
  storeId: 'store-1',
  ...overrides
});

describe('createInitialFilterState', () => {
  it('creates default filter state', () => {
    const result = createInitialFilterState();
    expect(result.status).toBe('all');
    expect(result.category).toBe('all');
    expect(result.search).toBe('');
  });
});

describe('createInitialDiscardState', () => {
  it('creates default discard state', () => {
    const result = createInitialDiscardState();
    expect(result.batch).toBeNull();
    expect(result.quantity).toBe('');
    expect(result.reason).toBe('');
  });
});

describe('calculateDaysUntilExpiry', () => {
  it('returns null for no expiry date', () => {
    expect(calculateDaysUntilExpiry(null)).toBeNull();
    expect(calculateDaysUntilExpiry(undefined)).toBeNull();
  });
  
  it('calculates days correctly for future date', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    const result = calculateDaysUntilExpiry(futureDate.toISOString());
    expect(result).toBeGreaterThan(29);
    expect(result).toBeLessThanOrEqual(31);
  });
  
  it('returns negative for past date', () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 5);
    const result = calculateDaysUntilExpiry(pastDate.toISOString());
    expect(result).toBeLessThan(0);
  });
});

describe('getExpiryStatus', () => {
  it('returns expired for negative days', () => {
    const result = getExpiryStatus(-5);
    expect(result.status).toBe('expired');
    expect(result.variant).toBe('destructive');
    expect(result.message).toContain('kadaluarsa');
  });
  
  it('returns critical for less than 7 days', () => {
    const result = getExpiryStatus(5);
    expect(result.status).toBe('critical');
    expect(result.message).toContain('Kritis');
  });
  
  it('returns warning for less than notification days', () => {
    const result = getExpiryStatus(20, 30);
    expect(result.status).toBe('warning');
    expect(result.message).toContain('Perhatian');
  });
  
  it('returns good for far future', () => {
    const result = getExpiryStatus(60);
    expect(result.status).toBe('good');
    expect(result.message).toContain('lama');
  });
});

describe('isExpired', () => {
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
  
  it('returns false for null', () => {
    expect(isExpired(null)).toBe(false);
  });
});

describe('isExpiringSoon', () => {
  it('returns true for within threshold', () => {
    const soonDate = new Date();
    soonDate.setDate(soonDate.getDate() + 15);
    expect(isExpiringSoon(soonDate.toISOString(), 30)).toBe(true);
  });
  
  it('returns false for far future', () => {
    const farDate = new Date();
    farDate.setDate(farDate.getDate() + 60);
    expect(isExpiringSoon(farDate.toISOString(), 30)).toBe(false);
  });
});

describe('getExpiryColorClass', () => {
  it('returns red for expired', () => {
    expect(getExpiryColorClass(-5)).toContain('red');
  });
  
  it('returns orange for critical', () => {
    expect(getExpiryColorClass(5)).toContain('orange');
  });
  
  it('returns yellow for warning', () => {
    expect(getExpiryColorClass(20)).toContain('yellow');
  });
  
  it('returns green for good', () => {
    expect(getExpiryColorClass(60)).toContain('green');
  });
});

describe('filterByExpiryStatus', () => {
  const products: ExpiringProduct[] = [
    createMockProduct({ id: '1', daysLeft: -5 }) as ExpiringProduct,
    createMockProduct({ id: '2', daysLeft: 5 }) as ExpiringProduct,
    createMockProduct({ id: '3', daysLeft: 20 }) as ExpiringProduct,
    createMockProduct({ id: '4', daysLeft: 60 }) as ExpiringProduct
  ];
  
  it('returns all for all status', () => {
    const result = filterByExpiryStatus(products, 'all');
    expect(result.length).toBe(4);
  });
  
  it('filters expired', () => {
    const result = filterByExpiryStatus(products, 'expired');
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('1');
  });
  
  it('filters critical', () => {
    const result = filterByExpiryStatus(products, 'critical');
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('2');
  });
  
  it('filters warning', () => {
    const result = filterByExpiryStatus(products, 'warning');
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('3');
  });
});

describe('filterByCategory', () => {
  it('returns all for all category', () => {
    const products = [createMockProduct(), createMockProduct()];
    const result = filterByCategory(products, 'all');
    expect(result.length).toBe(2);
  });
  
  it('filters by category', () => {
    const products = [
      createMockProduct({ category: 'Electronics' }),
      createMockProduct({ category: 'Food' })
    ];
    const result = filterByCategory(products, 'Food');
    expect(result.length).toBe(1);
    expect(result[0].category).toBe('Food');
  });
});

describe('searchProducts', () => {
  it('returns all for empty search', () => {
    const products = [createMockProduct(), createMockProduct()];
    const result = searchProducts(products, '');
    expect(result.length).toBe(2);
  });
  
  it('searches by name', () => {
    const products = [
      createMockProduct({ name: 'Laptop' }),
      createMockProduct({ name: 'Mouse' })
    ];
    const result = searchProducts(products, 'lap');
    expect(result.length).toBe(1);
    expect(result[0].name).toBe('Laptop');
  });
  
  it('searches by code', () => {
    const products = [
      createMockProduct({ product_code: 'LAP-001' }),
      createMockProduct({ product_code: 'MOU-001' })
    ];
    const result = searchProducts(products, 'LAP');
    expect(result.length).toBe(1);
  });
});

describe('applyFilters', () => {
  it('applies all filters', () => {
    const products: ExpiringProduct[] = [
      createMockProduct({ id: '1', category: 'Electronics', daysLeft: 20 }) as ExpiringProduct,
      createMockProduct({ id: '2', category: 'Food', daysLeft: 5 }) as ExpiringProduct
    ];
    
    const filter: ExpiryFilter = {
      status: 'warning',
      category: 'Electronics',
      search: ''
    };
    
    const result = applyFilters(products, filter);
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('1');
  });
});

describe('getUniqueCategories', () => {
  it('extracts unique categories', () => {
    const products: ExpiringProduct[] = [
      createMockProduct({ category: 'Electronics' }) as ExpiringProduct,
      createMockProduct({ category: 'Food' }) as ExpiringProduct,
      createMockProduct({ category: 'Electronics' }) as ExpiringProduct
    ];
    const result = getUniqueCategories(products);
    expect(result.length).toBe(2);
    expect(result).toContain('Electronics');
    expect(result).toContain('Food');
  });
});

describe('calculateExpiringProducts', () => {
  it('calculates days left for each product', () => {
    const products = [createMockProduct({ expiryDate: '2025-12-31' })];
    const result = calculateExpiringProducts(products);
    expect(result.length).toBe(1);
    expect(result[0].daysLeft).toBeDefined();
  });
  
  it('filters out products expiring after 90 days', () => {
    const farFuture = new Date();
    farFuture.setDate(farFuture.getDate() + 100);
    const products = [
      createMockProduct({ id: '1', expiryDate: farFuture.toISOString() })
    ];
    const result = calculateExpiringProducts(products);
    expect(result.length).toBe(0);
  });
});

describe('sortByDaysLeft', () => {
  it('sorts ascending by default', () => {
    const products: ExpiringProduct[] = [
      createMockProduct({ id: '1', daysLeft: 60 }) as ExpiringProduct,
      createMockProduct({ id: '2', daysLeft: 5 }) as ExpiringProduct,
      createMockProduct({ id: '3', daysLeft: 30 }) as ExpiringProduct
    ];
    const result = sortByDaysLeft(products);
    expect(result[0].id).toBe('2');
    expect(result[1].id).toBe('3');
    expect(result[2].id).toBe('1');
  });
  
  it('sorts descending when specified', () => {
    const products: ExpiringProduct[] = [
      createMockProduct({ id: '1', daysLeft: 60 }) as ExpiringProduct,
      createMockProduct({ id: '2', daysLeft: 5 }) as ExpiringProduct
    ];
    const result = sortByDaysLeft(products, 'desc');
    expect(result[0].id).toBe('1');
  });
});

describe('groupByCategory', () => {
  it('groups by category', () => {
    const products: ExpiringProduct[] = [
      createMockProduct({ id: '1', category: 'Electronics', daysLeft: 20 }) as ExpiringProduct,
      createMockProduct({ id: '2', category: 'Electronics', daysLeft: 5 }) as ExpiringProduct,
      createMockProduct({ id: '3', category: 'Food', daysLeft: 30 }) as ExpiringProduct
    ];
    const result = groupByCategory(products);
    expect(result.length).toBe(2);
    expect(result.find(g => g.category === 'Electronics')?.totalItems).toBe(2);
  });
  
  it('counts expired and critical correctly', () => {
    const products: ExpiringProduct[] = [
      createMockProduct({ id: '1', daysLeft: -5 }) as ExpiringProduct,
      createMockProduct({ id: '2', daysLeft: 5 }) as ExpiringProduct,
      createMockProduct({ id: '3', daysLeft: 30 }) as ExpiringProduct
    ];
    const result = groupByCategory(products);
    const group = result[0];
    expect(group.expiredCount).toBe(1);
    expect(group.criticalCount).toBe(1);
  });
});

describe('toggleGroupExpansion', () => {
  it('toggles group state', () => {
    const current = { 'Electronics': false };
    const result = toggleGroupExpansion(current, 'Electronics');
    expect(result['Electronics']).toBe(true);
  });
  
  it('adds new group', () => {
    const current = { 'Electronics': true };
    const result = toggleGroupExpansion(current, 'Food');
    expect(result['Food']).toBe(true);
  });
});

describe('getDisplayLimit', () => {
  it('increments display limit', () => {
    expect(getDisplayLimit(5)).toBe(10);
    expect(getDisplayLimit(10)).toBe(15);
  });
  
  it('does not exceed max', () => {
    expect(getDisplayLimit(50)).toBe(50);
  });
});

describe('resetDisplayLimit', () => {
  it('resets to 5', () => {
    expect(resetDisplayLimit()).toBe(5);
  });
});

describe('prepareDiscardState', () => {
  it('prepares discard state correctly', () => {
    const batch = createMockBatch();
    const product = createMockProduct();
    const result = prepareDiscardState(batch, product);
    expect(result.batch?.productName).toBe('Test Product');
    expect(result.quantity).toBe('20');
    expect(result.reason).toBe('Kadaluarsa');
  });
});

describe('updateDiscardQuantity', () => {
  it('updates quantity', () => {
    const state = createInitialDiscardState();
    const result = updateDiscardQuantity(state, '10');
    expect(result.quantity).toBe('10');
  });
});

describe('updateDiscardReason', () => {
  it('updates reason', () => {
    const state = createInitialDiscardState();
    const result = updateDiscardReason(state, 'Rusak');
    expect(result.reason).toBe('Rusak');
  });
});

describe('resetDiscardState', () => {
  it('resets to initial', () => {
    const result = resetDiscardState();
    expect(result.batch).toBeNull();
    expect(result.quantity).toBe('');
    expect(result.reason).toBe('');
  });
});

describe('validateDiscardQuantity', () => {
  it('returns error for empty', () => {
    const result = validateDiscardQuantity('', 10);
    expect(result.valid).toBe(false);
  });
  
  it('returns error for negative', () => {
    const result = validateDiscardQuantity('-5', 10);
    expect(result.valid).toBe(false);
  });
  
  it('returns error when exceeding max', () => {
    const result = validateDiscardQuantity('15', 10);
    expect(result.valid).toBe(false);
  });
  
  it('returns valid for correct quantity', () => {
    const result = validateDiscardQuantity('5', 10);
    expect(result.valid).toBe(true);
  });
});

describe('buildDiscardPayload', () => {
  it('builds correct payload', () => {
    const result = buildDiscardPayload({
      storeId: 'store-1',
      productId: 'prod-1',
      batchId: 'batch-1',
      quantity: 10,
      reason: 'Kadaluarsa'
    });
    
    expect(result.storeId).toBe('store-1');
    expect(result.productId).toBe('prod-1');
    expect(result.batchId).toBe('batch-1');
    expect(result.quantity).toBe(-10);
    expect(result.type).toBe('EXPIRED');
  });
});

describe('calculateExpiryStats', () => {
  it('calculates all stats', () => {
    const products: ExpiringProduct[] = [
      createMockProduct({ id: '1', price: 100000, stock: 10, daysLeft: -5 }) as ExpiringProduct,
      createMockProduct({ id: '2', price: 100000, stock: 5, daysLeft: 5 }) as ExpiringProduct,
      createMockProduct({ id: '3', price: 100000, stock: 20, daysLeft: 20 }) as ExpiringProduct,
      createMockProduct({ id: '4', price: 100000, stock: 15, daysLeft: 60 }) as ExpiringProduct
    ];
    
    const result = calculateExpiryStats(products);
    expect(result.total).toBe(4);
    expect(result.expired).toBe(1);
    expect(result.critical).toBe(1);
    expect(result.warning).toBe(1);
    expect(result.good).toBe(1);
    // (10+5+20+15) * 100000 = 5000000
    expect(result.totalValue).toBe(5000000);
  });
});

describe('getUrgencyBreakdown', () => {
  it('returns breakdown by urgency', () => {
    const products: ExpiringProduct[] = [
      createMockProduct({ id: '1', daysLeft: -5 }) as ExpiringProduct,
      createMockProduct({ id: '2', daysLeft: 5 }) as ExpiringProduct,
      createMockProduct({ id: '3', daysLeft: 20 }) as ExpiringProduct,
      createMockProduct({ id: '4', daysLeft: 45 }) as ExpiringProduct,
      createMockProduct({ id: '5', daysLeft: 90 }) as ExpiringProduct
    ];
    
    const result = getUrgencyBreakdown(products);
    expect(result.expired).toBe(1);
    expect(result.critical).toBe(1);
    expect(result.warning).toBe(1);
    expect(result.attention).toBe(1);
    expect(result.good).toBe(1);
  });
});

describe('calculatePotentialLoss', () => {
  it('calculates loss from expired products', () => {
    const products: ExpiringProduct[] = [
      createMockProduct({ id: '1', stock: 10, purchase_price: 80000, daysLeft: -5 }) as ExpiringProduct,
      createMockProduct({ id: '2', stock: 5, purchase_price: 80000, daysLeft: 30 }) as ExpiringProduct
    ];
    // 10 * 80000 = 800000
    expect(calculatePotentialLoss(products)).toBe(800000);
  });
});

describe('getMostUrgentProducts', () => {
  it('returns most urgent products', () => {
    const products: ExpiringProduct[] = [
      createMockProduct({ id: '1', daysLeft: 60 }) as ExpiringProduct,
      createMockProduct({ id: '2', daysLeft: 5 }) as ExpiringProduct,
      createMockProduct({ id: '3', daysLeft: -5 }) as ExpiringProduct,
      createMockProduct({ id: '4', daysLeft: 20 }) as ExpiringProduct,
      createMockProduct({ id: '5', daysLeft: 30 }) as ExpiringProduct,
      createMockProduct({ id: '6', daysLeft: 1 }) as ExpiringProduct
    ];
    
    const result = getMostUrgentProducts(products, 3);
    expect(result.length).toBe(3);
    // Should be sorted by daysLeft asc: -5, 1, 5
    expect(result[0].daysLeft).toBe(-5);
    expect(result[1].daysLeft).toBe(1);
    expect(result[2].daysLeft).toBe(5);
  });
});

describe('formatExpiryDate', () => {
  it('formats date correctly', () => {
    const result = formatExpiryDate('2025-12-31');
    expect(result).toContain('2025');
    expect(result).toContain('Des');
  });
  
  it('returns dash for null', () => {
    expect(formatExpiryDate(null)).toBe('-');
  });
});

describe('formatDaysLeft', () => {
  it('formats negative days', () => {
    expect(formatDaysLeft(-5)).toContain('terlambat');
  });
  
  it('formats zero', () => {
    expect(formatDaysLeft(0)).toContain('Hari ini');
  });
  
  it('formats positive days', () => {
    expect(formatDaysLeft(30)).toContain('30 hari');
  });
});

describe('getStatusBadgeText', () => {
  it('returns status message', () => {
    const status = getExpiryStatus(5);
    expect(getStatusBadgeText(status)).toBe(status.message);
  });
});

describe('formatStockValue', () => {
  it('formats with unit', () => {
    expect(formatStockValue(100, 'pcs')).toBe('100 pcs');
  });
  
  it('uses default unit', () => {
    expect(formatStockValue(100)).toBe('100 pcs');
  });
});

describe('calculateStockValue', () => {
  it('calculates correctly', () => {
    expect(calculateStockValue(100000, 50)).toBe(5000000);
  });
});

describe('isValidFilter', () => {
  it('always returns true', () => {
    expect(isValidFilter()).toBe(true);
  });
});

describe('hasExpiringProducts', () => {
  it('returns true when has products', () => {
    const products: ExpiringProduct[] = [
      createMockProduct({ daysLeft: 20 }) as ExpiringProduct
    ];
    expect(hasExpiringProducts(products)).toBe(true);
  });
  
  it('returns false for empty', () => {
    expect(hasExpiringProducts([])).toBe(false);
  });
});

describe('hasExpiredProducts', () => {
  it('detects expired products', () => {
    const products: ExpiringProduct[] = [
      createMockProduct({ daysLeft: -5 }) as ExpiringProduct
    ];
    expect(hasExpiredProducts(products)).toBe(true);
  });
});

describe('hasCriticalProducts', () => {
  it('detects critical products', () => {
    const products: ExpiringProduct[] = [
      createMockProduct({ daysLeft: 5 }) as ExpiringProduct
    ];
    expect(hasCriticalProducts(products)).toBe(true);
  });
});

describe('canDiscard', () => {
  it('returns true when valid', () => {
    expect(canDiscard({
      batch: createMockBatch(),
      quantity: '10',
      reason: 'Test'
    })).toBe(true);
  });
  
  it('returns false when no batch', () => {
    expect(canDiscard(createInitialDiscardState())).toBe(false);
  });
});

describe('prepareExpiryExport', () => {
  it('prepares data correctly', () => {
    const products: ExpiringProduct[] = [
      createMockProduct() as ExpiringProduct
    ];
    const result = prepareExpiryExport(products);
    expect(result.length).toBe(1);
    expect(result[0]['Nama Produk']).toBe('Test Product');
    expect(result[0]['Kategori']).toBe('Electronics');
  });
});

describe('getExpirySummary', () => {
  it('returns summary text', () => {
    const stats = {
      total: 10,
      expired: 2,
      critical: 3,
      warning: 4,
      good: 1,
      totalValue: 1000000
    };
    const result = getExpirySummary(stats);
    expect(result).toContain('Total: 10');
    expect(result).toContain('expired: 2');
  });
});
