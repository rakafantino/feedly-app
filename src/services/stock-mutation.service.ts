import type { Prisma } from "@prisma/client";
import { sanitizeQuantity, sanitizeStockResult } from "@/lib/utils";

// ─── Types ─────────────────────────────────────────────────────────────────────

/** Shape returned by deduct() for each batch affected by the deduction. */
export interface DeductedBatchEntry {
  batchId: string;
  deducted: number;
  cost: number | null;
}

/** Optional fields accepted when creating a new batch. */
export interface CreateBatchData {
  batchNumber?: string | null;
  expiryDate?: Date | null;
  purchasePrice?: number | null;
  supplierId?: string | null;
  inDate?: Date;
}

/** Options for the deduct() method. */
export interface DeductOptions {
  /** Pre-fetched product stock to skip the internal product lookup. */
  preloadedStock?: number;
  /** When true, skip the data-integrity error after all batches are exhausted. */
  skipIntegrityCheck?: boolean;
}

/** Result of increment() — updated product and batch rows. */
export interface IncrementResult {
  product: { id: string; stock: number };
  batch: { id: string; stock: number };
}

/** Result of createBatch() — the new batch row and the updated product. */
export interface CreateBatchResult {
  product: { id: string; stock: number };
  batch: {
    id: string;
    productId: string;
    stock: number;
    batchNumber: string | null;
    expiryDate: Date | null;
    purchasePrice: number | null;
    supplierId: string | null;
    inDate: Date;
  };
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const DUST_THRESHOLD = 0.001;

// ─── Service ───────────────────────────────────────────────────────────────────

/**
 * Single entry-point for all Product.stock and ProductBatch.stock mutations.
 *
 * Every method **must** receive an active Prisma transaction client (`tx`) —
 * this service never touches the database outside of a transaction.
 *
 * All writes use explicit assignment (`data: { stock: newValue }`) so that
 * `sanitizeStockResult` is always applied before persisting.
 */
export class StockMutationService {
  // ─── 1. increment (line ~72) ──────────────────────────────────────────────

  /**
   * Add `quantity` to both the product stock and a specific batch stock.
   *
   * @throws If the product is not found.
   * @throws If the batch is not found or does not belong to the given product.
   */
  static async increment(
    productId: string,
    batchId: string,
    quantity: number,
    tx: Prisma.TransactionClient,
  ): Promise<IncrementResult> {
    const sanitizedQty = sanitizeQuantity(quantity);

    // Validate product exists
    const product = await tx.product.findUnique({
      where: { id: productId },
      select: { id: true, stock: true },
    });

    if (!product) {
      throw new Error(`Product ${productId} not found`);
    }

    // Validate batch exists and belongs to this product
    const batch = await tx.productBatch.findUnique({
      where: { id: batchId },
      select: { id: true, productId: true, stock: true },
    });

    if (!batch) {
      throw new Error(`Batch ${batchId} not found`);
    }

    if (batch.productId !== productId) {
      throw new Error(
        `Batch ${batchId} does not belong to product ${productId}`,
      );
    }

    // Explicit-set writes so sanitizeStockResult is always applied
    const newProductStock = sanitizeStockResult(product.stock + sanitizedQty);
    const newBatchStock = sanitizeStockResult(batch.stock + sanitizedQty);

    const [updatedProduct, updatedBatch] = await Promise.all([
      tx.product.update({
        where: { id: productId },
        data: { stock: newProductStock },
        select: { id: true, stock: true },
      }),
      tx.productBatch.update({
        where: { id: batchId },
        data: { stock: newBatchStock },
        select: { id: true, stock: true },
      }),
    ]);

    return { product: updatedProduct, batch: updatedBatch };
  }

  // ─── 2. createBatch (line ~133) ───────────────────────────────────────────

  /**
   * Create a new ProductBatch with the given `stock` and increment the
   * parent product stock by the same amount.
   */
  static async createBatch(
    productId: string,
    stock: number,
    batchData: CreateBatchData,
    tx: Prisma.TransactionClient,
  ): Promise<CreateBatchResult> {
    const sanitizedStock = sanitizeQuantity(stock);

    // Validate product exists
    const product = await tx.product.findUnique({
      where: { id: productId },
      select: { id: true, stock: true },
    });

    if (!product) {
      throw new Error(`Product ${productId} not found`);
    }

    // Create the batch row
    const batch = await tx.productBatch.create({
      data: {
        productId,
        stock: sanitizedStock,
        batchNumber: batchData.batchNumber ?? null,
        expiryDate: batchData.expiryDate ?? null,
        purchasePrice: batchData.purchasePrice ?? null,
        supplierId: batchData.supplierId ?? null,
        ...(batchData.inDate ? { inDate: batchData.inDate } : {}),
      },
      select: {
        id: true,
        productId: true,
        stock: true,
        batchNumber: true,
        expiryDate: true,
        purchasePrice: true,
        supplierId: true,
        inDate: true,
      },
    });

    // Increment product stock with explicit set
    const newProductStock = sanitizeStockResult(product.stock + sanitizedStock);

    const updatedProduct = await tx.product.update({
      where: { id: productId },
      data: { stock: newProductStock },
      select: { id: true, stock: true },
    });

    return { product: updatedProduct, batch };
  }

  // ─── 3. deduct (line ~195) ────────────────────────────────────────────────

  /**
   * Deduct `quantity` from product stock using FIFO strategy across batches
   * (oldest `inDate` first).
   *
   * Follows the same dust-clamp pattern as legacy BatchService.deductStock:
   * - If the difference between available and requested is <= 0.001, clamp.
   * - After looping batches, if residual > 0.001 throw integrity error.
   *
   * All writes use explicit assignment + sanitizeStockResult.
   */
  static async deduct(
    productId: string,
    quantity: number,
    tx: Prisma.TransactionClient,
    options?: DeductOptions,
  ): Promise<DeductedBatchEntry[]> {
    let sanitizedQty = sanitizeQuantity(quantity);

    // ── Stock availability check with dust-clamp ────────────────────────
    if (options?.preloadedStock !== undefined) {
      if (
        options.preloadedStock < sanitizedQty &&
        Math.abs(sanitizedQty - options.preloadedStock) > DUST_THRESHOLD
      ) {
        throw new Error(
          `Insufficient stock for product ${productId}. Required: ${sanitizedQty}, Available: ${options.preloadedStock}`,
        );
      }
      if (Math.abs(sanitizedQty - options.preloadedStock) <= DUST_THRESHOLD) {
        sanitizedQty = options.preloadedStock;
      }
    } else {
      const product = await tx.product.findUnique({
        where: { id: productId },
        select: { stock: true },
      });

      if (
        !product ||
        (product.stock < sanitizedQty &&
          Math.abs(sanitizedQty - product.stock) > DUST_THRESHOLD)
      ) {
        throw new Error(
          `Insufficient stock for product ${productId}. Required: ${sanitizedQty}, Available: ${product?.stock}`,
        );
      }
      if (product && Math.abs(sanitizedQty - product.stock) <= DUST_THRESHOLD) {
        sanitizedQty = product.stock;
      }
    }

    // ── FIFO batch deduction ────────────────────────────────────────────
    const batches = await tx.productBatch.findMany({
      where: { productId, stock: { gt: 0 } },
      orderBy: { inDate: "asc" },
    });

    let remaining = sanitizedQty;
    const entries: DeductedBatchEntry[] = [];

    for (const batch of batches) {
      if (remaining <= 0) break;

      const deduction = Math.min(batch.stock, remaining);
      const newBatchStock = sanitizeStockResult(batch.stock - deduction);

      await tx.productBatch.update({
        where: { id: batch.id },
        data: { stock: newBatchStock },
      });

      entries.push({
        batchId: batch.id,
        deducted: deduction,
        cost: batch.purchasePrice,
      });

      remaining = sanitizeQuantity(remaining - deduction);
    }

    if (remaining > DUST_THRESHOLD && !options?.skipIntegrityCheck) {
      throw new Error(
        "Data integrity error: Product stock suggests availability but batches are empty.",
      );
    }

    // ── Update product stock with explicit set ──────────────────────────
    // Clamp if quantity is close to product.stock (auto-zero)
    const product = await tx.product.findUnique({
      where: { id: productId },
      select: { stock: true },
    });

    if (!product) {
      throw new Error(`Product ${productId} not found during final update`);
    }

    let effectiveQty = sanitizedQty;
    if (Math.abs(sanitizedQty - product.stock) <= DUST_THRESHOLD) {
      effectiveQty = product.stock;
    }

    const newProductStock = sanitizeStockResult(product.stock - effectiveQty);

    await tx.product.update({
      where: { id: productId },
      data: { stock: newProductStock },
    });

    return entries;
  }

  // ─── 4. reconcileToBatches (line ~310) ────────────────────────────────────

  /**
   * Reconcile Product.stock to the sum of all its batch stocks.
   * Fetches all batches (including zero-stock), sums them, then sets
   * Product.stock = sanitizeStockResult(totalBatchStock).
   *
   * @returns The updated product row.
   */
  static async reconcileToBatches(
    productId: string,
    tx: Prisma.TransactionClient,
  ): Promise<{ id: string; stock: number }> {
    const product = await tx.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });

    if (!product) {
      throw new Error(`Product ${productId} not found`);
    }

    const batches = await tx.productBatch.findMany({
      where: { productId },
      select: { stock: true },
    });

    const totalBatchStock = batches.reduce((sum, b) => sum + b.stock, 0);
    const reconciledStock = sanitizeStockResult(totalBatchStock);

    const updatedProduct = await tx.product.update({
      where: { id: productId },
      data: { stock: reconciledStock },
      select: { id: true, stock: true },
    });

    return updatedProduct;
  }
}
