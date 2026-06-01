/**
 * BACKFILL: Script untuk mengisi PURCHASE price history dari batch yang ada
 *
 * READ-WRITE Script: Script ini akan membuat data price_history baru.
 *
 * Untuk menjalankan:
 * npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/backfill-purchase-price-history.ts
 */

import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("❌ DATABASE_URL not found in environment!");
  process.exit(1);
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

interface ProductWithBatches {
  id: string;
  name: string;
  storeId: string;
  purchase_price: number | null;
  batches: Array<{
    id: string;
    purchasePrice: number | null;
    inDate: Date;
  }>;
}

interface BatchWithProduct {
  id: string;
  productId: string;
  purchasePrice: number | null;
  inDate: Date;
  product: {
    id: string;
    name: string;
    storeId: string;
    purchase_price: number | null;
  };
}

async function main() {
  console.log("=".repeat(80));
  console.log("📦 BACKFILL: Purchase Price History dari Batches");
  console.log("=".repeat(80));
  console.log("⚠️  [READ-WRITE MODE] - Script ini akan membuat data price_history baru.\n");

  const summary = {
    productsProcessed: 0,
    historyCreated: 0,
    skipped: 0,
    errors: 0,
  };

  try {
    console.log("\n📋 SECTION 1: Mencari produk dengan batch...\n");

    const productsWithBatches = (await prisma.product.findMany({
      where: {
        isDeleted: false,
        batches: {
          some: {
            purchasePrice: { not: null },
          },
        },
      },
      include: {
        batches: {
          where: {
            purchasePrice: { not: null },
          },
          orderBy: {
            inDate: "asc",
          },
        },
      },
    })) as ProductWithBatches[];

    console.log(`   Ditemukan ${productsWithBatches.length} produk dengan batch.`);

    if (productsWithBatches.length === 0) {
      console.log("\n   Tidak ada produk yang perlu diproses.");
    } else {
      console.log("\n📋 SECTION 2: Memproses produk...\n");

      for (const product of productsWithBatches) {
        summary.productsProcessed++;

        try {
          const existingPurchaseHistory = await prisma.priceHistory.findFirst({
            where: {
              productId: product.id,
              priceType: "PURCHASE",
            },
          });

          if (existingPurchaseHistory) {
            console.log(`   ⏭️  Skip: ${product.name} (sudah punya PURCHASE history)`);
            summary.skipped++;
            continue;
          }

          if (!product.purchase_price) {
            console.log(`   ⏭️  Skip: ${product.name} (purchase_price = NULL)`);
            summary.skipped++;
            continue;
          }

          // Batches are already ordered by inDate ascending, so first batch is the earliest
          const earliestBatch = product.batches[0] || null;

          const referenceId = earliestBatch?.id || product.id;
          const batchInDate = earliestBatch?.inDate || new Date();

          await prisma.priceHistory.create({
            data: {
              productId: product.id,
              storeId: product.storeId,
              priceType: "PURCHASE",
              oldPrice: 0,
              newPrice: product.purchase_price,
              changeAmount: product.purchase_price,
              changePercentage: 100,
              source: "BATCH_BACKFILL",
              referenceId: referenceId,
              createdAt: batchInDate,
            },
          });

          console.log(`   ✅ Created: ${product.name}`);
          console.log(`      - Price: ${product.purchase_price}`);
          console.log(`      - Reference batch: ${earliestBatch?.id || "N/A"}`);
          console.log(`      - In date: ${new Date(batchInDate).toLocaleString("id-ID")}`);

          summary.historyCreated++;
        } catch (error) {
          console.error(`   ❌ Error processing ${product.name}:`, error);
          summary.errors++;
        }
      }
    }

    console.log("\n📋 SECTION 3: Memproses batch individual tanpa produk history...\n");

    const batchesWithoutProductHistory = (await prisma.productBatch.findMany({
      where: {
        purchasePrice: { not: null },
        product: {
          isDeleted: false,
          purchase_price: { not: null },
        },
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            storeId: true,
            purchase_price: true,
          },
        },
      },
      orderBy: {
        inDate: "asc",
      },
    })) as BatchWithProduct[];

    console.log(`   Ditemukan ${batchesWithoutProductHistory.length} batch.`);

    const processedProductIds = new Set<string>();

    for (const batch of batchesWithoutProductHistory) {
      try {
        if (processedProductIds.has(batch.productId)) {
          continue;
        }

        const existingHistory = await prisma.priceHistory.findFirst({
          where: {
            productId: batch.productId,
            priceType: "PURCHASE",
            source: "BATCH_BACKFILL",
          },
        });

        if (existingHistory) {
          continue;
        }

        const productHistory = await prisma.priceHistory.findFirst({
          where: {
            productId: batch.productId,
            priceType: "PURCHASE",
          },
        });

        if (productHistory) {
          processedProductIds.add(batch.productId);
          continue;
        }

        if (!batch.product.purchase_price) {
          continue;
        }

        await prisma.priceHistory.create({
          data: {
            productId: batch.productId,
            storeId: batch.product.storeId,
            priceType: "PURCHASE",
            oldPrice: 0,
            newPrice: batch.product.purchase_price,
            changeAmount: batch.product.purchase_price,
            changePercentage: 100,
            source: "BATCH_BACKFILL",
            referenceId: batch.id,
            createdAt: batch.inDate,
          },
        });

        console.log(`   ✅ Created from batch: ${batch.product.name}`);
        console.log(`      - Batch ID: ${batch.id}`);
        console.log(`      - Price: ${batch.product.purchase_price}`);
        console.log(`      - In date: ${new Date(batch.inDate).toLocaleString("id-ID")}`);

        processedProductIds.add(batch.productId);
        summary.historyCreated++;
      } catch (error) {
        console.error(`   ❌ Error processing batch ${batch.id}:`, error);
        summary.errors++;
      }
    }

    console.log("\n" + "=".repeat(80));
    console.log("📊 RINGKASAN");
    console.log("=".repeat(80));
    console.log(`   Produk diproses:      ${summary.productsProcessed}`);
    console.log(`   History dibuat:       ${summary.historyCreated}`);
    console.log(`   dilewati:           ${summary.skipped}`);
    console.log(`   Error:               ${summary.errors}`);
    console.log("=".repeat(80));

    if (summary.historyCreated > 0) {
      console.log("\n✅ Backfill selesai. Data price_history telah dibuat.");
    } else if (summary.skipped > 0) {
      console.log("\nℹ️  Backfill selesai. Semua produk sudah memiliki history atau tidak memenuhi kriteria.");
    } else {
      console.log("\nℹ️  Backfill selesai. Tidak ada data yang perlu dibuat.");
    }
  } catch (error) {
    console.error("\n❌ Fatal error:", error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error("❌ Fatal error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
