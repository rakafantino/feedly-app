import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

interface BatchToFix {
  id: string;
  product_id: string;
  stock: number;
  batch_price: number | null;
  product_price: number | null;
  product_name: string;
}

async function main() {
  console.log("Starting Batch Price Alignment Patch...");
  console.log("=".repeat(80));

  const batches = await prisma.$queryRaw<BatchToFix[]>`
    SELECT pb.id, pb.product_id, pb.stock, pb.purchase_price as batch_price,
           p.purchase_price as product_price, p.name as product_name
    FROM product_batches pb
    JOIN products p ON p.id = pb.product_id
    WHERE pb.stock > 0
    AND (
      pb.purchase_price IS NULL 
      OR pb.purchase_price != p.purchase_price
    )
  `;

  console.log(`Found ${batches.length} batches with null or mismatched purchasePrice`);

  if (batches.length === 0) {
    console.log("No batches need fixing. Nothing to patch.");
    return;
  }

  let successCount = 0;
  let errorCount = 0;
  const errors: Array<{ batchId: string; product: string; error: string }> = [];

  for (const batch of batches) {
    if (batch.product_price === null) {
      console.log(`⚠ Skipped batch ${batch.id} for ${batch.product_name}: product.purchase_price is null`);
      continue;
    }

    try {
      await prisma.productBatch.update({
        where: { id: batch.id },
        data: { purchasePrice: batch.product_price },
      });

      successCount++;
      const oldPrice = batch.batch_price === null ? "null" : batch.batch_price.toString();
      console.log(`✓ Updated batch ${batch.id} for ${batch.product_name}`);
      console.log(`  ${oldPrice} → ${batch.product_price}`);
    } catch (e) {
      errorCount++;
      const errorMsg = e instanceof Error ? e.message : String(e);
      errors.push({ batchId: batch.id, product: batch.product_name, error: errorMsg });
      console.error(`✗ Failed batch ${batch.id} for ${batch.product_name}`);
      console.error(`  Error: ${errorMsg}`);
    }
  }

  console.log("=".repeat(80));
  console.log("PATCH SUMMARY");
  console.log("=".repeat(80));
  console.log(`Total batches found: ${batches.length}`);
  console.log(`Successfully updated: ${successCount}`);
  console.log(`Failed: ${errorCount}`);

  if (errors.length > 0) {
    console.log("\nERRORS:");
    errors.forEach(({ batchId, product, error }) => {
      console.log(`- Batch ${batchId} (${product}): ${error}`);
    });
  }

  console.log("=".repeat(80));
  console.log("Patch completed!");
}

main()
  .catch((e) => {
    console.error("Fatal error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
