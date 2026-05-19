// src/lib/recommendation-filter.ts
//
// Pure helper used by GET /api/dashboard/price-recommendations to exclude
// products that the user has already dismissed at the product's current
// purchase price. No I/O — safe to unit-test and property-test in isolation.

/**
 * Sentinel value used to represent a `null` purchase price uniformly on both
 * sides of the equality check (the database also stores -1 in
 * `dismissed_at_purchase_price` for products whose `purchase_price` was null
 * at the time of dismissal).
 */
const NULL_PURCHASE_PRICE_SENTINEL = -1;

/**
 * Return the effective purchase price used for dismissal comparison, mapping
 * `null` to the `-1` sentinel.
 */
function effectivePurchasePrice(
  product: { purchase_price: number | null }
): number {
  return product.purchase_price ?? NULL_PURCHASE_PRICE_SENTINEL;
}

/**
 * Filter out products whose current effective purchase price matches any
 * recorded dismissal for that product.
 *
 * A product is INCLUDED in the output if and only if there is NO dismissal
 * record `d` such that:
 *   - `d.productId === product.id`, AND
 *   - `d.dismissedAtPurchasePrice === effectivePurchasePrice(product)`
 *
 * `null` `purchase_price` values are treated as the sentinel `-1` on both
 * sides so the comparison is uniform.
 *
 * Pure function — no I/O, no module-level state. Stable input order is
 * preserved in the output.
 *
 * Note: the GET endpoint typically reduces dismissals to one row per
 * product (the most recent) before calling this function, but the filter
 * is also correct when multiple dismissal rows per product are passed —
 * a product is excluded if ANY dismissal record matches.
 */
export function filterDismissed<
  P extends { id: string; purchase_price: number | null }
>(
  products: P[],
  dismissals: { productId: string; dismissedAtPurchasePrice: number }[]
): P[] {
  if (dismissals.length === 0) {
    return products.slice();
  }

  // Build a lookup keyed on `${productId}|${dismissedAtPurchasePrice}` so
  // the per-product check is O(1) instead of O(D).
  const dismissedKeys = new Set<string>();
  for (const d of dismissals) {
    dismissedKeys.add(`${d.productId}|${d.dismissedAtPurchasePrice}`);
  }

  return products.filter((product) => {
    const key = `${product.id}|${effectivePurchasePrice(product)}`;
    return !dismissedKeys.has(key);
  });
}
