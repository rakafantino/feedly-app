import prisma from "@/lib/prisma";

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
   * Updates the global product stock as well.
   */
  static async addBatch(data: AddBatchParams, tx?: any): Promise<any> {
    if (!tx) {
      return await prisma.$transaction(async (newTx) => this.addBatch(data, newTx));
    }

    // 1. Create Batch
    const batch = await tx.productBatch.create({
      data: {
        productId: data.productId,
        stock: data.stock,
        expiryDate: data.expiryDate,
        batchNumber: data.batchNumber,
        purchasePrice: data.purchasePrice,
      },
    });

    // 2. Update Product Total Stock
    await tx.product.update({
      where: { id: data.productId },
      data: {
        stock: { increment: data.stock },
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
   * Deduct stock using FEFO (First Expired First Out) strategy.
   * detailed: true -> returns details of batches used.
   */
  static async deductStock(productId: string, quantity: number, tx?: any, preloadedStock?: number): Promise<any[]> {
    if (!tx) {
      return await prisma.$transaction(async (newTx) => this.deductStock(productId, quantity, newTx));
    }

    // 1. Check Global Stock — skip if caller already verified
    if (preloadedStock !== undefined) {
      if (preloadedStock < quantity) {
        throw new Error(`Insufficient stock for product ${productId}. Required: ${quantity}, Available: ${preloadedStock}`);
      }
    } else {
      const product = await tx.product.findUnique({
        where: { id: productId },
        select: { stock: true },
      });

      if (!product || product.stock < quantity) {
        throw new Error(`Insufficient stock for product ${productId}. Required: ${quantity}, Available: ${product?.stock}`);
      }
    }

    // 2. Fetch Batches with stock > 0, ordered by Expiry Date (ASC)
    const batches = await tx.productBatch.findMany({
      where: {
        productId,
        stock: { gt: 0 },
      },
      orderBy: { expiryDate: "asc" },
    });

    let remainingToDeduct = quantity;
    const batchesAffected = [];

    for (const batch of batches) {
      if (remainingToDeduct <= 0) break;

      const deduction = Math.min(batch.stock, remainingToDeduct);

      // Update Batch
      await tx.productBatch.update({
        where: { id: batch.id },
        data: { stock: { decrement: deduction } },
      });

      batchesAffected.push({
        batchId: batch.id,
        deducted: deduction,
        cost: batch.purchasePrice,
      });

      remainingToDeduct -= deduction;
    }

    if (remainingToDeduct > 0) {
      throw new Error("Data integrity error: Product stock suggests availability but batches are empty.");
    }

    // 3. Update Product Total Stock
    await tx.product.update({
      where: { id: productId },
      data: { stock: { decrement: quantity } },
    });

    return batchesAffected;
  }
}
