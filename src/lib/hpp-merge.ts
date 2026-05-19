/**
 * Pure helper for merging a recalculated `retailMargin` into the
 * `hppCalculationDetails` JSON blob stored on `Product`.
 *
 * Used by the dynamic-price-recommendation custom-price flow, which must
 * back-calculate `retailMargin` from a user-supplied Selling_Price WITHOUT
 * touching `costs`, `safetyMargin`, or any other fields previously stored
 * in the JSON column.
 *
 * No I/O except a defensive `console.warn` when the caller hands in a
 * malformed value (array, string, number, etc.).
 *
 * @see Requirements 3.2, 3.3, 3.6 (dynamic-price-recommendation)
 */

/**
 * Round a number to at most two decimal places.
 *
 * Implemented via `Math.round(x * 100) / 100` — adequate for the value
 * range used here (margin percentages between 0 and ~10_000).
 */
export function roundTo2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Type guard for a plain object value (excludes `null` and arrays).
 *
 * Conservative: any non-null, non-array value of typeof `'object'` is
 * accepted. JSON-derived values from Prisma always satisfy this.
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

/**
 * Merge a freshly computed `retailMargin` into an existing
 * `hppCalculationDetails` JSON value, preserving every other key verbatim.
 *
 * Behaviour:
 * - `existingDetails` is `null` or `undefined` →
 *     returns exactly `{ retailMargin: roundTo2(newRetailMargin) }`.
 * - `existingDetails` is a plain object →
 *     returns a shallow copy with `retailMargin` overwritten by the
 *     rounded value. All other keys are preserved verbatim.
 * - `existingDetails` is anything else (array, string, number, boolean,
 *   etc.) → logs a `console.warn` and treats it as `null`.
 *
 * The returned object is always a fresh object — the input is never
 * mutated.
 *
 * @param existingDetails Current `hppCalculationDetails` value (may be
 *   `null`/`undefined` per Requirement 3.6, or any JSON value pulled from
 *   the DB).
 * @param newRetailMargin Newly back-calculated retail margin percentage.
 * @returns Merged JSON object with `retailMargin` rounded to 2 decimals.
 */
export function mergeRetailMargin(
  existingDetails: unknown,
  newRetailMargin: number,
): { retailMargin: number; [k: string]: unknown } {
  const rounded = roundTo2(newRetailMargin);

  if (existingDetails === null || existingDetails === undefined) {
    return { retailMargin: rounded };
  }

  if (isPlainObject(existingDetails)) {
    return {
      ...existingDetails,
      retailMargin: rounded,
    };
  }

  // Defensive branch: callers should only ever pass `null` or a plain
  // object, but JSON columns can in theory hold anything.
  console.warn(
    "[mergeRetailMargin] existingDetails is not a plain object; treating as null",
    {
      receivedType: Array.isArray(existingDetails)
        ? "array"
        : typeof existingDetails,
    },
  );
  return { retailMargin: rounded };
}
