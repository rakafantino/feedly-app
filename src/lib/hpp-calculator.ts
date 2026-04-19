
export interface CostItem {
  id: string;
  name: string;
  amount: number;
}

export interface HppData {
  costs: CostItem[];
  safetyMargin?: number;
  retailMargin?: number;
}

/**
 * Calculates the "Clean HPP" (Harga Pokok Penjualan Bersih).
 * Formula: Purchase Price + Direct Costs (from hppDetails).
 * Safety Margin is EXCLUDED (treated as profit).
 */
export function calculateCleanHpp(purchasePrice: number | null, hppDetails: any): number {
  if (!purchasePrice) return 0;

  let totalDirectCosts = 0;

  if (hppDetails && typeof hppDetails === 'object') {
    // Check if it has 'costs' array
    if (Array.isArray(hppDetails.costs)) {
      totalDirectCosts = hppDetails.costs.reduce((sum: number, item: any) => {
        const amount = parseFloat(item.amount);
        return sum + (isNaN(amount) ? 0 : amount);
      }, 0);
    } 
    // Handle lagacy format if any (though 'costs' is the standard)
  }

  return purchasePrice + totalDirectCosts;
}

/**
 * Calculates the "Min Selling Price" (Harga Jual Minimum / Anti Boncos).
 * Formula: Clean HPP + (Clean HPP * Safety Margin / 100).
 * Then rounded up to the nearest 50.
 */
export function calculateMinSellingPrice(purchasePrice: number | null, hppDetails: any): number | null {
  if (!purchasePrice) return null;

  const realHpp = calculateCleanHpp(purchasePrice, hppDetails);
  
  let safetyMarginPercent = 5; // Default safety margin if not specified

  if (hppDetails && typeof hppDetails === 'object') {
    if (hppDetails.safetyMargin !== undefined) {
      safetyMarginPercent = parseFloat(hppDetails.safetyMargin);
    }
  }

  const itemsSafetyProfit = realHpp * (safetyMarginPercent / 100);
  const rawMinPrice = realHpp + itemsSafetyProfit;
  
  // Round up to nearest 50 (MIN_PRICE_ROUNDING from PriceCalculator)
  const MIN_PRICE_ROUNDING = 50;
  return Math.ceil(rawMinPrice / MIN_PRICE_ROUNDING) * MIN_PRICE_ROUNDING;
}
