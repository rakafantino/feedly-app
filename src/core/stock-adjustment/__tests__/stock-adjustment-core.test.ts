/**
 * TDD Tests for stock-adjustment-core.ts
 * Edge cases first, then normal cases
 */

import {
  // Constants
  getAdjustmentTypes,
  getDefaultAdjustmentType,
  
  // Initialization
  createInitialAdjustmentState,
  createInitialFilterState,
  
  // Filtering
  filterProducts,
  filterByCategory,
  getUniqueCategories,
  getLowStockProducts,
  getOutOfStockProducts,
  
  // Adjustment State Management
  resetAdjustmentState,
  updateAdjustmentType,
  updateAdjustmentQuantity,
  updateAdjustmentDirection,
  updateAdjustmentReason,
  updateSelectedBatch,
  updateSelectedProduct,
  
  // Validation
  validateAdjustment,
  validateQuantity,
  validateReason,
  canSubmitAdjustment,
  
  // Calculations
  getMaxQuantity,
  calculateNewStock,
  calculateStockDiffPercentage,
  getAdjustmentSummary,
  
  // Parsing & Formatting
  parseQuantity,
  formatQuantity,
  formatStockChange,
  getAdjustmentTypeLabel,
  getAdjustmentTypeDescription,
  
  // Batch Management
  getAvailableBatches,
  getBatchDisplayInfo,
  findBatchById,
  calculateTotalBatchStock,
  hasBatches,
  
  // API Payload
  buildAdjustmentPayload,
  
  // Statistics
  getAdjustmentStats,
  getProductsNeedingAdjustment,
  getStockHealthScore,
  
  // Export
  prepareAdjustmentExport,
  getAdjustmentSummaryText
} from '../stock-adjustment-core';
import { ProductForAdjustment, ProductBatch, AdjustmentState } from '../stock-adjustment-core';

// Mock helpers
const createMockProduct = (overrides: Partial<ProductForAdjustment> = {}): ProductForAdjustment => ({
  id: 'prod-1',
  name: 'Test Product',
  category: 'Electronics',
  stock: 50,
  unit: 'pcs',
  price: 100000,
  ...overrides
});

const createMockBatch = (overrides: Partial<ProductBatch> = {}): ProductBatch => ({
  id: 'batch-1',
  stock: 20,
  batchNumber: 'B001',
  expiryDate: '2025-12-31',
  ...overrides
});

describe('getAdjustmentTypes', () => {
  it('returns all adjustment types', () => {
    const result = getAdjustmentTypes();
    expect(result.length).toBe(4);
    expect(result.map(t => t.value)).toContain('CORRECTION');
    expect(result.map(t => t.value)).toContain('WASTE');
    expect(result.map(t => t.value)).toContain('DAMAGED');
    expect(result.map(t => t.value)).toContain('EXPIRED');
  });
});

describe('getDefaultAdjustmentType', () => {
  it('returns CORRECTION', () => {
    expect(getDefaultAdjustmentType()).toBe('CORRECTION');
  });
});

describe('createInitialAdjustmentState', () => {
  it('creates initial state', () => {
    const result = createInitialAdjustmentState();
    expect(result.product).toBeNull();
    expect(result.batchId).toBe('');
    expect(result.type).toBe('CORRECTION');
    expect(result.quantity).toBe('');
    expect(result.isPositive).toBe(false);
    expect(result.reason).toBe('');
  });
});

describe('createInitialFilterState', () => {
  it('creates default filter state', () => {
    const result = createInitialFilterState();
    expect(result.search).toBe('');
  });
});

describe('filterProducts', () => {
  it('returns all when no search', () => {
    const products = [createMockProduct(), createMockProduct()];
    const result = filterProducts(products, '');
    expect(result.length).toBe(2);
  });
  
  it('filters by name', () => {
    const products = [
      createMockProduct({ name: 'Laptop' }),
      createMockProduct({ name: 'Mouse' })
    ];
    const result = filterProducts(products, 'lap');
    expect(result.length).toBe(1);
    expect(result[0].name).toBe('Laptop');
  });
  
  it('filters by category', () => {
    const products = [
      createMockProduct({ name: 'Laptop', category: 'Electronics' }),
      createMockProduct({ name: 'Apel', category: 'Food' })
    ];
    const result = filterProducts(products, 'elec');
    expect(result.length).toBe(1);
    expect(result[0].category).toBe('Electronics');
  });
});

describe('filterByCategory', () => {
  it('returns all when all selected', () => {
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

describe('getUniqueCategories', () => {
  it('extracts unique categories', () => {
    const products = [
      createMockProduct({ category: 'Electronics' }),
      createMockProduct({ category: 'Food' }),
      createMockProduct({ category: 'Electronics' })
    ];
    const result = getUniqueCategories(products);
    expect(result.length).toBe(2);
    expect(result).toContain('Electronics');
    expect(result).toContain('Food');
  });
});

describe('getLowStockProducts', () => {
  it('filters products below threshold', () => {
    const products = [
      createMockProduct({ id: '1', stock: 5 }),
      createMockProduct({ id: '2', stock: 15 }),
      createMockProduct({ id: '3', stock: 10 })
    ];
    const result = getLowStockProducts(products, 10);
    expect(result.length).toBe(2);
  });
});

describe('getOutOfStockProducts', () => {
  it('filters products with zero stock', () => {
    const products = [
      createMockProduct({ id: '1', stock: 0 }),
      createMockProduct({ id: '2', stock: 5 }),
      createMockProduct({ id: '3', stock: 0 })
    ];
    const result = getOutOfStockProducts(products);
    expect(result.length).toBe(2);
  });
});

describe('resetAdjustmentState', () => {
  it('resets to initial state', () => {
    const result = resetAdjustmentState();
    expect(result.product).toBeNull();
    expect(result.type).toBe('CORRECTION');
    expect(result.quantity).toBe('');
    expect(result.isPositive).toBe(false);
    expect(result.reason).toBe('');
  });
});

describe('updateAdjustmentType', () => {
  it('updates type', () => {
    const state = createInitialAdjustmentState();
    const result = updateAdjustmentType(state, 'WASTE');
    expect(result.type).toBe('WASTE');
  });
});

describe('updateAdjustmentQuantity', () => {
  it('updates quantity', () => {
    const state = createInitialAdjustmentState();
    const result = updateAdjustmentQuantity(state, '10');
    expect(result.quantity).toBe('10');
  });
});

describe('updateAdjustmentDirection', () => {
  it('updates direction', () => {
    const state = createInitialAdjustmentState();
    const result = updateAdjustmentDirection(state, true);
    expect(result.isPositive).toBe(true);
  });
});

describe('updateAdjustmentReason', () => {
  it('updates reason', () => {
    const state = createInitialAdjustmentState();
    const result = updateAdjustmentReason(state, 'Barang rusak');
    expect(result.reason).toBe('Barang rusak');
  });
});

describe('updateSelectedBatch', () => {
  it('updates batch id', () => {
    const state = createInitialAdjustmentState();
    const result = updateSelectedBatch(state, 'batch-1');
    expect(result.batchId).toBe('batch-1');
  });
});

describe('updateSelectedProduct', () => {
  it('updates product and resets related fields', () => {
    const state: AdjustmentState = {
      product: createMockProduct({ id: 'old' }),
      batchId: 'batch-1',
      type: 'WASTE',
      quantity: '10',
      isPositive: true,
      reason: 'Test'
    };
    const product = createMockProduct({ id: 'new' });
    const result = updateSelectedProduct(state, product);
    expect(result.product?.id).toBe('new');
    expect(result.batchId).toBe('');
    expect(result.quantity).toBe('');
    expect(result.reason).toBe('');
  });
});

describe('validateAdjustment', () => {
  it('returns error for no product', () => {
    const result = validateAdjustment({
      selectedProduct: null,
      quantity: '10',
      isPositive: false,
      productBatches: [],
      selectedBatchId: '',
      maxQuantity: 50
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Pilih produk');
  });
  
  it('returns error for empty quantity', () => {
    const result = validateAdjustment({
      selectedProduct: createMockProduct(),
      quantity: '',
      isPositive: false,
      productBatches: [],
      selectedBatchId: '',
      maxQuantity: 50
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Lengkapi');
  });
  
  it('returns error for invalid quantity', () => {
    const result = validateAdjustment({
      selectedProduct: createMockProduct(),
      quantity: 'abc',
      isPositive: false,
      productBatches: [],
      selectedBatchId: '',
      maxQuantity: 50
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('tidak valid');
  });
  
  it('returns error when exceeding stock', () => {
    const result = validateAdjustment({
      selectedProduct: createMockProduct({ stock: 10 }),
      quantity: '20',
      isPositive: false,
      productBatches: [],
      selectedBatchId: '',
      maxQuantity: 10
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('melebihi stok');
  });
  
  it('returns valid for correct adjustment', () => {
    const result = validateAdjustment({
      selectedProduct: createMockProduct({ stock: 50 }),
      quantity: '10',
      isPositive: true,
      productBatches: [],
      selectedBatchId: '',
      maxQuantity: 9999
    });
    expect(result.valid).toBe(true);
  });
});

describe('validateQuantity', () => {
  it('returns error for empty', () => {
    const result = validateQuantity('');
    expect(result.valid).toBe(false);
  });
  
  it('returns error for negative', () => {
    const result = validateQuantity('-10');
    expect(result.valid).toBe(false);
  });
  
  it('returns error when exceeding max', () => {
    const result = validateQuantity('60', 50);
    expect(result.valid).toBe(false);
  });
  
  it('returns valid for correct value', () => {
    const result = validateQuantity('25', 50);
    expect(result.valid).toBe(true);
  });
});

describe('validateReason', () => {
  it('returns valid for empty when type has description', () => {
    const result = validateReason('', 'CORRECTION');
    expect(result.valid).toBe(true);
  });
  
  it('returns error for too short', () => {
    const result = validateReason('ab', 'CORRECTION');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('minimal');
  });
  
  it('returns valid for proper reason', () => {
    const result = validateReason('Barang rusak saat pengiriman', 'WASTE');
    expect(result.valid).toBe(true);
  });
});

describe('canSubmitAdjustment', () => {
  it('returns false for no product', () => {
    const state = createInitialAdjustmentState();
    expect(canSubmitAdjustment(state, [])).toBe(false);
  });
  
  it('returns false for empty quantity', () => {
    const state = updateSelectedProduct(createInitialAdjustmentState(), createMockProduct());
    expect(canSubmitAdjustment(state, [])).toBe(false);
  });
  
  it('returns true for valid adjustment', () => {
    const product = createMockProduct();
    const state = {
      ...updateSelectedProduct(createInitialAdjustmentState(), product),
      quantity: '10'
    };
    expect(canSubmitAdjustment(state, [])).toBe(true);
  });
});

describe('getMaxQuantity', () => {
  it('returns 9999 for positive adjustment', () => {
    const state = {
      ...createInitialAdjustmentState(),
      isPositive: true
    };
    expect(getMaxQuantity(state, [])).toBe(9999);
  });
  
  it('returns batch stock for negative with batch', () => {
    const state = {
      ...createInitialAdjustmentState(),
      isPositive: false,
      product: createMockProduct(),
      batchId: 'batch-1'
    };
    const batches = [createMockBatch({ id: 'batch-1', stock: 15 })];
    expect(getMaxQuantity(state, batches)).toBe(15);
  });
  
  it('returns product stock for negative without batch', () => {
    const state = {
      ...createInitialAdjustmentState(),
      isPositive: false,
      product: createMockProduct({ stock: 50 }),
      batchId: ''
    };
    expect(getMaxQuantity(state, [])).toBe(50);
  });
});

describe('calculateNewStock', () => {
  it('adds for positive adjustment', () => {
    expect(calculateNewStock(50, '10', true)).toBe(60);
  });
  
  it('subtracts for negative adjustment', () => {
    expect(calculateNewStock(50, '10', false)).toBe(40);
  });
  
  it('returns 0 for negative exceeding stock', () => {
    expect(calculateNewStock(5, '10', false)).toBe(0);
  });
});

describe('calculateStockDiffPercentage', () => {
  it('calculates correctly', () => {
    expect(calculateStockDiffPercentage(100, 120)).toBe(20);
    expect(calculateStockDiffPercentage(100, 80)).toBe(-20);
  });
  
  it('handles zero stock', () => {
    expect(calculateStockDiffPercentage(0, 50)).toBe(100);
    expect(calculateStockDiffPercentage(0, 0)).toBe(0);
  });
});

describe('getAdjustmentSummary', () => {
  it('returns summary', () => {
    const result = getAdjustmentSummary({
      product: createMockProduct({ stock: 50 }),
      quantity: '10',
      isPositive: true,
      type: 'CORRECTION'
    });
    expect(result.originalStock).toBe(50);
    expect(result.newStock).toBe(60);
    expect(result.diff).toBe(10);
    expect(result.typeLabel).toBe('Koreksi Stok');
  });
  
  it('handles null product', () => {
    const result = getAdjustmentSummary({
      product: null,
      quantity: '10',
      isPositive: true,
      type: 'CORRECTION'
    });
    expect(result.originalStock).toBe(0);
  });
});

describe('parseQuantity', () => {
  it('parses correctly', () => {
    expect(parseQuantity('10')).toBe(10);
    expect(parseQuantity('10.5')).toBe(10.5);
  });
  
  it('returns 0 for invalid', () => {
    expect(parseQuantity('abc')).toBe(0);
  });
});

describe('formatQuantity', () => {
  it('formats with thousand separator', () => {
    expect(formatQuantity(1000)).toBe('1.000');
  });
});

describe('formatStockChange', () => {
  it('formats with sign', () => {
    expect(formatStockChange(50, 60)).toBe('+10');
    expect(formatStockChange(50, 40)).toBe('-10');
  });
});

describe('getAdjustmentTypeLabel', () => {
  it('returns correct label', () => {
    expect(getAdjustmentTypeLabel('CORRECTION')).toBe('Koreksi Stok');
    expect(getAdjustmentTypeLabel('WASTE')).toBe('Waste/Terbuang');
  });
});

describe('getAdjustmentTypeDescription', () => {
  it('returns correct description', () => {
    const result = getAdjustmentTypeDescription('CORRECTION');
    expect(result).toContain('stock opname');
  });
});

describe('getAvailableBatches', () => {
  it('filters out empty batches', () => {
    const product = createMockProduct({
      batches: [
        createMockBatch({ id: '1', stock: 10 }),
        createMockBatch({ id: '2', stock: 0 })
      ]
    });
    const result = getAvailableBatches(product);
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('1');
  });
});

describe('getBatchDisplayInfo', () => {
  it('formats batch info', () => {
    const batch = createMockBatch({ batchNumber: 'B001', expiryDate: '2025-12-31', stock: 20 });
    const result = getBatchDisplayInfo(batch);
    expect(result).toContain('B001');
    expect(result).toContain('20');
  });
});

describe('findBatchById', () => {
  it('finds batch', () => {
    const batches = [createMockBatch({ id: '1' }), createMockBatch({ id: '2' })];
    const result = findBatchById(batches, '2');
    expect(result?.id).toBe('2');
  });
  
  it('returns undefined for not found', () => {
    const result = findBatchById([], 'not-found');
    expect(result).toBeUndefined();
  });
});

describe('calculateTotalBatchStock', () => {
  it('sums batch stock', () => {
    const batches = [
      createMockBatch({ stock: 10 }),
      createMockBatch({ stock: 15 })
    ];
    expect(calculateTotalBatchStock(batches)).toBe(25);
  });
});

describe('hasBatches', () => {
  it('returns true when product has batches', () => {
    const product = createMockProduct({ batches: [createMockBatch()] });
    expect(hasBatches(product)).toBe(true);
  });
  
  it('returns false for no batches', () => {
    expect(hasBatches(createMockProduct())).toBe(false);
  });
});

describe('buildAdjustmentPayload', () => {
  it('builds correct payload', () => {
    const product = createMockProduct({ storeId: 'store-1' });
    const result = buildAdjustmentPayload({
      product,
      quantity: '10',
      isPositive: true,
      type: 'CORRECTION',
      reason: 'Stock opname',
      batchId: '',
      productBatches: []
    });
    
    expect(result.storeId).toBe('store-1');
    expect(result.productId).toBe('prod-1');
    expect(result.quantity).toBe(10);
    expect(result.type).toBe('CORRECTION');
  });
  
  it('handles negative quantity', () => {
    const product = createMockProduct();
    const result = buildAdjustmentPayload({
      product,
      quantity: '5',
      isPositive: false,
      type: 'WASTE',
      reason: '',
      batchId: '',
      productBatches: []
    });
    
    expect(result.quantity).toBe(-5);
  });
});

describe('getAdjustmentStats', () => {
  it('returns correct stats', () => {
    const products = [
      createMockProduct({ stock: 5 }),
      createMockProduct({ stock: 0 }),
      createMockProduct({ stock: 50 })
    ];
    const result = getAdjustmentStats(products);
    expect(result.total).toBe(3);
    expect(result.lowStock).toBe(1);
    expect(result.outOfStock).toBe(1);
  });
});

describe('getProductsNeedingAdjustment', () => {
  it('filters products with low stock', () => {
    const products = [
      createMockProduct({ stock: 5 }),
      createMockProduct({ stock: 15 })
    ];
    const result = getProductsNeedingAdjustment(products);
    expect(result.length).toBe(1);
  });
});

describe('getStockHealthScore', () => {
  it('calculates percentage', () => {
    const products = [
      createMockProduct({ stock: 50 }),
      createMockProduct({ stock: 100 }),
      createMockProduct({ stock: 5 }),
      createMockProduct({ stock: 0 })
    ];
    expect(getStockHealthScore(products)).toBe(50); // 2/4 = 50%
  });
  
  it('returns 100 for empty', () => {
    expect(getStockHealthScore([])).toBe(100);
  });
});

describe('prepareAdjustmentExport', () => {
  it('prepares data correctly', () => {
    const adjustments = [
      { productName: 'Product A', type: 'CORRECTION', quantity: 10, date: '2025-01-15' }
    ];
    const result = prepareAdjustmentExport(adjustments);
    expect(result[0]['Produk']).toBe('Product A');
    expect(result[0]['Jumlah']).toBe('10');
  });
});

describe('getAdjustmentSummaryText', () => {
  it('formats correctly', () => {
    const product = createMockProduct({ name: 'Laptop' });
    const result = getAdjustmentSummaryText(product, 60);
    expect(result).toContain('Laptop');
    expect(result).toContain('50');
    expect(result).toContain('60');
    expect(result).toContain('+10');
  });
});
