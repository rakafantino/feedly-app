import "dotenv/config";
import prisma from "../src/lib/db";

interface MisalignedProduct {
  id: string;
  product_id: string;
  supplier_id: string;
  supplier_price: number;
  purchase_price: number;
  product_name: string;
  store_id: string;
}

function calculatePercentage(oldPrice: number, newPrice: number): number {
  if (oldPrice === 0) return 0;
  return ((newPrice - oldPrice) / oldPrice) * 100;
}

async function main() {
  console.log("Starting ProductSupplier price synchronization patch...");
  console.log("=".repeat(80));

  const misaligned = await prisma.$queryRaw<MisalignedProduct[]>`
    SELECT 
      ps.id,
      ps.product_id,
      ps.supplier_id,
      ps.price as supplier_price,
      p.purchase_price,
      p.name as product_name,
      p.store_id
    FROM product_suppliers ps
    JOIN products p ON p.id = ps.product_id
    WHERE ps.is_default = true
    AND p.purchase_price IS DISTINCT FROM ps.price
  `;

  console.log(`Found ${misaligned.length} misaligned product suppliers`);

  if (misaligned.length === 0) {
    console.log("No misaligned products found. Nothing to patch.");
    return;
  }

  let successCount = 0;
  let errorCount = 0;
  const errors: Array<{ product: string; error: string }> = [];

  for (const record of misaligned) {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.productSupplier.update({
          where: { id: record.id },
          data: { price: record.purchase_price },
        });

        await tx.priceHistory.create({
          data: {
            productId: record.product_id,
            storeId: record.store_id,
            priceType: "PURCHASE",
            oldPrice: record.supplier_price,
            newPrice: record.purchase_price,
            changeAmount: record.purchase_price - record.supplier_price,
            changePercentage: calculatePercentage(record.supplier_price, record.purchase_price),
            source: "SUPPLIER_PRICE_PATCH",
          },
        });
      });

      successCount++;
      console.log(`✓ Fixed: ${record.product_name}`);
      console.log(`  ${record.supplier_price} → ${record.purchase_price}`);
    } catch (e) {
      errorCount++;
      const errorMsg = e instanceof Error ? e.message : String(e);
      errors.push({ product: record.product_name, error: errorMsg });
      console.error(`✗ Failed: ${record.product_name}`);
      console.error(`  Error: ${errorMsg}`);
    }
  }

  console.log("=".repeat(80));
  console.log("PATCH SUMMARY");
  console.log("=".repeat(80));
  console.log(`Total misaligned products: ${misaligned.length}`);
  console.log(`Successfully patched: ${successCount}`);
  console.log(`Failed: ${errorCount}`);

  if (errors.length > 0) {
    console.log("\nERRORS:");
    errors.forEach(({ product, error }) => {
      console.log(`- ${product}: ${error}`);
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
  });
