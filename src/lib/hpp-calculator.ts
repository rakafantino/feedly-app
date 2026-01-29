
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
