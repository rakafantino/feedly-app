/**
 * TDD Tests for purchase-suggestions recommendation-core.ts
 * Edge cases first, then error cases, then normal cases
 */

import {
  // Sales data processing
  parseSalesData,
  calculateSalesAnalysis,
  calculateDaysToEmpty,
  
  // Recommendation logic
  calculateRecommendedOrder,
  generateRecommendations,
  
  // Order validation & calculation
  validateOrder,
  calculateTotalCost,
  
  // UI helpers
  getProductStatus,
  checkSelectAll,
  toggleProductSelection,
  updateOrderQuantity,
  formatForExport
} from '../recommendation-core';
import { Product } from '@/types/product';

// Mock product type for tests
const mockProduct = (overrides: Partial<Product> = {}): Product => ({
  id: 'p1',
  name: 'Test Product',
  price: 10000,
  stock: 50,
  threshold: 10,
  unit: 'pcs',
  category: 'Test',
  storeId: 'store-1',
  isDeleted: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides
});

describe('parseSalesData', () => {
  // Edge cases
  describe('edge cases', () => {
    it('returns empty object for empty transactions', () => {
      const result = parseSalesData([]);
      expect(result).toEqual({});
    });
    
    it('returns empty object for transactions with no items', () => {
      const result = parseSalesData([{ items: [] }]);
      expect(result).toEqual({});
    });
    
    it('handles transaction with undefined items', () => {
      const result = parseSalesData([{ items: undefined as any }]);
      expect(result).toEqual({});
    });
  });
  
  // Normal cases
  describe('normal cases', () => {
    it('groups sales correctly by product', () => {
      const transactions = [
        { items: [{ productId: 'p1', quantity: 5 }, { productId: 'p2', quantity: 3 }] },
        { items: [{ productId: 'p1', quantity: 2 }] }
      ];
      
      const result = parseSalesData(transactions);
      
      expect(result['p1']).toEqual([5, 2]);
      expect(result['p2']).toEqual([3]);
    });
    
    it('accumulates multiple quantities for same product', () => {
      const transactions = [
        { items: [{ productId: 'p1', quantity: 10 }] },
        { items: [{ productId: 'p1', quantity: 15 }] },
        { items: [{ productId: 'p1', quantity: 20 }] }
      ];
      
      const result = parseSalesData(transactions);
      
      expect(result['p1']).toEqual([10, 15, 20]);
    });
  });
});

describe('calculateSalesAnalysis', () => {
  // Edge cases
  describe('edge cases', () => {
    it('returns empty results for empty sales data', () => {
      const result = calculateSalesAnalysis({});
      expect(result.averageDailySales).toEqual({});
      expect(result.salesTrend).toEqual({});
    });
    
    it('handles single quantity entry', () => {
      const sales = { 'p1': [5] };
      const result = calculateSalesAnalysis(sales, 30);
      expect(result.averageDailySales['p1']).toBeCloseTo(0.167);
      expect(result.salesTrend['p1']).toBe('stable');
    });
  });
  
  // Normal cases
  describe('normal cases', () => {
    it('calculates average daily sales correctly', () => {
      const sales = { 'p1': [30] }; // 30 units in 30 days
      const result = calculateSalesAnalysis(sales, 30);
      expect(result.averageDailySales['p1']).toBe(1);
    });
    
    it('detects upward trend', () => {
      const sales = { 'p1': [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20] };
      const result = calculateSalesAnalysis(sales, 30);
      expect(result.salesTrend['p1']).toBe('up');
    });
    
    it('detects downward trend', () => {
      const sales = { 'p1': [20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1] };
      const result = calculateSalesAnalysis(sales, 30);
      expect(result.salesTrend['p1']).toBe('down');
    });
  });
});

describe('calculateDaysToEmpty', () => {
  // Edge cases
  describe('edge cases', () => {
    it('returns 999 when no sales', () => {
      expect(calculateDaysToEmpty(50, 0)).toBe(999);
    });
    
    it('returns 999 for negative sales', () => {
      expect(calculateDaysToEmpty(50, -5)).toBe(999);
    });
    
    it('handles zero stock', () => {
      expect(calculateDaysToEmpty(0, 10)).toBe(0);
    });
  });
  
  // Normal cases
  describe('normal cases', () => {
    it('calculates correctly', () => {
      expect(calculateDaysToEmpty(100, 10)).toBe(10);
    });
    
    it('rounds down', () => {
      expect(calculateDaysToEmpty(95, 10)).toBe(9);
    });
  });
});

describe('calculateRecommendedOrder', () => {
  // Edge cases
  describe('edge cases', () => {
    it('returns 0 when stock is sufficient', () => {
      const result = calculateRecommendedOrder({
        currentStock: 100,
        threshold: 10,
        averageDailySales: 1,
        trend: 'stable'
      });
      expect(result).toBe(0);
    });
    
    it('returns minimum order when very small recommendation', () => {
      const result = calculateRecommendedOrder({
        currentStock: 29,
        threshold: 10,
        averageDailySales: 1,
        trend: 'stable',
        minOrderIncrement: 3
      });
      expect(result).toBe(3); // (30 - 29) = 1, but min is 3
    });
    
    it('handles zero average sales with threshold', () => {
      const result = calculateRecommendedOrder({
        currentStock: 5,
        threshold: 10,
        averageDailySales: 0,
        trend: 'stable'
      });
      expect(result).toBe(15); // 20 - 5 = 15
    });
  });
  
  // Normal cases
  describe('normal cases', () => {
    it('uses 45 days for up trend', () => {
      // Stock 10, need ~45 units for 45 days at 1 unit/day
      const result = calculateRecommendedOrder({
        currentStock: 10,
        threshold: 10,
        averageDailySales: 1,
        trend: 'up'
      });
      expect(result).toBe(35); // 45 - 10
    });
    
    it('uses 30 days for stable trend', () => {
      const result = calculateRecommendedOrder({
        currentStock: 10,
        threshold: 10,
        averageDailySales: 1,
        trend: 'stable'
      });
      expect(result).toBe(20); // 30 - 10
    });
    
    it('uses 20 days for down trend', () => {
      const result = calculateRecommendedOrder({
        currentStock: 10,
        threshold: 10,
        averageDailySales: 1,
        trend: 'down'
      });
      expect(result).toBe(10); // 20 - 10
    });
  });
});

describe('generateRecommendations', () => {
  // Edge cases
  describe('edge cases', () => {
    it('returns empty object for empty products', () => {
      const result = generateRecommendations({
        products: [],
        averageDailySales: {},
        salesTrend: {}
      });
      expect(result).toEqual({});
    });
  });
  
  // Normal cases
  describe('normal cases', () => {
    it('generates recommendations for low stock products', () => {
      const products = [mockProduct({ id: 'p1', stock: 5, threshold: 10 })];
      const result = generateRecommendations({
        products,
        averageDailySales: { 'p1': 1 },
        salesTrend: { 'p1': 'stable' }
      });
      
      expect(result['p1']).toBeDefined();
      expect(result['p1'].recommendedOrder).toBeGreaterThan(0);
    });
  });
});

describe('calculateTotalCost', () => {
  // Edge cases
  describe('edge cases', () => {
    it('returns 0 for empty selection', () => {
      const result = calculateTotalCost({
        selectedProductIds: [],
        products: [mockProduct()],
        orderQuantities: {}
      });
      expect(result).toBe(0);
    });
    
    it('returns 0 for zero quantities', () => {
      const result = calculateTotalCost({
        selectedProductIds: ['p1'],
        products: [mockProduct({ id: 'p1', price: 10000 })],
        orderQuantities: { 'p1': 0 }
      });
      expect(result).toBe(0);
    });
  });
  
  // Normal cases
  describe('normal cases', () => {
    it('calculates correctly', () => {
      const result = calculateTotalCost({
        selectedProductIds: ['p1', 'p2'],
        products: [
          mockProduct({ id: 'p1', price: 10000 }),
          mockProduct({ id: 'p2', price: 20000 })
        ],
        orderQuantities: { 'p1': 2, 'p2': 3 }
      });
      expect(result).toBe(80000); // (2*10000) + (3*20000)
    });
  });
});

describe('validateOrder', () => {
  // Edge cases
  describe('edge cases', () => {
    it('returns error for empty selection', () => {
      const result = validateOrder({
        selectedProductIds: [],
        products: [mockProduct()],
        orderQuantities: {}
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('minimal satu produk');
    });
    
    it('returns error when no supplier selected', () => {
      const result = validateOrder({
        selectedProductIds: ['p1'],
        products: [mockProduct()],
        orderQuantities: { 'p1': 10 },
        supplierId: undefined
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('supplier');
    });
  });
  
  // Normal cases
  describe('normal cases', () => {
    it('returns valid when all conditions met', () => {
      const result = validateOrder({
        selectedProductIds: ['p1'],
        products: [mockProduct()],
        orderQuantities: { 'p1': 10 },
        supplierId: 'sup-1'
      });
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });
});

describe('getProductStatus', () => {
  // Edge cases
  describe('edge cases', () => {
    it('handles zero days', () => {
      const result = getProductStatus({ daysToEmpty: 0 });
      expect(result.status).toBe('critical');
    });
  });
  
  // Normal cases
  describe('normal cases', () => {
    it('returns critical for <= 7 days', () => {
      const result = getProductStatus({ daysToEmpty: 7 });
      expect(result.status).toBe('critical');
    });
    
    it('returns warning for 8-14 days', () => {
      const result = getProductStatus({ daysToEmpty: 14 });
      expect(result.status).toBe('warning');
    });
    
    it('returns normal for > 14 days', () => {
      const result = getProductStatus({ daysToEmpty: 15 });
      expect(result.status).toBe('normal');
    });
  });
});

describe('toggleProductSelection', () => {
  // Edge cases
  describe('edge cases', () => {
    it('adds product when not in selection', () => {
      const result = toggleProductSelection([], 'p1');
      expect(result).toEqual(['p1']);
    });
    
    it('removes product when already selected', () => {
      const result = toggleProductSelection(['p1', 'p2'], 'p1');
      expect(result).toEqual(['p2']);
    });
  });
});

describe('updateOrderQuantity', () => {
  // Edge cases
  describe('edge cases', () => {
    it('removes product when quantity is 0', () => {
      const result = updateOrderQuantity({ 'p1': 10, 'p2': 5 }, 'p1', 0);
      expect(result).toEqual({ 'p2': 5 });
    });
    
    it('removes product when quantity is negative', () => {
      const result = updateOrderQuantity({ 'p1': 10, 'p2': 5 }, 'p1', -5);
      expect(result).toEqual({ 'p2': 5 });
    });
  });
  
  // Normal cases
  describe('normal cases', () => {
    it('adds new product', () => {
      const result = updateOrderQuantity({}, 'p1', 10);
      expect(result).toEqual({ 'p1': 10 });
    });
    
    it('updates existing product', () => {
      const result = updateOrderQuantity({ 'p1': 5 }, 'p1', 10);
      expect(result).toEqual({ 'p1': 10 });
    });
  });
});

describe('checkSelectAll', () => {
  // Edge cases
  describe('edge cases', () => {
    it('returns false for empty product list', () => {
      expect(checkSelectAll(['p1'], [])).toBe(false);
    });
    
    it('returns false when no products selected', () => {
      expect(checkSelectAll([], ['p1', 'p2'])).toBe(false);
    });
  });
  
  // Normal cases
  describe('normal cases', () => {
    it('returns true when all selected', () => {
      expect(checkSelectAll(['p1', 'p2'], ['p1', 'p2'])).toBe(true);
    });
    
    it('returns false when some not selected', () => {
      expect(checkSelectAll(['p1'], ['p1', 'p2'])).toBe(false);
    });
  });
});

describe('formatForExport', () => {
  // Edge cases
  describe('edge cases', () => {
    it('returns header only when no quantities', () => {
      const result = formatForExport({
        products: [mockProduct({ id: 'p1' })],
        orderQuantities: {},
        includeHeaders: true
      });
      expect(result).toContain('Product');
      expect(result.split('\n').length).toBe(1); // Only header
    });
  });
  
  // Normal cases
  describe('normal cases', () => {
    it('formats correctly with tab separation', () => {
      const result = formatForExport({
        products: [mockProduct({ id: 'p1', name: 'Product A', price: 10000 })],
        orderQuantities: { 'p1': 5 },
        includeHeaders: true
      });
      
      expect(result).toContain('Product A');
      expect(result).toContain('10000');
      expect(result).toContain('5');
      expect(result).toContain('50000');
    });
  });
});
