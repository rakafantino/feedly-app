import { calculateWeightedAveragePurchasePrice } from '../../lib/weighted-average';

export interface ReceiveItemInput {
  id: string; // PO item ID
  productId: string;
  price: number | string;
  quantity: number;
  receivedQuantity: number;
  batches?: Array<{
    quantity: number;
    expiryDate?: string | Date;
    batchNumber?: string;
  }>;
}

export interface ExistingProduct {
  id: string;
  purchase_price: number | null;
  hppCalculationDetails: any; // Using any or specific type based on your app
  conversionTargetId?: string | null;
  conversionRate?: number;
}

export interface WeightedAverageInput {
  existingStock: number;
  existingPrice: number | null;
  newStock: number;
  newPrice: number;
}

export function extractNumericPrice(price: string | number): number {
  return typeof price === "string" ? parseFloat(price) : price;
}

// Re-export shared core logic
export const calculateWeightedAverage = calculateWeightedAveragePurchasePrice;
