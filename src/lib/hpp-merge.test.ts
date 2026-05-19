// Feature: dynamic-price-recommendation, Property 4: hppCalculationDetails merge preserves all non-retailMargin fields
import fc from 'fast-check';
import { mergeRetailMargin, roundTo2 } from './hpp-merge';

describe('mergeRetailMargin (Property 4)', () => {
  // Silence the defensive console.warn that fires when existingDetails is not
  // a plain object (e.g. arrays). The dictionary arbitrary never produces
  // those, but null/object branches are still covered.
  const warnSpy = jest
    .spyOn(console, 'warn')
    .mockImplementation(() => undefined);

  afterAll(() => {
    warnSpy.mockRestore();
  });

  it('preserves every non-retailMargin field and overwrites retailMargin with the rounded value', () => {
    fc.assert(
      fc.property(
        // null | Record<string, unknown>
        fc.option(fc.dictionary(fc.string(), fc.anything()), { nil: null }),
        // newRetailMargin in [0, 1000], no NaN — covers the documented input range.
        fc.float({ min: 0, max: 1000, noNaN: true }),
        (existingDetails, newRetailMargin) => {
          const result = mergeRetailMargin(existingDetails, newRetailMargin);

          // 1. retailMargin equals roundTo2(newRetailMargin).
          expect(result.retailMargin).toBe(roundTo2(newRetailMargin));

          if (existingDetails === null) {
            // 3. When existingDetails is null, result has exactly one key.
            expect(Object.keys(result)).toEqual(['retailMargin']);
            return;
          }

          // 2. For every key in existingDetails other than retailMargin,
          //    result[k] deep-equals existingDetails[k].
          for (const key of Object.keys(existingDetails)) {
            if (key === 'retailMargin') continue;
            expect(result[key]).toEqual(existingDetails[key]);
          }

          // No extra keys are introduced — result keys are a subset of
          // existingDetails keys ∪ {'retailMargin'}.
          const allowedKeys = new Set([
            ...Object.keys(existingDetails),
            'retailMargin',
          ]);
          for (const key of Object.keys(result)) {
            expect(allowedKeys.has(key)).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
