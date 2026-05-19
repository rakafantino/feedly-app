/**
 * Property-based tests for `calculateRetailMarginFromCustomPrice`.
 *
 * Validates: Requirements 3.1, 3.4, 3.5, 3.7
 */

import fc from 'fast-check';
import {
    calculateRetailMarginFromCustomPrice,
    InvalidMinSellingPriceError,
} from '../price-calculator-core';

describe('calculateRetailMarginFromCustomPrice', () => {
    // Feature: dynamic-price-recommendation, Property 3: Back-calculation correctness and rounding
    it('round-trips within rounding tolerance, stays non-negative, and is rounded to <= 2 decimal places', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 200_000 }),
                fc.integer({ min: 0, max: 19_999_980 }),
                (minSellingPrice, deltaSteps) => {
                    const customPrice = minSellingPrice + deltaSteps * 50;
                    fc.pre(customPrice <= 999_999_999);

                    const m = calculateRetailMarginFromCustomPrice(
                        customPrice,
                        minSellingPrice
                    );

                    // 1. Non-negativity (Requirement 3.7).
                    expect(m).toBeGreaterThanOrEqual(0);

                    // 2. At most 2 decimal places (Requirement 3.4).
                    //    Use a relative float tolerance because m * 100 may not
                    //    be exactly integral in IEEE-754, even when conceptually
                    //    rounded to 2 dp. For very large margins, scaled lands
                    //    in the 10^10 range where sub-ULP drift exceeds an
                    //    absolute 1e-6 threshold; scale tolerance with the
                    //    magnitude of `scaled` to remain strict for normal
                    //    margins while tolerating IEEE-754 drift at extremes.
                    const scaled = m * 100;
                    const ulp = Math.max(1e-6, Math.abs(scaled) * 1e-9);
                    expect(Math.abs(scaled - Math.round(scaled))).toBeLessThan(ulp);

                    // 3. Round-trip within tolerance (Requirement 3.1).
                    const reconstructed =
                        minSellingPrice + (minSellingPrice * m) / 100;
                    const tolerance = Math.max(0.5, 0.005 * minSellingPrice);
                    expect(Math.abs(reconstructed - customPrice)).toBeLessThanOrEqual(
                        tolerance
                    );
                }
            ),
            { numRuns: 100 }
        );
    });

    // Feature: dynamic-price-recommendation, Property 5: Back-calculation rejects invalid Min_Selling_Price
    it('throws when minSellingPrice is null, zero, negative, or non-finite', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 999_999_999 }),
                fc.oneof(
                    fc.constant(null),
                    fc.constant(0),
                    fc.integer({ min: -1_000_000, max: -1 }),
                    fc.constant(Number.NaN),
                    fc.constant(Number.POSITIVE_INFINITY),
                    fc.constant(Number.NEGATIVE_INFINITY)
                ),
                (customPrice, invalidMinSellingPrice) => {
                    expect(() =>
                        calculateRetailMarginFromCustomPrice(
                            customPrice,
                            invalidMinSellingPrice as number
                        )
                    ).toThrow(InvalidMinSellingPriceError);
                }
            ),
            { numRuns: 100 }
        );
    });
});
