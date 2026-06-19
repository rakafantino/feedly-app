import {
  formatQuantity,
  sanitizeQuantity,
  sanitizeAdjustmentQuantity,
  sanitizeStockResult,
} from '../utils';

describe('sanitizeQuantity', () => {
  it('formats whole numbers identically', () => {
    expect(sanitizeQuantity(5)).toBe(5);
    expect(sanitizeQuantity(1000)).toBe(1000);
  });

  it('keeps 3 decimal places', () => {
    expect(sanitizeQuantity(2.555)).toBe(2.555);
  });

  it('handles micro-dust auto zeroing', () => {
    // If stock is less than 0.001 (1 gram), snap it to 0
    expect(sanitizeQuantity(0.0008)).toBe(0);
    expect(sanitizeQuantity(0.00000002)).toBe(0);
    expect(sanitizeQuantity(-0.0009)).toBe(0);
  });

  it('preserves necessary high precision for monetary correctness but removes IEEE 754 garbage', () => {
    // 0.2727272727... remains high precision for exact DB deduction
    expect(sanitizeQuantity(3000 / 11000)).toBe(0.272727);
    
    // IEEE 754 garbage should be cleaned 
    expect(sanitizeQuantity(4.673000000000002)).toBe(4.673);
  });

  it('handles null, undefined, or NaN safely', () => {
    expect(sanitizeQuantity(null as any)).toBe(0);
    expect(sanitizeQuantity(undefined as any)).toBe(0);
    expect(sanitizeQuantity(NaN)).toBe(0);
    expect(sanitizeQuantity(Number('invalid'))).toBe(0);
  });
});

describe('formatQuantity', () => {
  it('formats whole numbers', () => {
    expect(formatQuantity(5)).toBe('5');
    expect(formatQuantity(1000)).toBe('1.000');
  });

  it('formats decimals correctly up to 3 places', () => {
    expect(formatQuantity(2.5)).toBe('2,5');
    expect(formatQuantity(2.55)).toBe('2,55');
    expect(formatQuantity(2.555)).toBe('2,555');
  });

  it('fixes floating point issues', () => {
    expect(formatQuantity(0.000099999999999354969)).toBe('0');
    expect(formatQuantity(4.673083999999992)).toBe('4,673');
  });

  it('handles null or undefined safely', () => {
    expect(formatQuantity(null as any)).toBe('0');
    expect(formatQuantity(undefined as any)).toBe('0');
  });
});

describe('sanitizeAdjustmentQuantity', () => {
  it('rounds to max 3 decimal places', () => {
    expect(sanitizeAdjustmentQuantity(2.5555)).toBe(2.556);
  });

  it('auto-zeros values below threshold', () => {
    expect(sanitizeAdjustmentQuantity(0.0004)).toBe(0);
    expect(sanitizeAdjustmentQuantity(-0.0009)).toBe(0);
  });

  it('preserves whole numbers', () => {
    expect(sanitizeAdjustmentQuantity(5)).toBe(5);
  });

  it('handles null, undefined, or NaN safely', () => {
    expect(sanitizeAdjustmentQuantity(null as any)).toBe(0);
    expect(sanitizeAdjustmentQuantity(undefined as any)).toBe(0);
    expect(sanitizeAdjustmentQuantity(NaN)).toBe(0);
  });
});

describe('sanitizeStockResult', () => {
  it('auto-zeros tiny IEEE 754 residue from subtraction', () => {
    expect(sanitizeStockResult(13.000429 - 13)).toBe(0);
  });

  it('cleans IEEE 754 garbage but keeps the real value', () => {
    expect(sanitizeStockResult(4.673000000000002)).toBe(4.673);
  });

  it('preserves up to 6 decimals for POS precision', () => {
    expect(sanitizeStockResult(0.272727)).toBe(0.272727);
  });

  it('handles null, undefined, or NaN safely', () => {
    expect(sanitizeStockResult(null as any)).toBe(0);
    expect(sanitizeStockResult(undefined as any)).toBe(0);
    expect(sanitizeStockResult(NaN)).toBe(0);
  });
});
