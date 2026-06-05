import { extractNumericPrice, calculateWeightedAverage } from '../receive-goods.core';

// Mock the imported weighted-average to avoid testing external module logic here
jest.mock('@/lib/weighted-average', () => ({
  calculateWeightedAveragePurchasePrice: jest.fn((params) => {
    const { existingStock, existingPrice, newStock, newPrice } = params;
    if (existingStock <= 0 || !existingPrice) return newPrice;
    if (newStock <= 0) return existingPrice;
    return ((existingStock * existingPrice) + (newStock * newPrice)) / (existingStock + newStock);
  })
}));

describe('receive-goods.core', () => {
  describe('extractNumericPrice', () => {
    it('returns number as is', () => {
      expect(extractNumericPrice(15000)).toBe(15000);
    });
    
    it('parses string to number', () => {
      expect(extractNumericPrice("12500")).toBe(12500);
      expect(extractNumericPrice("12500.5")).toBe(12500.5);
    });
  });

  describe('calculateWeightedAverage', () => {
    it('returns new price when existing stock is 0', () => {
      const result = calculateWeightedAverage({
        existingStock: 0,
        existingPrice: 5000,
        newStock: 10,
        newPrice: 10000
      });
      expect(result).toBe(10000);
    });

    it('returns existing price when new stock is 0', () => {
      const result = calculateWeightedAverage({
        existingStock: 10,
        existingPrice: 5000,
        newStock: 0,
        newPrice: 10000
      });
      expect(result).toBe(5000);
    });

    it('calculates weighted average correctly', () => {
      // 10 items @ 5000 = 50000
      // 10 items @ 10000 = 100000
      // Total = 150000 / 20 = 7500
      const result = calculateWeightedAverage({
        existingStock: 10,
        existingPrice: 5000,
        newStock: 10,
        newPrice: 10000
      });
      expect(result).toBe(7500);
    });
  });
});
