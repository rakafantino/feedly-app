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

    // 1. Fetch current product info to calculate MAP (Moving Average Price)
    const product = await tx.product.findUnique({
      where: { id: data.productId },
      select: { stock: true, purchase_price: true, hpp_price: true },
    });

    if (!product) {
      throw new Error(`Product ${data.productId} not found`);
    }

    // 2. Create Batch
    const batch = await tx.productBatch.create({
      data: {
        productId: data.productId,
        stock: data.stock,
        expiryDate: data.expiryDate,
        batchNumber: data.batchNumber,
        purchasePrice: data.purchasePrice,
      },
    });

    // 3. Calculate Moving Average Price (MAP)
    const currentStock = product.stock > 0 ? product.stock : 0;
    const currentPurchasePrice = product.purchase_price || 0;
    const incomingStock = data.stock;
    const incomingPurchasePrice = data.purchasePrice || currentPurchasePrice;

    let newPurchasePrice = currentPurchasePrice;
    let newHppPrice = product.hpp_price || 0;

    const totalStock = currentStock + incomingStock;
    if (totalStock > 0 && incomingStock > 0) {
      // Perhitungan rata-rata modal murni (purchase_price)
      const currentTotalValue = currentStock * currentPurchasePrice;
      const incomingTotalValue = incomingStock * incomingPurchasePrice;
      newPurchasePrice = (currentTotalValue + incomingTotalValue) / totalStock;

      // Jika sebelumnya hpp_price berbeda dengan purchase_price (karena ada biaya tambahan),
      // kita juga sesuaikan hpp_price secara proporsional. Namun untuk kesederhanaan,
      // kita set nilai hpp_price sama dengan newPurchasePrice jika tidak ada logic biaya eksplisit.
      // Jika memang sebelumnya ada margin biaya (selisih), kita tetap pertahankan persentase selisihnya,
      // atau ambil langsung newPurchasePrice. Untuk amannya, kita sinkronkan hpp_price jika nilainya 0.
      if (currentStock === 0) {
          newHppPrice = newPurchasePrice;
      } else {
          // Asumsi biaya tambahan per produk (selisih HPP dan Harga Beli) tetap sama nominalnya
          const additionalCostPerItem = currentStock > 0 && product.hpp_price ? Math.max(0, product.hpp_price - currentPurchasePrice) : 0;
          newHppPrice = newPurchasePrice + additionalCostPerItem;
      }
    } else if (currentStock === 0 && incomingStock > 0) {
        newPurchasePrice = incomingPurchasePrice;
        newHppPrice = incomingPurchasePrice;
    }

    // 4. Update Product Total Stock & Prices
    await tx.product.update({
      where: { id: data.productId },
      data: {
        stock: { increment: data.stock },
        purchase_price: newPurchasePrice,
        hpp_price: newHppPrice
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

    // 2. Fetch Batches with stock > 0, ordered by In Date (FIFO)
    const batches = await tx.productBatch.findMany({
      where: {
        productId,
        stock: { gt: 0 },
      },
      orderBy: { inDate: "asc" },
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
