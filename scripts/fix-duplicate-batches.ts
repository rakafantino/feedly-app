import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  console.log("Starting batch fix...");

  // 1. Ambil semua produk
  const products = await prisma.product.findMany({
    include: {
      batches: {
        where: { stock: { gt: 0 } },
        orderBy: { expiryDate: "asc" },
      },
    },
  });

  console.log(`Found ${products.length} products to check.`);

  for (const product of products) {
    const totalBatchStock = product.batches.reduce((sum, b) => sum + b.stock, 0);

    // Cek 1: Apakah ada batch dengan nomor duplikat?
    const batchNumberMap = new Map<string, typeof product.batches>();

    for (const batch of product.batches) {
      const batchNum = batch.batchNumber || "UNKNOWN";
      if (!batchNumberMap.has(batchNum)) {
        batchNumberMap.set(batchNum, []);
      }
      batchNumberMap.get(batchNum)?.push(batch);
    }

    let hasDuplicates = false;
    for (const [batchNum, batches] of batchNumberMap.entries()) {
      if (batches.length > 1) {
        hasDuplicates = true;
        console.log(`Product ${product.name} has duplicate batches for ${batchNum}: ${batches.length} entries`);

        // Merge strategy: Keep the first one, add stock from others to it, delete others
        const [keep, ...remove] = batches;
        let totalMergedStock = keep.stock;

        for (const r of remove) {
          totalMergedStock += r.stock;
        }

        // Update the 'keep' batch
        await prisma.productBatch.update({
          where: { id: keep.id },
          data: { stock: totalMergedStock },
        });

        // Delete the 'remove' batches
        for (const r of remove) {
          await prisma.productBatch.delete({ where: { id: r.id } });
        }

        console.log(`Merged ${batches.length} batches into one with stock ${totalMergedStock}`);
      }
    }

    // Refresh batches after merge if needed
    let currentBatches = product.batches;
    if (hasDuplicates) {
      // Re-fetch to get updated state
      const updatedProduct = await prisma.product.findUnique({
        where: { id: product.id },
        include: { batches: { where: { stock: { gt: 0 } }, orderBy: { expiryDate: "asc" } } },
      });
      currentBatches = updatedProduct?.batches || [];
    }

    // Cek 2: Sinkronisasi Total Stok Global vs Total Stok Batch
    const currentTotalBatchStock = currentBatches.reduce((sum, b) => sum + b.stock, 0);

    if (product.stock !== currentTotalBatchStock) {
      console.log(`Product ${product.name}: Mismatch! Global (${product.stock}) vs Batches (${currentTotalBatchStock})`);

      const diff = currentTotalBatchStock - product.stock;

      if (diff > 0) {
        // Batches have MORE stock than global. We need to reduce batch stock.
        // Strategy: Reduce from latest expiry (LIFO for reduction to keep old stock? Or FEFO? Usually we want to keep data consistent)
        // Let's just reduce from the batch with highest stock or last one to be safe.
        // Simple strategy: Reduce from the last batch in the list (assuming sorted by expiry asc, so last is latest expiry)

        let remainingToReduce = diff;
        // Reverse to reduce from latest batches first
        const batchesToReduce = [...currentBatches].reverse();

        for (const batch of batchesToReduce) {
          if (remainingToReduce <= 0) break;

          const reduceAmount = Math.min(batch.stock, remainingToReduce);
          const newStock = batch.stock - reduceAmount;

          if (newStock <= 0) {
            // Delete batch if empty
            await prisma.productBatch.delete({ where: { id: batch.id } });
            console.log(`Deleted batch ${batch.batchNumber} (was ${batch.stock})`);
          } else {
            // Update batch
            await prisma.productBatch.update({
              where: { id: batch.id },
              data: { stock: newStock },
            });
            console.log(`Reduced batch ${batch.batchNumber} by ${reduceAmount} -> ${newStock}`);
          }

          remainingToReduce -= reduceAmount;
        }
      } else {
        // Batches have LESS stock than global.
        // Strategy: Add a correction batch or update existing
        console.log(`Batches missing ${Math.abs(diff)} stock. Creating correction batch.`);

        await prisma.productBatch.create({
          data: {
            productId: product.id,
            stock: Math.abs(diff),
            batchNumber: "CORRECTION-SYNC",
            inDate: new Date(),
          },
        });
      }
    }
  }

  console.log("Fix completed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
