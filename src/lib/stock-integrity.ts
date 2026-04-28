import { Prisma, PrismaClient } from "@prisma/client";

const STOCK_EPSILON = 0.0001;

type DbClient = Prisma.TransactionClient | PrismaClient;

export interface ProductStockIntegritySnapshot {
  productId: string;
  productName: string;
  productStock: number;
  activeBatchStock: number;
  totalBatchStock: number;
  batchCount: number;
  activeBatchCount: number;
  gap: number;
}

export function hasStockBatchMismatch(snapshot: ProductStockIntegritySnapshot, epsilon: number = STOCK_EPSILON): boolean {
  return Math.abs(snapshot.gap) > epsilon;
}

export function formatStockMismatchMessage(snapshot: ProductStockIntegritySnapshot): string {
  return `Stock mismatch detected for ${snapshot.productName}. Product stock is ${snapshot.productStock}, but active batches total ${snapshot.activeBatchStock}. Please sync or repair stock batches before proceeding.`;
}

export async function getProductStockIntegrity(db: DbClient, productId: string): Promise<ProductStockIntegritySnapshot | null> {
  const [product, batches] = await Promise.all([
    db.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        stock: true,
      },
    }),
    db.productBatch.findMany({
      where: { productId },
      select: {
        stock: true,
      },
    }),
  ]);

  if (!product) {
    return null;
  }

  const totalBatchStock = batches.reduce((sum, batch) => sum + batch.stock, 0);
  const activeBatches = batches.filter((batch) => batch.stock > 0);
  const activeBatchStock = activeBatches.reduce((sum, batch) => sum + batch.stock, 0);

  return {
    productId: product.id,
    productName: product.name,
    productStock: product.stock,
    activeBatchStock,
    totalBatchStock,
    batchCount: batches.length,
    activeBatchCount: activeBatches.length,
    gap: product.stock - activeBatchStock,
  };
}

export async function assertProductStockIntegrity(db: DbClient, productId: string): Promise<ProductStockIntegritySnapshot> {
  const snapshot = await getProductStockIntegrity(db, productId);

  if (!snapshot) {
    throw new Error(`Product ${productId} not found`);
  }

  if (hasStockBatchMismatch(snapshot)) {
    throw new Error(formatStockMismatchMessage(snapshot));
  }

  return snapshot;
}
