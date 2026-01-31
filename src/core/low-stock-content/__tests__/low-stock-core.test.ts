/**
 * TDD Tests for low-stock-core.ts
 * Edge cases first, then normal cases
 */

import {
  // Tab management
  getTabLabel,
  isValidTab,
  getDefaultTab,
  
  // Time filter helpers
  getDaysFromFilter,
  getFilterByValue,
  createDateRangeFromFilter,
  
  // Calculations
  calculateTotalValue,
  calculateStockHealth,
  calculateReorderUrgency,
  calculateCategoryDistribution,
  sortCategoriesByValue,
  calculateDaysUntilExpiry,
  getExpiryStatus,
  
  // Data transformation
  transformToChartData,
  formatCompactNumber,
  formatPercentage,
  formatDateForDisplay,
  calculateSummary,
  
  // Validation
  isValidThreshold,
  isValidAdjustment,
  isValidReason,
  validateStockAdjustment,
  
  // Initialization
  createDefaultThresholdConfig,
  createDefaultStockAdjustment,
  createEmptyAnalytics,
  
  // Export helpers
  prepareExportData,
  
  // Static data
  getStatusColor,
  getStatusBgColor,
  getPriorityLevel,
  
  // Types
  CategoryStat,
  
  // Constants
  TIME_FILTERS,
  TAB_OPTIONS
} from '../low-stock-core';

describe('TIME_FILTERS', () => {
  it('has correct structure', () => {
    expect(TIME_FILTERS.length).toBe(3);
    expect(TIME_FILTERS[0].value).toBe('day');
    expect(TIME_FILTERS[1].value).toBe('week');
    expect(TIME_FILTERS[2].value).toBe('month');
  });
});

describe('TAB_OPTIONS', () => {
  it('has correct tabs', () => {
    expect(TAB_OPTIONS.length).toBe(4);
    expect(TAB_OPTIONS[0].id).toBe('overview');
    expect(TAB_OPTIONS[1].id).toBe('products');
  });
});

describe('getTabLabel', () => {
  it('returns label for valid tab', () => {
    expect(getTabLabel('overview')).toBe('Ringkasan');
    expect(getTabLabel('products')).toBe('Produk');
  });
  
  it('returns id for unknown tab', () => {
    expect(getTabLabel('unknown')).toBe('unknown');
  });
});

describe('isValidTab', () => {
  it('returns true for valid tabs', () => {
    expect(isValidTab('overview')).toBe(true);
    expect(isValidTab('products')).toBe(true);
  });
  
  it('returns false for invalid tabs', () => {
    expect(isValidTab('invalid')).toBe(false);
  });
});

describe('getDefaultTab', () => {
  it('returns overview', () => {
    expect(getDefaultTab()).toBe('overview');
  });
});

describe('getDaysFromFilter', () => {
  it('returns correct days', () => {
    expect(getDaysFromFilter(TIME_FILTERS[0])).toBe(1);
    expect(getDaysFromFilter(TIME_FILTERS[1])).toBe(7);
    expect(getDaysFromFilter(TIME_FILTERS[2])).toBe(30);
  });
});

describe('getFilterByValue', () => {
  it('returns correct filter', () => {
    expect(getFilterByValue('day').label).toBe('Hari Ini');
    expect(getFilterByValue('week').label).toBe('Minggu Ini');
    expect(getFilterByValue('month').label).toBe('Bulan Ini');
  });
});

describe('createDateRangeFromFilter', () => {
  it('creates valid date range', () => {
    const filter = TIME_FILTERS[1]; // week
    const { startDate, endDate } = createDateRangeFromFilter(filter);
    
    expect(startDate).toBeInstanceOf(Date);
    expect(endDate).toBeInstanceOf(Date);
    expect(startDate <= endDate).toBe(true);
  });
});

describe('calculateTotalValue', () => {
  it('returns 0 for empty array', () => {
    expect(calculateTotalValue([])).toBe(0);
  });
  
  it('calculates correctly', () => {
    const products = [
      { price: 10000, stock: 10 },
      { price: 20000, stock: 5 }
    ];
    expect(calculateTotalValue(products)).toBe(200000);
  });
});

describe('calculateStockHealth', () => {
  it('returns 100 for no products', () => {
    expect(calculateStockHealth({
      totalProducts: 0,
      lowStock: 0,
      outOfStock: 0
    })).toBe(100);
  });
  
  it('calculates correctly', () => {
    // 100 products, 10 low, 5 out = 85% healthy
    expect(calculateStockHealth({
      totalProducts: 100,
      lowStock: 10,
      outOfStock: 5
    })).toBe(85);
  });
});

describe('calculateReorderUrgency', () => {
  it('returns 0 for no sales', () => {
    expect(calculateReorderUrgency({
      currentStock: 50,
      threshold: 10,
      avgDailySales: 0
    })).toBe(0);
  });
  
  it('returns 100 when below threshold', () => {
    expect(calculateReorderUrgency({
      currentStock: 5,
      threshold: 10,
      avgDailySales: 2
    })).toBe(100);
  });
  
  it('returns correct value when close to threshold', () => {
    // With stock=25, threshold=10, avgDailySales=2:
    // daysUntilEmpty = 25/2 = 12.5
    // 12.5 <= 10? No
    // 12.5 <= 15 (threshold*1.5)? Yes -> returns 75
    expect(calculateReorderUrgency({
      currentStock: 25,
      threshold: 10,
      avgDailySales: 2
    })).toBe(75);
  });
});

describe('calculateCategoryDistribution', () => {
  it('handles empty array', () => {
    expect(calculateCategoryDistribution([])).toEqual([]);
  });
  
  it('groups by category', () => {
    const products = [
      { category: 'Elektronik', stock: 10, price: 10000 },
      { category: 'Elektronik', stock: 5, price: 20000 },
      { category: 'Pakaian', stock: 20, price: 5000 }
    ];
    const result = calculateCategoryDistribution(products);
    
    expect(result.length).toBe(2);
    const elektronik = result.find(c => c.name === 'Elektronik');
    expect(elektronik).toBeDefined();
    expect(elektronik?.count).toBe(2);
    expect(elektronik?.value).toBe(200000); // (10*10000) + (5*20000)
  });
  
  it('handles null category', () => {
    const products = [
      { category: null, stock: 10, price: 10000 }
    ];
    const result = calculateCategoryDistribution(products);
    expect(result[0].name).toBe('Uncategorized');
  });
});

describe('sortCategoriesByValue', () => {
  it('sorts descending by value', () => {
    const categories: CategoryStat[] = [
      { name: 'A', count: 5, value: 100 },
      { name: 'B', count: 10, value: 500 },
      { name: 'C', count: 3, value: 200 }
    ];
    const result = sortCategoriesByValue(categories);
    expect(result[0].name).toBe('B');
    expect(result[1].name).toBe('C');
    expect(result[2].name).toBe('A');
  });
});

describe('calculateDaysUntilExpiry', () => {
  it('returns null for null date', () => {
    expect(calculateDaysUntilExpiry(null)).toBeNull();
    expect(calculateDaysUntilExpiry(undefined)).toBeNull();
  });
  
  it('calculates days correctly', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    expect(calculateDaysUntilExpiry(futureDate.toISOString())).toBe(7);
  });
});

describe('getExpiryStatus', () => {
  it('returns safe for null', () => {
    expect(getExpiryStatus(null)).toBe('safe');
  });
  
  it('returns expired for past dates', () => {
    const days = calculateDaysUntilExpiry('2025-01-01');
    expect(days).toBeDefined();
    if (days !== null) {
      expect(getExpiryStatus(days)).toBe('expired');
    }
  });
  
  it('returns critical for less than 7 days', () => {
    const soonDate = new Date();
    soonDate.setDate(soonDate.getDate() + 3);
    const days = calculateDaysUntilExpiry(soonDate.toISOString());
    expect(days).toBeDefined();
    if (days !== null) {
      expect(getExpiryStatus(days)).toBe('critical');
    }
  });
  
  it('returns warning for less than 30 days', () => {
    const soonDate = new Date();
    soonDate.setDate(soonDate.getDate() + 15);
    const days = calculateDaysUntilExpiry(soonDate.toISOString());
    expect(days).toBeDefined();
    if (days !== null) {
      expect(getExpiryStatus(days)).toBe('warning');
    }
  });
  
  it('returns safe for more than 30 days', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 60);
    const days = calculateDaysUntilExpiry(futureDate.toISOString());
    expect(days).toBeDefined();
    if (days !== null) {
      expect(getExpiryStatus(days)).toBe('safe');
    }
  });
});

describe('transformToChartData', () => {
  it('transforms correctly', () => {
    const categories: CategoryStat[] = [
      { name: 'A', count: 5, value: 100 },
      { name: 'B', count: 10, value: 200 }
    ];
    const result = transformToChartData(categories);
    expect(result.length).toBe(2);
    expect(result[0].color).toBe('#ef4444');
    expect(result[1].color).toBe('#f97316');
  });
});

describe('formatCompactNumber', () => {
  it('formats large numbers', () => {
    expect(formatCompactNumber(1500000)).toBe('1.5M');
    expect(formatCompactNumber(50000)).toBe('50.0K');
    expect(formatCompactNumber(500)).toBe('500');
  });
});

describe('formatPercentage', () => {
  it('formats correctly', () => {
    expect(formatPercentage(85.5)).toBe('86%');
    expect(formatPercentage(100)).toBe('100%');
  });
});

describe('formatDateForDisplay', () => {
  it('formats correctly', () => {
    const result = formatDateForDisplay('2025-01-15T10:00:00Z');
    expect(result).toContain('15');
    expect(result).toContain('Jan');
  });
});

describe('calculateSummary', () => {
  it('calculates correctly', () => {
    const analytics = {
      lowStockCount: 10,
      expiringCount: 5,
      pendingOrdersCount: 3,
      totalProducts: 100,
      categoryStats: [
        { name: 'A', count: 50, value: 500000 }
      ]
    };
    const result = calculateSummary(analytics);
    expect(result.lowStockCount).toBe(10);
    expect(result.totalValue).toBe(500000);
  });
});

describe('isValidThreshold', () => {
  it('returns true for valid values', () => {
    expect(isValidThreshold(0)).toBe(true);
    expect(isValidThreshold(10)).toBe(true);
    expect(isValidThreshold(100)).toBe(true);
  });
  
  it('returns false for negative', () => {
    expect(isValidThreshold(-1)).toBe(false);
  });
  
  it('returns false for decimal', () => {
    expect(isValidThreshold(10.5)).toBe(false);
  });
});

describe('isValidAdjustment', () => {
  it('returns false for zero', () => {
    expect(isValidAdjustment(0)).toBe(false);
  });
  
  it('returns true for non-zero', () => {
    expect(isValidAdjustment(10)).toBe(true);
    expect(isValidAdjustment(-5)).toBe(true);
  });
});

describe('isValidReason', () => {
  it('returns false for too short', () => {
    expect(isValidReason('ab')).toBe(false);
    expect(isValidReason('')).toBe(false);
  });
  
  it('returns true for valid reason', () => {
    expect(isValidReason('Stock adjustment')).toBe(true);
  });
});

describe('validateStockAdjustment', () => {
  it('returns error for missing product ID', () => {
    const result = validateStockAdjustment({
      productId: '',
      adjustment: 10,
      reason: 'Test reason'
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Product ID');
  });
  
  it('returns error for zero adjustment', () => {
    const result = validateStockAdjustment({
      productId: 'prod-1',
      adjustment: 0,
      reason: 'Test reason'
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('zero');
  });
  
  it('returns error for short reason', () => {
    const result = validateStockAdjustment({
      productId: 'prod-1',
      adjustment: 10,
      reason: 'ab'
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('3 characters');
  });
  
  it('returns valid for correct input', () => {
    const result = validateStockAdjustment({
      productId: 'prod-1',
      adjustment: 10,
      reason: 'Valid reason'
    });
    expect(result.valid).toBe(true);
  });
});

describe('createDefaultThresholdConfig', () => {
  it('creates default config', () => {
    const result = createDefaultThresholdConfig();
    expect(result.productId).toBe('');
    expect(result.threshold).toBe(10);
  });
});

describe('createDefaultStockAdjustment', () => {
  it('creates default adjustment', () => {
    const result = createDefaultStockAdjustment();
    expect(result.productId).toBe('');
    expect(result.adjustment).toBe(0);
    expect(result.reason).toBe('');
  });
});

describe('createEmptyAnalytics', () => {
  it('creates empty analytics', () => {
    const result = createEmptyAnalytics();
    expect(result.lowStockCount).toBe(0);
    expect(result.totalProducts).toBe(0);
    expect(result.totalValue).toBe(0);
  });
});

describe('prepareExportData', () => {
  it('prepares data correctly', () => {
    const result = prepareExportData({
      products: [{ name: 'A', stock: 10, threshold: 5, price: 10000 }],
      analytics: createEmptyAnalytics()
    });
    expect(result.length).toBeGreaterThan(1);
    expect(result[0]['Nama Produk']).toBe('A');
  });
});

describe('getStatusColor', () => {
  it('returns correct colors', () => {
    expect(getStatusColor('low')).toBe('text-yellow-500');
    expect(getStatusColor('out')).toBe('text-red-500');
    expect(getStatusColor('expiring')).toBe('text-orange-500');
    expect(getStatusColor('ok')).toBe('text-green-500');
  });
});

describe('getStatusBgColor', () => {
  it('returns correct background colors', () => {
    expect(getStatusBgColor('low')).toContain('yellow');
    expect(getStatusBgColor('out')).toContain('red');
  });
});

describe('getPriorityLevel', () => {
  it('returns critical for low stock and days', () => {
    expect(getPriorityLevel({
      daysUntilEmpty: 2,
      productValue: 100000
    })).toBe('critical');
  });
  
  it('returns high for less than 7 days', () => {
    expect(getPriorityLevel({
      daysUntilEmpty: 5,
      productValue: 100000
    })).toBe('high');
  });
  
  it('returns medium for less than 14 days', () => {
    expect(getPriorityLevel({
      daysUntilEmpty: 10,
      productValue: 100000
    })).toBe('medium');
  });
  
  it('returns low otherwise', () => {
    expect(getPriorityLevel({
      daysUntilEmpty: 30,
      productValue: 100000
    })).toBe('low');
  });
});
