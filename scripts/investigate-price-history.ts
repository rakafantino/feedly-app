/**
 * INVESTIGASI: Read-Only Script untuk Price History & Supplier Price Alignment
 *
 * WARNING: Ini adalah script READ-ONLY. Tidak ada data yang akan dimodifikasi.
 *
 * Untuk menjalankan:
 * npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/investigate-price-history.ts
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

async function main() {
  console.log("=".repeat(80));
  console.log("📊 INVESTIGASI: Price History & Supplier Price Alignment");
  console.log("=".repeat(80));
  console.log("⚠️  [READ-ONLY MODE] - Tidak ada data yang akan dimodifikasi\n");

  // ============================================================================
  // 1. STATISTIK PRICE HISTORY
  // ============================================================================
  console.log("\n" + "=".repeat(80));
  console.log("📈 SECTION 1: Statistik Price History");
  console.log("=".repeat(80));

  const totalPriceHistory = await prisma.priceHistory.count();
  console.log(`Total records di price_histories: ${totalPriceHistory}`);

  const purchaseHistoryCount = await prisma.priceHistory.count({
    where: { priceType: "PURCHASE" },
  });
  console.log(`- PURCHASE price history: ${purchaseHistoryCount}`);

  const sellingHistoryCount = await prisma.priceHistory.count({
    where: { priceType: "SELLING" },
  });
  console.log(`- SELLING price history: ${sellingHistoryCount}`);

  // Check sources
  const sources = await prisma.$queryRaw<{ source: string; count: bigint }[]>`
    SELECT source, COUNT(*) as count
    FROM price_histories
    GROUP BY source
    ORDER BY count DESC
  `;
  console.log("\nBreakdown by SOURCE:");
  for (const s of sources) {
    console.log(`  - ${s.source}: ${s.count}`);
  }

  // ============================================================================
  // 2. PRODUK DENGAN DAN TANPA PURCHASE PRICE HISTORY
  // ============================================================================
  console.log("\n" + "=".repeat(80));
  console.log("📦 SECTION 2: Produk dengan vs tanpa PURCHASE Price History");
  console.log("=".repeat(80));

  const totalProducts = await prisma.product.count({
    where: { isDeleted: false },
  });
  console.log(`Total active products: ${totalProducts}`);

  const productsWithPurchaseHistory = await prisma.priceHistory.groupBy({
    by: ["productId"],
    where: { priceType: "PURCHASE" },
    _count: { productId: true },
  });
  console.log(`Products dengan PURCHASE price history: ${productsWithPurchaseHistory.length}`);
  console.log(`Products TANPA PURCHASE price history: ${totalProducts - productsWithPurchaseHistory.length}`);

  // ============================================================================
  // 3. ANALISIS: product_suppliers vs purchase_price
  // ============================================================================
  console.log("\n" + "=".repeat(80));
  console.log("🔍 SECTION 3: Analisis Product Suppliers vs Product.purchase_price");
  console.log("=".repeat(80));

  // 3a. Total product_suppliers
  const totalProductSuppliers = await prisma.productSupplier.count();
  console.log(`Total product_suppliers records: ${totalProductSuppliers}`);

  // 3b. Products dengan multiple suppliers
  const productsWithMultipleSuppliers = await prisma.$queryRaw<{ product_id: string; supplier_count: bigint }[]>`
    SELECT product_id, COUNT(*) as supplier_count
    FROM product_suppliers
    GROUP BY product_id
    HAVING COUNT(*) > 1
    ORDER BY supplier_count DESC
    LIMIT 20
  `;
  console.log(`\nProducts dengan >1 supplier: ${productsWithMultipleSuppliers.length}`);
  if (productsWithMultipleSuppliers.length > 0) {
    console.log("Sample (top 10):");
    for (const p of productsWithMultipleSuppliers.slice(0, 10)) {
      const product = await prisma.product.findFirst({
        where: { id: p.product_id },
        select: { name: true },
      });
      console.log(`  - ${product?.name || p.product_id}: ${p.supplier_count} suppliers`);
    }
  }

  // 3c. Check misalignment: product.purchase_price vs product_suppliers
  // Find products where purchase_price doesn't match any of their supplier prices
  const misalignedProducts = await prisma.$queryRaw<{ product_id: string; purchase_price: number | null; supplier_price: number }[]>`
    SELECT
      ps.product_id,
      p.purchase_price,
      ps.price as supplier_price
    FROM product_suppliers ps
    JOIN products p ON p.id = ps.product_id
    WHERE p.purchase_price IS DISTINCT FROM ps.price
    AND ps.is_default = true
    LIMIT 20
  `;

  console.log(`\n⚠️  PRODUCTS dengan misalignment (purchase_price != default supplier price):`);
  console.log(`   Found: ${misalignedProducts.length} (showing first 20)`);

  for (const mp of misalignedProducts.slice(0, 10)) {
    const product = await prisma.product.findFirst({
      where: { id: mp.product_id },
      select: { name: true },
    });
    const supplier = await prisma.productSupplier.findFirst({
      where: { productId: mp.product_id, isDefault: true },
      include: { supplier: true },
    });

    const diff = mp.purchase_price !== null ? mp.purchase_price - mp.supplier_price : 0;
    const diffPercent = mp.supplier_price > 0 ? ((diff / mp.supplier_price) * 100).toFixed(2) : "N/A";

    console.log(`   - ${product?.name || mp.product_id}`);
    console.log(`     purchase_price: Rp ${mp.purchase_price?.toLocaleString("id-ID") || "NULL"}`);
    console.log(`     default supplier (${supplier?.supplier.name}): Rp ${mp.supplier_price.toLocaleString("id-ID")}`);
    console.log(`     diff: Rp ${diff.toLocaleString("id-ID")} (${diffPercent}%)`);
  }

  // ============================================================================
  // 4. ANALISIS: product_batches vs purchase_price
  // ============================================================================
  console.log("\n" + "=".repeat(80));
  console.log("📦 SECTION 4: Analisis Product Batches vs Product.purchase_price");
  console.log("=".repeat(80));

  const totalBatches = await prisma.productBatch.count();
  console.log(`Total batches: ${totalBatches}`);

  // Check batches with different price from product.purchase_price
  const batchesWithDifferentPrice = await prisma.$queryRaw<
    {
      product_id: string;
      purchase_price: number | null;
      batch_price: number | null;
      count: bigint;
    }[]
  >`
    SELECT
      pb.product_id,
      p.purchase_price,
      pb.purchase_price as batch_price,
      COUNT(*) as count
    FROM product_batches pb
    JOIN products p ON p.id = pb.product_id
    WHERE pb.purchase_price IS NOT NULL
    AND p.purchase_price IS DISTINCT FROM pb.purchase_price
    GROUP BY pb.product_id, p.purchase_price, pb.purchase_price
    ORDER BY count DESC
    LIMIT 20
  `;

  console.log(`\n⚠️  Batches dengan harga berbeda dari product.purchase_price:`);
  console.log(`   Found: ${batchesWithDifferentPrice.length} product dengan batch price mismatch`);

  let totalAffectedBatches = 0;
  for (const b of batchesWithDifferentPrice) {
    totalAffectedBatches += Number(b.count);
  }
  console.log(`   Total affected batch records: ${totalAffectedBatches}`);

  if (batchesWithDifferentPrice.length > 0) {
    console.log("\n   Sample (top 10):");
    for (const b of batchesWithDifferentPrice.slice(0, 10)) {
      const product = await prisma.product.findFirst({
        where: { id: b.product_id },
        select: { name: true },
      });
      console.log(`   - ${product?.name || b.product_id}:`);
      console.log(`     product.purchase_price: Rp ${b.purchase_price?.toLocaleString("id-ID") || "NULL"}`);
      console.log(`     batch.purchase_price: Rp ${b.batch_price?.toLocaleString("id-ID") || "NULL"}`);
      console.log(`     affected batches: ${b.count}`);
    }
  }

  // ============================================================================
  // 5. SAMPLE: Recent PURCHASE Price Changes
  // ============================================================================
  console.log("\n" + "=".repeat(80));
  console.log("📜 SECTION 5: Sample Recent PURCHASE Price Changes");
  console.log("=".repeat(80));

  const recentPurchaseChanges = await prisma.priceHistory.findMany({
    where: { priceType: "PURCHASE" },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: {
      product: { select: { name: true } },
    },
  });

  if (recentPurchaseChanges.length === 0) {
    console.log("   Tidak ada PURCHASE price history.");
  } else {
    console.log("   10 most recent PURCHASE price changes:");
    for (const ph of recentPurchaseChanges) {
      const date = new Date(ph.createdAt).toLocaleString("id-ID");
      console.log(`   - ${ph.product.name}`);
      console.log(`     ${ph.oldPrice.toLocaleString("id-ID")} → ${ph.newPrice.toLocaleString("id-ID")}`);
      console.log(`     ${ph.changePercentage > 0 ? "+" : ""}${ph.changePercentage}% | Source: ${ph.source}`);
      console.log(`     ${date}`);
    }
  }

  // ============================================================================
  // 6. SAMPLE: Recent SELLING Price Changes
  // ============================================================================
  console.log("\n" + "=".repeat(80));
  console.log("📜 SECTION 6: Sample Recent SELLING Price Changes");
  console.log("=".repeat(80));

  const recentSellingChanges = await prisma.priceHistory.findMany({
    where: { priceType: "SELLING" },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: {
      product: { select: { name: true } },
    },
  });

  if (recentSellingChanges.length === 0) {
    console.log("   Tidak ada SELLING price history.");
  } else {
    console.log("   10 most recent SELLING price changes:");
    for (const ph of recentSellingChanges) {
      const date = new Date(ph.createdAt).toLocaleString("id-ID");
      console.log(`   - ${ph.product.name}`);
      console.log(`     ${ph.oldPrice.toLocaleString("id-ID")} → ${ph.newPrice.toLocaleString("id-ID")}`);
      console.log(`     ${ph.changePercentage > 0 ? "+" : ""}${ph.changePercentage}% | Source: ${ph.source}`);
      console.log(`     ${date}`);
    }
  }

  // ============================================================================
  // 7. CHECK: Products with no supplier at all
  // ============================================================================
  console.log("\n" + "=".repeat(80));
  console.log("👥 SECTION 7: Products dengan/tanpa Supplier");
  console.log("=".repeat(80));

  const productsWithSupplier = await prisma.productSupplier.groupBy({
    by: ["productId"],
    _count: { productId: true },
  });

  console.log(`Products dengan supplier: ${productsWithSupplier.length}`);
  console.log(`Products tanpa supplier: ${totalProducts - productsWithSupplier.length}`);

  // Products dengan 1 supplier
  const oneSupplier = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count FROM (
      SELECT product_id
      FROM product_suppliers
      GROUP BY product_id
      HAVING COUNT(*) = 1
    ) subq
  `;
  console.log(`Products dengan tepat 1 supplier: ${oneSupplier[0]?.count || 0}`);

  // ============================================================================
  // SUMMARY
  // ============================================================================
  console.log("\n" + "=".repeat(80));
  console.log("📋 KESIMPULAN SEMENTARA");
  console.log("=".repeat(80));
  console.log(`
  Berdasarkan data yang ditemukan:

  1. PRICE HISTORY:
     - PURCHASE history: ${purchaseHistoryCount} records
     - SELLING history: ${sellingHistoryCount} records
     - Rasio: PURCHASE vs SELLING = ${purchaseHistoryCount}:${sellingHistoryCount}
     ${purchaseHistoryCount < sellingHistoryCount ? "   ⚠️  WARNING: Lebih banyak SELLING history dari PURCHASE!" : ""}

  2. PRODUCT_SUPPLIERS ALIGNMENT:
     - Total product_suppliers: ${totalProductSuppliers}
     - Misaligned (purchase_price ≠ default supplier price): ${misalignedProducts.length}
     ${misalignedProducts.length > 0 ? "   ⚠️  WARNING: Ada ketidaksesuaian antara harga produk dan harga supplier!" : ""}

  3. BATCHES ALIGNMENT:
     - Total batches: ${totalBatches}
     - Affected batches (price ≠ product.purchase_price): ${totalAffectedBatches}
     ${totalAffectedBatches > 0 ? "   ⚠️  WARNING: Ada batch dengan harga tidak sinkron!" : ""}

  4. SUPPLIER COVERAGE:
     - Products dengan supplier: ${productsWithSupplier.length}
     - Products tanpa supplier: ${totalProducts - productsWithSupplier.length}
  `);

  console.log("\n✅ Investigasi READ-ONLY selesai. Tidak ada data yang dimodifikasi.\n");
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
