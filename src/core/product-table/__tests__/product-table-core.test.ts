/**
 * TDD Tests for product-table-core.ts
 * Edge cases first, then normal cases
 */

import {
  // Initialization
  createInitialFilterState,
  createInitialPaginationState,
  createInitialDeleteState,
  createInitialConversionState,
  createInitialSortState,
  
  // Pagination
  calculatePagination,
  isValidPage,
  getPaginationRange,
  resetPage,
  
  // Filtering
  matchesSearch,
  matchesCategory,
  applyFilters,
  getUniqueCategories,
  getPageProducts,
  
  // Sorting
  sortProducts,
  toggleSort,
  
  // Calculations
  calculateStockValue,
  getStockStatus,
  getPaginationInfo,
  
  // Search debounce
  shouldTriggerSearch,
  getSearchDebounceDelay,
  
  // Data transformation
  formatPriceForDisplay,
  formatDateForDisplay,
  formatStockForDisplay,
  
  // Validation
  validateDelete,
  validateConversionQuantity,
  isValidSearchQuery,
  
  // Bulk operations
  isAllSelected,
  hasSelection,
  getSelectedCount,
  
  // Export helpers
  prepareForExport,
  getSummaryStats,
  
  // Types
  Product,
  FilterState,
  PaginationState
} from '../product-table-core';

// Mock product helper
const createMockProduct = (overrides: Partial<Product> = {}): Product => ({
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
  supplier: { id: 'sup-1', name: 'Test Supplier' },
  createdAt: '2025-01-15T10:00:00Z',
  updatedAt: '2025-01-15T10:00:00Z',
  isDeleted: false,
  ...overrides
});

describe('createInitialFilterState', () => {
  it('creates empty filter state', () => {
    const result = createInitialFilterState();
    expect(result.search).toBe('');
    expect(result.activeSearch).toBe('');
    expect(result.category).toBe('all');
    expect(result.page).toBe(1);
  });
});

describe('createInitialPaginationState', () => {
  it('creates default pagination', () => {
    const result = createInitialPaginationState();
    expect(result.currentPage).toBe(1);
    expect(result.pageSize).toBe(10);
    expect(result.totalPages).toBe(1);
    expect(result.totalItems).toBe(0);
  });
});

describe('createInitialDeleteState', () => {
  it('creates initial delete state', () => {
    const result = createInitialDeleteState();
    expect(result.open).toBe(false);
    expect(result.productId).toBeNull();
    expect(result.isDeleting).toBe(false);
  });
});

describe('createInitialConversionState', () => {
  it('creates initial conversion state', () => {
    const result = createInitialConversionState();
    expect(result.open).toBe(false);
    expect(result.product).toBeNull();
    expect(result.quantity).toBe('1');
    expect(result.isConverting).toBe(false);
  });
});

describe('createInitialSortState', () => {
  it('creates default sort state', () => {
    const result = createInitialSortState();
    expect(result.field).toBe('createdAt');
    expect(result.direction).toBe('desc');
  });
});

describe('calculatePagination', () => {
  it('calculates correctly', () => {
    const result = calculatePagination(25, 10);
    expect(result.currentPage).toBe(1);
    expect(result.pageSize).toBe(10);
    expect(result.totalPages).toBe(3);
    expect(result.totalItems).toBe(25);
  });
  
  it('handles exact division', () => {
    const result = calculatePagination(20, 10);
    expect(result.totalPages).toBe(2);
  });
  
  it('handles empty', () => {
    const result = calculatePagination(0, 10);
    expect(result.totalPages).toBe(0);
  });
});

describe('isValidPage', () => {
  it('validates correctly', () => {
    expect(isValidPage(1, 5)).toBe(true);
    expect(isValidPage(5, 5)).toBe(true);
    expect(isValidPage(0, 5)).toBe(false);
    expect(isValidPage(6, 5)).toBe(false);
  });
});

describe('getPaginationRange', () => {
  it('returns correct range', () => {
    const result = getPaginationRange(3, 10, 5);
    expect(result).toEqual([1, 2, 3, 4, 5]);
  });
  
  it('adjusts for edge pages', () => {
    expect(getPaginationRange(10, 10, 5)).toEqual([6, 7, 8, 9, 10]);
  });
});

describe('resetPage', () => {
  it('resets page to 1', () => {
    const state: FilterState = { search: 'test', activeSearch: 'test', category: 'all', page: 5 };
    const result = resetPage(state);
    expect(result.page).toBe(1);
    expect(result.search).toBe('test');
  });
});

describe('matchesSearch', () => {
  describe('edge cases', () => {
    it('returns true for empty query', () => {
      expect(matchesSearch(createMockProduct(), '')).toBe(true);
    });
    
    it('is case insensitive', () => {
      expect(matchesSearch(createMockProduct(), 'test')).toBe(true);
      expect(matchesSearch(createMockProduct(), 'TEST')).toBe(true);
    });
  });
  
  describe('normal cases', () => {
    it('matches name', () => {
      expect(matchesSearch(createMockProduct({ name: 'Mie Goreng' }), 'mie')).toBe(true);
    });
    
    it('matches product_code', () => {
      expect(matchesSearch(createMockProduct({ product_code: 'ABC-123' }), 'abc')).toBe(true);
    });
    
    it('matches barcode', () => {
      expect(matchesSearch(createMockProduct({ barcode: '1234567890123' }), '12345')).toBe(true);
    });
    
    it('matches category', () => {
      expect(matchesSearch(createMockProduct({ category: 'Electronics' }), 'elec')).toBe(true);
    });
  });
});

describe('matchesCategory', () => {
  it('returns true for all filter', () => {
    expect(matchesCategory(createMockProduct(), 'all')).toBe(true);
  });
  
  it('matches category correctly', () => {
    expect(matchesCategory(createMockProduct({ category: 'Electronics' }), 'Electronics')).toBe(true);
    expect(matchesCategory(createMockProduct({ category: 'Electronics' }), 'Food')).toBe(false);
  });
});

describe('applyFilters', () => {
  it('returns all when no filters', () => {
    const products = [createMockProduct(), createMockProduct()];
    const result = applyFilters(products, createInitialFilterState());
    expect(result.length).toBe(2);
  });
  
  it('filters by search', () => {
    const products = [
      createMockProduct({ name: 'Product A' }),
      createMockProduct({ name: 'Product B' })
    ];
    const filters: FilterState = { ...createInitialFilterState(), activeSearch: 'A' };
    const result = applyFilters(products, filters);
    expect(result.length).toBe(1);
    expect(result[0].name).toBe('Product A');
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

describe('getPageProducts', () => {
  it('returns correct page', () => {
    const products = Array.from({ length: 25 }, (_, i) => 
      createMockProduct({ id: `prod-${i}` })
    );
    const pagination: PaginationState = { currentPage: 2, pageSize: 10, totalPages: 3, totalItems: 25 };
    const result = getPageProducts(products, pagination);
    expect(result.length).toBe(10);
    expect(result[0].id).toBe('prod-10');
  });
});

describe('sortProducts', () => {
  it('sorts by name asc', () => {
    const products = [
      createMockProduct({ id: '1', name: 'Product B' }),
      createMockProduct({ id: '2', name: 'Product A' })
    ];
    const result = sortProducts(products, { field: 'name', direction: 'asc' });
    expect(result[0].name).toBe('Product A');
  });
  
  it('sorts by price desc', () => {
    const products = [
      createMockProduct({ id: '1', price: 10000 }),
      createMockProduct({ id: '2', price: 20000 })
    ];
    const result = sortProducts(products, { field: 'price', direction: 'desc' });
    expect(result[0].price).toBe(20000);
  });
});

describe('toggleSort', () => {
  it('toggles direction for same field', () => {
    const result = toggleSort({ field: 'name', direction: 'asc' }, 'name');
    expect(result.field).toBe('name');
    expect(result.direction).toBe('desc');
  });
  
  it('changes field with default desc', () => {
    const result = toggleSort({ field: 'name', direction: 'asc' }, 'price');
    expect(result.field).toBe('price');
    expect(result.direction).toBe('desc');
  });
});

describe('calculateStockValue', () => {
  it('calculates correctly', () => {
    expect(calculateStockValue(10000, 50)).toBe(500000);
  });
  
  it('returns 0 for zero stock', () => {
    expect(calculateStockValue(10000, 0)).toBe(0);
  });
});

describe('getStockStatus', () => {
  it('returns critical for zero stock', () => {
    expect(getStockStatus({ stock: 0, threshold: 10 })).toBe('critical');
  });
  
  it('returns warning for low stock', () => {
    expect(getStockStatus({ stock: 5, threshold: 10 })).toBe('warning');
  });
  
  it('returns normal for sufficient stock', () => {
    expect(getStockStatus({ stock: 50, threshold: 10 })).toBe('normal');
  });
  
  it('returns normal when no threshold', () => {
    expect(getStockStatus({ stock: 5, threshold: null })).toBe('normal');
  });
});

describe('getPaginationInfo', () => {
  it('calculates correctly', () => {
    const result = getPaginationInfo({ totalItems: 25, currentPage: 2, pageSize: 10 });
    expect(result.startItem).toBe(11);
    expect(result.endItem).toBe(20);
    expect(result.totalPages).toBe(3);
  });
});

describe('shouldTriggerSearch', () => {
  it('returns true when different', () => {
    expect(shouldTriggerSearch('new search', 'old search')).toBe(true);
  });
  
  it('returns false when same', () => {
    expect(shouldTriggerSearch('same', 'same')).toBe(false);
  });
});

describe('getSearchDebounceDelay', () => {
  it('returns 500ms', () => {
    expect(getSearchDebounceDelay()).toBe(500);
  });
});

describe('formatPriceForDisplay', () => {
  it('formats correctly', () => {
    const result = formatPriceForDisplay(1000000);
    expect(result).toContain('1.000.000');
  });
});

describe('formatDateForDisplay', () => {
  it('returns dash for undefined', () => {
    expect(formatDateForDisplay(undefined)).toBe('-');
  });
  
  it('formats date correctly', () => {
    const result = formatDateForDisplay('2025-01-15T10:00:00Z');
    expect(result).toContain('2025');
    expect(result).toContain('Jan');
  });
});

describe('formatStockForDisplay', () => {
  it('formats with unit', () => {
    expect(formatStockForDisplay(100, 'pcs')).toBe('100 pcs');
  });
  
  it('uses default unit', () => {
    expect(formatStockForDisplay(100, undefined)).toBe('100 pcs');
  });
});

describe('validateDelete', () => {
  it('returns true for correct confirmation', () => {
    expect(validateDelete('Test Product', 'Test Product')).toBe(true);
    expect(validateDelete('Test Product', 'test product')).toBe(true);
  });
  
  it('returns false for incorrect confirmation', () => {
    expect(validateDelete('Test Product', 'Wrong Name')).toBe(false);
  });
});

describe('validateConversionQuantity', () => {
  it('returns error for invalid quantity', () => {
    const result = validateConversionQuantity({ quantity: '0', currentStock: 50 });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('lebih dari 0');
  });
  
  it('returns error when exceeding stock', () => {
    const result = validateConversionQuantity({ quantity: '100', currentStock: 50 });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('melebihi stok');
  });
  
  it('returns valid for correct quantity', () => {
    const result = validateConversionQuantity({ quantity: '10', currentStock: 50 });
    expect(result.valid).toBe(true);
  });
});

describe('isValidSearchQuery', () => {
  it('always returns true', () => {
    expect(isValidSearchQuery('')).toBe(true);
    expect(isValidSearchQuery('test')).toBe(true);
  });
});

describe('isAllSelected', () => {
  it('returns false for empty list', () => {
    expect(isAllSelected([], new Set())).toBe(false);
  });
  
  it('returns true when all selected', () => {
    expect(isAllSelected(['1', '2'], new Set(['1', '2']))).toBe(true);
  });
  
  it('returns false when some not selected', () => {
    expect(isAllSelected(['1', '2'], new Set(['1']))).toBe(false);
  });
});

describe('hasSelection', () => {
  it('returns false for empty set', () => {
    expect(hasSelection(new Set())).toBe(false);
  });
  
  it('returns true when has items', () => {
    expect(hasSelection(new Set(['1']))).toBe(true);
  });
});

describe('getSelectedCount', () => {
  it('returns correct count', () => {
    expect(getSelectedCount(new Set(['1', '2', '3']))).toBe(3);
    expect(getSelectedCount(new Set())).toBe(0);
  });
});

describe('prepareForExport', () => {
  it('prepares data correctly', () => {
    const products = [createMockProduct()];
    const result = prepareForExport(products);
    expect(result.length).toBe(1);
    expect(result[0]['Nama']).toBe('Test Product');
    expect(result[0]['Kode']).toBe('TEST-001');
  });
});

describe('getSummaryStats', () => {
  it('calculates correctly', () => {
    const products = [
      createMockProduct({ stock: 5, threshold: 10, price: 10000 }),
      createMockProduct({ stock: 0, threshold: 10, price: 20000 }),
      createMockProduct({ stock: 50, threshold: 10, price: 15000 })
    ];
    const result = getSummaryStats(products);
    expect(result.totalProducts).toBe(3);
    // (5*10000) + (0*20000) + (50*15000) = 50000 + 0 + 750000 = 800000
    expect(result.totalValue).toBe(800000);
    expect(result.lowStockCount).toBe(1);
    expect(result.outOfStockCount).toBe(1);
    expect(result.categoryCount).toBe(1);
  });
});
