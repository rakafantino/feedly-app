// Feature: dynamic-price-recommendation, Property 1: Dismissal exclusion filter
import fc from 'fast-check';
import { filterDismissed } from './recommendation-filter';

/**
 * Sentinel value mirroring the implementation: a `null` `purchase_price`
 * compares equal to a stored `dismissedAtPurchasePrice` of `-1`.
 */
const NULL_SENTINEL = -1;

const effectivePrice = (p: { purchase_price: number | null }) =>
  p.purchase_price ?? NULL_SENTINEL;

describe('filterDismissed (Property 1)', () => {
  it('excludes products with a matching dismissal and includes everything else', () => {
    // Generate a product list, then a dismissal list whose productIds are
    // drawn from a pool that mostly overlaps with the products (so we
    // actually exercise the exclusion path) plus a sprinkle of unrelated ids.
    const productArb = fc.record({
      id: fc.string({ minLength: 1, maxLength: 8 }),
      purchase_price: fc.option(fc.integer({ min: 0, max: 1_000_000 }), {
        nil: null,
      }),
    });

    const productsArb = fc.array(productArb, { minLength: 0, maxLength: 20 });

    const inputArb = productsArb.chain((products) => {
      const idArb =
        products.length > 0
          ? fc.oneof(
              fc.constantFrom(...products.map((p) => p.id)),
              fc.string({ minLength: 1, maxLength: 8 }),
            )
          : fc.string({ minLength: 1, maxLength: 8 });

      // For dismissal prices, mix in the actual effective prices of the
      // products so we get real matches, plus arbitrary integers (and -1)
      // to exercise misses and the null-sentinel branch.
      const priceArb =
        products.length > 0
          ? fc.oneof(
              fc.constantFrom(...products.map(effectivePrice)),
              fc.integer({ min: -1, max: 1_000_000 }),
            )
          : fc.integer({ min: -1, max: 1_000_000 });

      const dismissalArb = fc.record({
        productId: idArb,
        dismissedAtPurchasePrice: priceArb,
      });

      return fc.tuple(
        fc.constant(products),
        fc.array(dismissalArb, { minLength: 0, maxLength: 20 }),
      );
    });

    fc.assert(
      fc.property(inputArb, ([products, dismissals]) => {
        const output = filterDismissed(products, dismissals);

        const hasMatchingDismissal = (p: { id: string; purchase_price: number | null }) =>
          dismissals.some(
            (d) =>
              d.productId === p.id &&
              d.dismissedAtPurchasePrice === effectivePrice(p),
          );

        // 1. Forall p in OUTPUT: there is NO matching dismissal.
        for (const p of output) {
          expect(hasMatchingDismissal(p)).toBe(false);
        }

        // 2. Forall p in INPUT but NOT in OUTPUT: there EXISTS a matching dismissal.
        const outputSet = new Set(output);
        for (const p of products) {
          if (!outputSet.has(p)) {
            expect(hasMatchingDismissal(p)).toBe(true);
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  // Targeted example tests for the `null` purchase_price ↔ `-1` sentinel
  // equivalence. These complement the property test with explicit cases that
  // pin the sentinel semantics — so a regression in either branch trips a
  // clear, isolated failure even if a property shrinker would also catch it.
  describe('null purchase_price ↔ -1 sentinel equivalence', () => {
    it('excludes a product with null purchase_price when a dismissal exists at -1', () => {
      const products = [{ id: 'p1', purchase_price: null }];
      const dismissals = [{ productId: 'p1', dismissedAtPurchasePrice: -1 }];

      expect(filterDismissed(products, dismissals)).toEqual([]);
    });

    it('includes a product with null purchase_price when the dismissal price is 0 (not -1)', () => {
      const products = [{ id: 'p1', purchase_price: null }];
      const dismissals = [{ productId: 'p1', dismissedAtPurchasePrice: 0 }];

      expect(filterDismissed(products, dismissals)).toEqual(products);
    });
  });
});
