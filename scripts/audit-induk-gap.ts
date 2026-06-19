/**
 * Verify Parent Products - READ ONLY
 * Run: npx tsx scripts/audit-induk-gap.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  console.log('=== GLOBAL STOCK TOTALS - READ ONLY ===\n');

  const allProducts = await prisma.product.findMany({
    where: { isDeleted: false },
    select: { id: true, name: true, stock: true, unit: true, conversionTargetId: true },
  });
  const allBatches = await prisma.productBatch.findMany({
    select: { id: true, productId: true, stock: true },
  });

  const totalProductStock = allProducts.reduce((sum, p) => sum + p.stock, 0);
  const totalBatchStock = allBatches.reduce((sum, b) => sum + b.stock, 0);

  console.log(`Total Product Stock (all products): ${totalProductStock}`);
  console.log(`Total Batch Stock (all batches): ${totalBatchStock}`);
  console.log(`Gap: ${totalProductStock - totalBatchStock}`);
  console.log();

  // Find products with negative stock
  const negativeStock = allProducts.filter(p => p.stock < 0);
  console.log(`Products with negative stock: ${negativeStock.length}`);
  negativeStock.forEach(p => console.log(`  - ${p.name}: ${p.stock} ${p.unit}`));
  console.log();

  // Find products with stock > 0 but batch total = 0
  const productsWithoutBatchStock = allProducts.filter(p => {
    const bt = allBatches.filter(b => b.productId === p.id).reduce((sum, b) => sum + b.stock, 0);
    return p.stock > 0 && bt === 0;
  });
  console.log(`Products with stock > 0 but no batch stock: ${productsWithoutBatchStock.length}`);
  productsWithoutBatchStock.forEach(p => console.log(`  - ${p.name}: ${p.stock} ${p.unit}`));
  console.log();

  // Check batches belonging to soft-deleted products
  const deletedProducts = await prisma.product.findMany({
    where: { isDeleted: true },
    select: { id: true, name: true, stock: true, unit: true },
  });
  const deletedIds = new Set(deletedProducts.map(p => p.id));
  const deletedBatches = allBatches.filter(b => deletedIds.has(b.productId));
  const deletedBatchStock = deletedBatches.reduce((sum, b) => sum + b.stock, 0);
  console.log(`Soft-deleted products: ${deletedProducts.length}`);
  console.log(`Batches belonging to deleted products (with stock): ${deletedBatches.filter(b => b.stock > 0).length}`);
  console.log(`Total stock locked in deleted-product batches: ${deletedBatchStock}`);
  deletedProducts
    .map(p => ({ p, bt: allBatches.filter(b => b.productId === p.id).reduce((s, b) => s + b.stock, 0) }))
    .filter(x => x.bt > 0)
    .forEach(x => console.log(`  - [DELETED] ${x.p.name}: product=${x.p.stock} batch=${x.bt} ${x.p.unit}`));
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
