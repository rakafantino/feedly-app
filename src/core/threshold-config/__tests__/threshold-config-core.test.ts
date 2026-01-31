/**
 * TDD Tests for threshold-config-core.ts
 * Edge cases first, then normal cases
 */

import {
  // Initialization
  createInitialThresholdState,
  createInitialFilterState,
  createInitialMassUpdateState,
  
  // Threshold Initialization
  initializeThresholds,
  initializeProductThresholds,
  
  // Filtering
  filterProducts,
  getUniqueCategories,
  filterCategories,
  getDisplayedCategories,
  
  // Threshold Management
  updateProductThresholdState,
  updateCategoryThresholdState,
  bulkUpdateProductThresholds,
  bulkUpdateCategoryThresholds,
  
  // Selection Management
  toggleProductSelection,
  toggleSelectAll,
  clearSelections,
  
  // Validation
  validateThreshold,
  validateMassUpdate,
  validateCategoryThreshold,
  hasThresholdChanged,
  hasAnyProductChanged,
  hasAnyCategoryChanged,
  
  // Calculations
  calculateAverageThreshold,
  countProductsWithThreshold,
  countProductsWithoutThreshold,
  getCategoryThresholdStats,
  calculateThresholdCoverage,
  
  // Parsing & Formatting
  parseThreshold,
  formatThreshold,
  formatThresholdForInput,
  
  // Comparison
  compareThresholds,
  isAtCategoryAverage,
  findDeviatingProducts,
  
  // Statistics
  getThresholdDistribution,
  getLowThresholdProducts,
  getProductsWithoutThreshold,
  
  // Export
  prepareThresholdExport,
  getThresholdSummary,
  
  // Grouping
  groupProductsByCategory,
  getCategoriesByCount
} from '../threshold-config-core';
import { Product, FilterState } from '../threshold-config-core';

// Mock helpers
const createMockProduct = (overrides: Partial<Product> = {}): Product => ({
  id: 'prod-1',
  name: 'Test Product',
  category: 'Electronics',
  threshold: 10,
  ...overrides
});

describe('createInitialThresholdState', () => {
  it('creates empty state', () => {
    const result = createInitialThresholdState();
    expect(result.productThresholds).toEqual({});
    expect(result.categoryThresholds).toEqual({});
  });
});

describe('createInitialFilterState', () => {
  it('creates default filter state', () => {
    const result = createInitialFilterState();
    expect(result.search).toBe('');
    expect(result.category).toBe('all');
  });
});

describe('createInitialMassUpdateState', () => {
  it('creates default mass update state', () => {
    const result = createInitialMassUpdateState();
    expect(result.value).toBe('');
    expect(result.selectedIds).toEqual([]);
    expect(result.selectAll).toBe(false);
  });
});

describe('initializeThresholds', () => {
  it('initializes product thresholds correctly', () => {
    const products = [
      createMockProduct({ id: '1', threshold: 10 }),
      createMockProduct({ id: '2', threshold: 20 })
    ];
    const result = initializeThresholds(products);
    expect(result.productThresholds['1']).toBe('10');
    expect(result.productThresholds['2']).toBe('20');
  });
  
  it('handles null threshold', () => {
    const products = [
      createMockProduct({ id: '1', threshold: null }),
      createMockProduct({ id: '2', threshold: 20 })
    ];
    const result = initializeThresholds(products);
    expect(result.productThresholds['1']).toBe('');
  });
  
  it('calculates category averages correctly', () => {
    const products = [
      createMockProduct({ id: '1', category: 'Electronics', threshold: 10 }),
      createMockProduct({ id: '2', category: 'Electronics', threshold: 20 }),
      createMockProduct({ id: '3', category: 'Food', threshold: 15 })
    ];
    const result = initializeThresholds(products);
    // (10 + 20) / 2 = 15
    expect(result.categoryThresholds['Electronics']).toBe('15');
    expect(result.categoryThresholds['Food']).toBe('15');
  });
  
  it('handles category with no valid thresholds', () => {
    const products = [
      createMockProduct({ id: '1', category: 'Electronics', threshold: null }),
      createMockProduct({ id: '2', category: 'Electronics', threshold: null })
    ];
    const result = initializeThresholds(products);
    expect(result.categoryThresholds['Electronics']).toBe('');
  });
});

describe('initializeProductThresholds', () => {
  it('initializes all product thresholds', () => {
    const products = [
      createMockProduct({ id: '1', threshold: 10 }),
      createMockProduct({ id: '2', threshold: null })
    ];
    const result = initializeProductThresholds(products);
    expect(result['1']).toBe('10');
    expect(result['2']).toBe('');
  });
});

describe('filterProducts', () => {
  it('returns all when no filter', () => {
    const products = [createMockProduct(), createMockProduct()];
    const result = filterProducts(products, createInitialFilterState());
    expect(result.length).toBe(2);
  });
  
  it('filters by search term', () => {
    const products = [
      createMockProduct({ name: 'Mie Goreng' }),
      createMockProduct({ name: 'Kopi Luwak' })
    ];
    const filters: FilterState = { search: 'mie', category: 'all' };
    const result = filterProducts(products, filters);
    expect(result.length).toBe(1);
    expect(result[0].name).toBe('Mie Goreng');
  });
  
  it('filters by category', () => {
    const products = [
      createMockProduct({ category: 'Electronics' }),
      createMockProduct({ category: 'Food' })
    ];
    const filters: FilterState = { search: '', category: 'Food' };
    const result = filterProducts(products, filters);
    expect(result.length).toBe(1);
    expect(result[0].category).toBe('Food');
  });
  
  it('filters by both search and category', () => {
    const products = [
      createMockProduct({ name: 'Laptop', category: 'Electronics' }),
      createMockProduct({ name: 'Mouse', category: 'Electronics' }),
      createMockProduct({ name: 'Laptop', category: 'Food' })
    ];
    const filters: FilterState = { search: 'laptop', category: 'Electronics' };
    const result = filterProducts(products, filters);
    expect(result.length).toBe(1);
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
  
  it('filters out null/undefined', () => {
    const products = [
      createMockProduct({ category: 'Electronics' }),
      createMockProduct({ category: null }),
      createMockProduct({ category: undefined })
    ];
    const result = getUniqueCategories(products);
    expect(result.length).toBe(1);
    expect(result).toContain('Electronics');
  });
});

describe('filterCategories', () => {
  it('filters by category name', () => {
    const categories = ['Electronics', 'Food', 'Clothing'];
    const products = [
      createMockProduct({ category: 'Electronics', name: 'Laptop' })
    ];
    const result = filterCategories(categories, products, 'elec');
    expect(result).toContain('Electronics');
  });
  
  it('includes category if product matches search', () => {
    const categories = ['Electronics', 'Food'];
    const products = [
      createMockProduct({ category: 'Electronics', name: 'Laptop Gaming' })
    ];
    const result = filterCategories(categories, products, 'gaming');
    expect(result).toContain('Electronics');
  });
});

describe('getDisplayedCategories', () => {
  it('returns all when all selected', () => {
    const result = getDisplayedCategories(['A', 'B', 'C'], 'all');
    expect(result).toEqual(['A', 'B', 'C']);
  });
  
  it('filters to selected category', () => {
    const result = getDisplayedCategories(['A', 'B', 'C'], 'B');
    expect(result).toEqual(['B']);
  });
});

describe('updateProductThresholdState', () => {
  it('updates threshold for product', () => {
    const state = { '1': '10' };
    const result = updateProductThresholdState(state, '1', '20');
    expect(result['1']).toBe('20');
  });
  
  it('adds new product threshold', () => {
    const state = { '1': '10' };
    const result = updateProductThresholdState(state, '2', '15');
    expect(result['1']).toBe('10');
    expect(result['2']).toBe('15');
  });
});

describe('updateCategoryThresholdState', () => {
  it('updates threshold for category', () => {
    const state = { 'Electronics': '10' };
    const result = updateCategoryThresholdState(state, 'Electronics', '15');
    expect(result['Electronics']).toBe('15');
  });
});

describe('bulkUpdateProductThresholds', () => {
  it('merges updates', () => {
    const state = { '1': '10' };
    const updates = { '1': '20', '2': '15' };
    const result = bulkUpdateProductThresholds(state, updates);
    expect(result['1']).toBe('20');
    expect(result['2']).toBe('15');
  });
});

describe('bulkUpdateCategoryThresholds', () => {
  it('merges updates', () => {
    const state = { 'Electronics': '10' };
    const updates = { 'Electronics': '15', 'Food': '20' };
    const result = bulkUpdateCategoryThresholds(state, updates);
    expect(result['Electronics']).toBe('15');
    expect(result['Food']).toBe('20');
  });
});

describe('toggleProductSelection', () => {
  it('adds product when not selected', () => {
    const result = toggleProductSelection(['1', '2'], '3');
    expect(result).toContain('3');
  });
  
  it('removes product when already selected', () => {
    const result = toggleProductSelection(['1', '2'], '2');
    expect(result).not.toContain('2');
    expect(result).toEqual(['1']);
  });
});

describe('toggleSelectAll', () => {
  it('selects all when not select all', () => {
    const products = [createMockProduct({ id: '1' }), createMockProduct({ id: '2' })];
    const result = toggleSelectAll([], false, products);
    expect(result.selectedIds).toEqual(['1', '2']);
    expect(result.selectAll).toBe(true);
  });
  
  it('clears selection when select all is true', () => {
    const result = toggleSelectAll(['1', '2'], true, []);
    expect(result.selectedIds).toEqual([]);
    expect(result.selectAll).toBe(false);
  });
});

describe('clearSelections', () => {
  it('clears all selections', () => {
    const result = clearSelections();
    expect(result.selectedIds).toEqual([]);
    expect(result.selectAll).toBe(false);
  });
});

describe('validateThreshold', () => {
  it('returns valid for empty string', () => {
    const result = validateThreshold('');
    expect(result.valid).toBe(true);
  });
  
  it('returns valid for positive number', () => {
    const result = validateThreshold('100');
    expect(result.valid).toBe(true);
  });
  
  it('returns error for non-numeric', () => {
    const result = validateThreshold('abc');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('angka');
  });
  
  it('returns error for negative number', () => {
    const result = validateThreshold('-5');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('negatif');
  });
  
  it('returns error for too large number', () => {
    const result = validateThreshold('1000000');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('terlalu besar');
  });
});

describe('validateMassUpdate', () => {
  it('returns error for empty value', () => {
    const result = validateMassUpdate('', 5);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('harus diisi');
  });
  
  it('returns error for no selection', () => {
    const result = validateMassUpdate('10', 0);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Pilih minimal');
  });
  
  it('returns valid for correct input', () => {
    const result = validateMassUpdate('10', 5);
    expect(result.valid).toBe(true);
  });
});

describe('validateCategoryThreshold', () => {
  it('validates correctly', () => {
    const result = validateCategoryThreshold('50');
    expect(result.valid).toBe(true);
  });
  
  it('returns error for invalid', () => {
    const result = validateCategoryThreshold('-10');
    expect(result.valid).toBe(false);
  });
});

describe('hasThresholdChanged', () => {
  it('returns false for same values', () => {
    expect(hasThresholdChanged('10', '10')).toBe(false);
    expect(hasThresholdChanged('', null)).toBe(false);
  });
  
  it('returns true for different values', () => {
    expect(hasThresholdChanged('10', '20')).toBe(true);
    expect(hasThresholdChanged('', '10')).toBe(true);
  });
});

describe('hasAnyProductChanged', () => {
  it('returns true when some changed', () => {
    const products = [
      createMockProduct({ id: '1', threshold: 10 }),
      createMockProduct({ id: '2', threshold: 20 })
    ];
    const currentThresholds = { '1': '10', '2': '25' };
    expect(hasAnyProductChanged(currentThresholds, products)).toBe(true);
  });
  
  it('returns false when none changed', () => {
    const products = [
      createMockProduct({ id: '1', threshold: 10 }),
      createMockProduct({ id: '2', threshold: 20 })
    ];
    const currentThresholds = { '1': '10', '2': '20' };
    expect(hasAnyProductChanged(currentThresholds, products)).toBe(false);
  });
});

describe('hasAnyCategoryChanged', () => {
  it('returns true when changed', () => {
    const current = { 'Electronics': '15' };
    const original = { 'Electronics': '10' };
    expect(hasAnyCategoryChanged(current, original)).toBe(true);
  });
  
  it('returns false when same', () => {
    const current = { 'Electronics': '10' };
    const original = { 'Electronics': '10' };
    expect(hasAnyCategoryChanged(current, original)).toBe(false);
  });
});

describe('calculateAverageThreshold', () => {
  it('calculates correctly', () => {
    const products = [
      createMockProduct({ threshold: 10 }),
      createMockProduct({ threshold: 20 }),
      createMockProduct({ threshold: 30 })
    ];
    expect(calculateAverageThreshold(products)).toBe(20);
  });
  
  it('returns null for no valid thresholds', () => {
    const products = [
      createMockProduct({ threshold: null }),
      createMockProduct({ threshold: null })
    ];
    expect(calculateAverageThreshold(products)).toBeNull();
  });
  
  it('handles empty array', () => {
    expect(calculateAverageThreshold([])).toBeNull();
  });
});

describe('countProductsWithThreshold', () => {
  it('counts correctly', () => {
    const products = [
      createMockProduct({ threshold: 10 }),
      createMockProduct({ threshold: null }),
      createMockProduct({ threshold: 20 })
    ];
    expect(countProductsWithThreshold(products)).toBe(2);
  });
});

describe('countProductsWithoutThreshold', () => {
  it('counts correctly', () => {
    const products = [
      createMockProduct({ threshold: 10 }),
      createMockProduct({ threshold: null }),
      createMockProduct({ threshold: undefined })
    ];
    expect(countProductsWithoutThreshold(products)).toBe(2);
  });
});

describe('getCategoryThresholdStats', () => {
  it('returns all stats', () => {
    const products = [
      createMockProduct({ threshold: 10 }),
      createMockProduct({ threshold: 20 }),
      createMockProduct({ threshold: null })
    ];
    const result = getCategoryThresholdStats(products);
    expect(result.total).toBe(3);
    expect(result.withThreshold).toBe(2);
    expect(result.withoutThreshold).toBe(1);
    expect(result.average).toBe(15);
  });
});

describe('calculateThresholdCoverage', () => {
  it('calculates percentage', () => {
    const products = [
      createMockProduct({ threshold: 10 }),
      createMockProduct({ threshold: 20 }),
      createMockProduct({ threshold: null })
    ];
    expect(calculateThresholdCoverage(products)).toBe(67); // 2/3 rounded
  });
  
  it('returns 0 for empty', () => {
    expect(calculateThresholdCoverage([])).toBe(0);
  });
});

describe('parseThreshold', () => {
  it('parses correctly', () => {
    expect(parseThreshold('100')).toBe(100);
  });
  
  it('returns null for empty', () => {
    expect(parseThreshold('')).toBeNull();
  });
});

describe('formatThreshold', () => {
  it('formats number', () => {
    expect(formatThreshold(1000)).toBe('1.000');
  });
  
  it('returns dash for null', () => {
    expect(formatThreshold(null)).toBe('-');
  });
});

describe('formatThresholdForInput', () => {
  it('formats for input', () => {
    expect(formatThresholdForInput(100)).toBe('100');
    expect(formatThresholdForInput(null)).toBe('');
  });
});

describe('compareThresholds', () => {
  it('compares correctly', () => {
    expect(compareThresholds('10', '20')).toBe(-10);
    expect(compareThresholds('20', '10')).toBe(10);
    expect(compareThresholds('10', '10')).toBe(0);
  });
  
  it('handles nulls', () => {
    expect(compareThresholds(null, '10')).toBe(-1);
    expect(compareThresholds('10', null)).toBe(1);
    expect(compareThresholds(null, null)).toBe(0);
  });
});

describe('isAtCategoryAverage', () => {
  it('returns true for match', () => {
    expect(isAtCategoryAverage('15', 15)).toBe(true);
  });
  
  it('returns false for no match', () => {
    expect(isAtCategoryAverage('10', 15)).toBe(false);
  });
  
  it('returns true when no average', () => {
    expect(isAtCategoryAverage('10', null)).toBe(true);
  });
});

describe('findDeviatingProducts', () => {
  it('finds products not at average', () => {
    const products = [
      createMockProduct({ id: '1', threshold: 10 }),
      createMockProduct({ id: '2', threshold: 15 }),
      createMockProduct({ id: '3', threshold: 20 })
    ];
    const result = findDeviatingProducts(products, 15);
    expect(result.length).toBe(2);
  });
  
  it('returns empty when no average', () => {
    const result = findDeviatingProducts([], null);
    expect(result).toEqual([]);
  });
});

describe('getThresholdDistribution', () => {
  it('distributes correctly', () => {
    const products = [
      createMockProduct({ threshold: null }),
      createMockProduct({ threshold: 5 }),
      createMockProduct({ threshold: 15 }),
      createMockProduct({ threshold: 75 }),
      createMockProduct({ threshold: 200 }),
      createMockProduct({ threshold: 600 })
    ];
    const result = getThresholdDistribution(products);
    expect(result['no-threshold']).toBe(1);
    expect(result['0-10']).toBe(1);
    expect(result['11-50']).toBe(1);
    expect(result['51-100']).toBe(1);
    expect(result['101-500']).toBe(1);
    expect(result['500+']).toBe(1);
  });
});

describe('getLowThresholdProducts', () => {
  it('finds products below threshold', () => {
    const products = [
      createMockProduct({ id: '1', threshold: 3 }),
      createMockProduct({ id: '2', threshold: 10 }),
      createMockProduct({ id: '3', threshold: 5 })
    ];
    const result = getLowThresholdProducts(products, 5);
    expect(result.length).toBe(2);
  });
});

describe('getProductsWithoutThreshold', () => {
  it('finds products without threshold', () => {
    const products = [
      createMockProduct({ threshold: 10 }),
      createMockProduct({ threshold: null }),
      createMockProduct({ threshold: undefined })
    ];
    const result = getProductsWithoutThreshold(products);
    expect(result.length).toBe(2);
  });
});

describe('prepareThresholdExport', () => {
  it('prepares data correctly', () => {
    const products = [createMockProduct()];
    const result = prepareThresholdExport(products);
    expect(result.length).toBe(1);
    expect(result[0]['Nama Produk']).toBe('Test Product');
    expect(result[0]['Threshold']).toBe('10');
  });
});

describe('getThresholdSummary', () => {
  it('returns summary', () => {
    const products = [
      createMockProduct({ threshold: 10 }),
      createMockProduct({ threshold: 20 }),
      createMockProduct({ threshold: null })
    ];
    const result = getThresholdSummary(products);
    expect(result.total).toBe(3);
    expect(result.withThreshold).toBe(2);
    expect(result.withoutThreshold).toBe(1);
    expect(result.coverage).toBe(67);
  });
});

describe('groupProductsByCategory', () => {
  it('groups correctly', () => {
    const products = [
      createMockProduct({ id: '1', category: 'Electronics' }),
      createMockProduct({ id: '2', category: 'Electronics' }),
      createMockProduct({ id: '3', category: 'Food' })
    ];
    const result = groupProductsByCategory(products);
    expect(result['Electronics'].length).toBe(2);
    expect(result['Food'].length).toBe(1);
  });
  
  it('handles null category', () => {
    const products = [
      createMockProduct({ category: null }),
      createMockProduct({ category: 'Electronics' })
    ];
    const result = groupProductsByCategory(products);
    expect(result['Uncategorized'].length).toBe(1);
  });
});

describe('getCategoriesByCount', () => {
  it('sorts by count descending', () => {
    const categories = ['Electronics', 'Food', 'Clothing'];
    const products = [
      createMockProduct({ category: 'Electronics' }),
      createMockProduct({ category: 'Food' }),
      createMockProduct({ category: 'Electronics' }),
      createMockProduct({ category: 'Clothing' })
    ];
    const result = getCategoriesByCount(categories, products);
    expect(result[0]).toBe('Electronics');
    expect(result[1]).toBe('Food');
    expect(result[2]).toBe('Clothing');
  });
});
