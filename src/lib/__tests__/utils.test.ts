import { formatQuantity, sanitizeQuantity } from '../utils';

describe('sanitizeQuantity', () => {
  it('formats whole numbers identically', () => {
    expect(sanitizeQuantity(5)).toBe(5);
    expect(sanitizeQuantity(1000)).toBe(1000);
  });

  it('keeps 3 decimal places', () => {
    expect(sanitizeQuantity(2.555)).toBe(2.555);
  });

  it('fixes floating point issues by rounding', () => {
    expect(sanitizeQuantity(0.000099999999999354969)).toBe(0);
    expect(sanitizeQuantity(4.673083999999992)).toBe(4.673);
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
