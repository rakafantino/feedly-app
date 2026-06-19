import prisma from "@/lib/prisma";
import { StockMutationService } from "@/services/stock-mutation.service";

export interface AddBatchParams {
  productId: string;
  stock: number;
  expiryDate?: Date | null;
  batchNumber?: string | null;
  purchasePrice?: number | null;
}

export class BatchService {
  /**
   * Add stock to a new batch.
   * Updates the global product stock and recalculates MAP prices.
   * Stock mutation is delegated to StockMutationService.createBatch.
   */
  static async addBatch(data: AddBatchParams, tx?: any): Promise<any> {
    if (!tx) {
      return await prisma.$transaction(async (newTx) => this.addBatch(data, newTx));
    }

    // 1. Fetch current product info to calculate MAP (Moving Average Price)
    const product = await tx.product.findUnique({
      where: { id: data.productId },
      select: { stock: true, purchase_price: true, hpp_price: true },
    });

    if (!product) {
      throw new Error(`Product ${data.productId} not found`);
    }

    // 2. Create batch and update product stock via centralized mutation service
    const { batch } = await StockMutationService.createBatch(
      data.productId,
      data.stock,
      {
        expiryDate: data.expiryDate,
        batchNumber: data.batchNumber,
        purchasePrice: data.purchasePrice,
      },
      tx,
    );

    // 3. Calculate Moving Average Price (MAP)
    const currentStock = product.stock > 0 ? product.stock : 0;
    const currentPurchasePrice = product.purchase_price || 0;
    const incomingStock = data.stock;
    const incomingPurchasePrice = data.purchasePrice || currentPurchasePrice;

    let newPurchasePrice = currentPurchasePrice;
    let newHppPrice = product.hpp_price || 0;

    const totalStock = currentStock + incomingStock;
    if (totalStock > 0 && incomingStock > 0) {
      const currentTotalValue = currentStock * currentPurchasePrice;
      const incomingTotalValue = incomingStock * incomingPurchasePrice;
      newPurchasePrice = (currentTotalValue + incomingTotalValue) / totalStock;

      if (currentStock === 0) {
        newHppPrice = newPurchasePrice;
      } else {
        const additionalCostPerItem = currentStock > 0 && product.hpp_price ? Math.max(0, product.hpp_price - currentPurchasePrice) : 0;
        newHppPrice = newPurchasePrice + additionalCostPerItem;
      }
    } else if (currentStock === 0 && incomingStock > 0) {
      newPurchasePrice = incomingPurchasePrice;
      newHppPrice = incomingPurchasePrice;
    }

    // 4. Update Product prices (stock was already updated by createBatch)
    await tx.product.update({
      where: { id: data.productId },
      data: {
        purchase_price: newPurchasePrice,
        hpp_price: newHppPrice,
      },
    });

    return batch;
  }
  /**
   * Helper to add a generic batch (e.g. for simple stock-in or migration).
   */
  static async addGenericBatch(productId: string, stock: number, tx?: any) {
    return this.addBatch(
      {
        productId,
        stock,
        batchNumber: `GENERIC-${Date.now()}`,
      },
      tx,
    );
  }

  /**
   * Deduct stock using FIFO (First In First Out) strategy.
   * If there are multiple batches, it deducts from the oldest received first.
   */
  static async deductStock(
    productId: string, 
    quantity: number, 
    tx?: any, 
    preloadedStock?: number
  ): Promise<any[]> {
    if (!tx) {
      return await prisma.$transaction(async (newTx) => this.deductStock(productId, quantity, newTx, preloadedStock));
    }

    return StockMutationService.deduct(productId, quantity, tx, { preloadedStock });
  }
}
