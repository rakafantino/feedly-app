/**
 * Property-based tests for `isValidCustomPrice`.
 *
 * Feature: dynamic-price-recommendation, Property 2: Custom-price validator soundness
 * Validates: Requirements 2.2, 2.3, 2.4, 4.1, 4.4, 4.5
 */

import fc from 'fast-check';
import {
    isValidCustomPrice,
    type CustomPriceValidationError,
} from '../price-calculator-core';

const MAX_PRICE = 999_999_999;
const ROUNDING = 50;

// Mirror of the implementation's rule precedence:
//   NOT_FINITE -> NOT_INTEGER -> NEGATIVE -> NOT_MULTIPLE_OF_50
//     -> BELOW_MIN_SELLING_PRICE -> ABOVE_MAX
function firstViolatedRule(
    value: number,
    minSellingPrice: number
): CustomPriceValidationError | undefined {
    if (!Number.isFinite(value)) return 'NOT_FINITE';
    if (!Number.isInteger(value)) return 'NOT_INTEGER';
    if (value < 0) return 'NEGATIVE';
    if (value % ROUNDING !== 0) return 'NOT_MULTIPLE_OF_50';
    if (value < minSellingPrice) return 'BELOW_MIN_SELLING_PRICE';
    if (value > MAX_PRICE) return 'ABOVE_MAX';
    return undefined;
}

describe('isValidCustomPrice', () => {
    // Feature: dynamic-price-recommendation, Property 2: Custom-price validator soundness
    it('result.valid is the conjunction of all five rules; result.error is the first violated rule', () => {
        fc.assert(
            fc.property(
                fc.float({ noNaN: false }),
                fc.integer({ min: 1, max: 10_000_000 }),
                (value, minSellingPrice) => {
                    const result = isValidCustomPrice(value, minSellingPrice);

                    const allRulesHold =
                        Number.isFinite(value) &&
                        Number.isInteger(value) &&
                        value >= 0 &&
                        value % ROUNDING === 0 &&
                        value >= minSellingPrice &&
                        value <= MAX_PRICE;

                    expect(result.valid).toBe(allRulesHold);

                    if (allRulesHold) {
                        expect(result.error).toBeUndefined();
                    } else {
                        expect(result.error).toBe(
                            firstViolatedRule(value, minSellingPrice)
                        );
                    }
                }
            ),
            { numRuns: 100 }
        );
    });
});
