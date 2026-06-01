/**
 * Interface for weighted average function parameters
 */
export interface WeightedAverageParams {
  existingStock: number;
  existingPrice: number | null;
  newStock: number;
  newPrice: number;
}

/**
 * Calculates weighted average purchase price
 * Formula: (existingStock * existingPrice + newStock * newPrice) / (existingStock + newStock)
 *
 * @param params - Parameters containing stock and price
 * @returns Weighted average price rounded to nearest integer
 */
export function calculateWeightedAveragePurchasePrice(params: WeightedAverageParams): number {
  const { existingStock, existingPrice, newStock, newPrice } = params;

  const totalStock = existingStock + newStock;

  // If total stock is 0, return new price
  if (totalStock === 0) {
    return newPrice;
  }

  // Handle null/undefined existingPrice
  // If existingStock > 0 but existingPrice is null, it's a data inconsistency
  // Use newPrice as fallback in this case
  let effectiveExistingPrice: number;
  if (existingStock > 0 && existingPrice === null) {
    effectiveExistingPrice = newPrice;
  } else {
    effectiveExistingPrice = existingPrice ?? 0;
  }

  const weightedAverage = (existingStock * effectiveExistingPrice + newStock * newPrice) / totalStock;

  // Round to nearest integer for currency
  return Math.round(weightedAverage);
}
