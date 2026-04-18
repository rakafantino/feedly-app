import { calculatePriceChange } from './price-history';

describe('calculatePriceChange', () => {
  it('calculates change when oldPrice is undefined', () => {
    const result = calculatePriceChange(undefined, 100);
    expect(result).toEqual({ changeAmount: 100, changePercentage: 100 });
  });

  it('calculates change when oldPrice is null', () => {
    const result = calculatePriceChange(null, 100);
    expect(result).toEqual({ changeAmount: 100, changePercentage: 100 });
  });

  it('calculates 0 change when new and old prices are the same', () => {
    const result = calculatePriceChange(100, 100);
    expect(result).toEqual({ changeAmount: 0, changePercentage: 0 });
  });

  it('calculates 0 change when new and old prices are both 0', () => {
    const result = calculatePriceChange(0, 0);
    expect(result).toEqual({ changeAmount: 0, changePercentage: 0 });
  });

  it('calculates negative change correctly', () => {
    const result = calculatePriceChange(100, 80);
    expect(result).toEqual({ changeAmount: -20, changePercentage: -20 });
  });

  it('calculates positive change correctly', () => {
    const result = calculatePriceChange(100, 150);
    expect(result).toEqual({ changeAmount: 50, changePercentage: 50 });
  });

  it('calculates percentage correctly with decimals', () => {
    const result = calculatePriceChange(30, 40);
    // (10 / 30) * 100 = 33.3333... rounded to 2 decimal places is 33.33
    expect(result).toEqual({ changeAmount: 10, changePercentage: 33.33 });
  });
});
