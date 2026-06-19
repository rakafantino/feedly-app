/**
 * Clean Dust Stock Script
 *
 * Zeroes out "dust" stock — tiny leftover quantities below a threshold
 * (default 0.001, i.e. less than 1 gram) that can never represent real
 * physical stock (e.g. 0.000429 kg).
 *
 * SAFETY:
 * - DRY RUN by default. No DB writes unless you pass --apply.
 * - Updates Product.stock AND its ProductBatch.stock together so the
 *   product/batch integrity (gap) is preserved.
 * - Only targets products whose TOTAL stock is below the threshold, plus
 *   their dust batches. Healthy products with a stray dust batch are
 *   flagged but NOT auto-modified.
 *
 * Usage:
 *   Dry run : npx tsx scripts/clean-dust-stock.ts
 *   Apply   : npx tsx scripts/clean-dust-stock.ts --apply
 *   Custom  : npx tsx scripts/clean-dust-stock.ts --threshold=0.001
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

const APPLY = process.argv.includes('--apply');
const thresholdArg = process.argv.find((a) => a.startsWith('--threshold='));
const THRESHOLD = thresholdArg ? parseFloat(thresholdArg.split('=')[1]) : 0.001;

function fmt(val: number): string {
  if (Number.isInteger(val)) return val.toString();
  return val.toFixed(20).replace(/0+$/, '').replace(/\.$/, '');
}

interface ProductPlan {
  id: string;
  name: string;
  unit: string;
  isDeleted: boolean;
  currentStock: number;
  batches: { id: string; batchNumber: string | null; stock: number }[];
}

async function main() {
  console.log('='.repeat(80));
  console.log(`DUST STOCK CLEANUP — ${APPLY ? '🔴 APPLY (WRITE)' : '🟢 DRY RUN (READ ONLY)'}`);
  console.log('Database:', process.env.DATABASE_URL?.substring(0, 45) + '...');
  console.log('Dust threshold (abs <):', THRESHOLD);
  console.log('Timestamp:', new Date().toISOString());
  console.log('='.repeat(80));
  console.log();

  const products = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      unit: true,
      stock: true,
      isDeleted: true,
      batches: { select: { id: true, batchNumber: true, stock: true } },
    },
  });

  const productPlans: ProductPlan[] = [];
  const strayDustBatches: { product: string; batchId: string; batchNumber: string | null; stock: number; productStock: number }[] = [];

  for (const p of products) {
    const isDustProduct = Math.abs(p.stock) > 0 && Math.abs(p.stock) < THRESHOLD;

    if (isDustProduct) {
      productPlans.push({
        id: p.id,
        name: p.name,
        unit: p.unit,
        isDeleted: p.isDeleted,
        currentStock: p.stock,
        batches: p.batches.map((b) => ({ id: b.id, batchNumber: b.batchNumber, stock: b.stock })),
      });
    } else {
      // Healthy product but might carry a stray dust batch — flag, do not touch
      for (const b of p.batches) {
        if (Math.abs(b.stock) > 0 && Math.abs(b.stock) < THRESHOLD) {
          strayDustBatches.push({
            product: p.name,
            batchId: b.id,
            batchNumber: b.batchNumber,
            stock: b.stock,
            productStock: p.stock,
          });
        }
      }
    }
  }

  // Report dust products
  console.log(`Dust products found (total stock < ${THRESHOLD}): ${productPlans.length}`);
  console.log('-'.repeat(80));
  let batchUpdateCount = 0;
  for (const plan of productPlans) {
    const tag = plan.isDeleted ? '[DELETED] ' : '';
    console.log(`${tag}${plan.name}`);
    console.log(`  Product.stock : ${fmt(plan.currentStock)} ${plan.unit}  ->  0`);
    if (plan.batches.length > 0) {
      for (const b of plan.batches) {
        const willZero = Math.abs(b.stock) < THRESHOLD;
        batchUpdateCount += willZero ? 1 : 0;
        console.log(
          `    batch [${b.batchNumber || b.id.slice(0, 8)}]: ${fmt(b.stock)} ${plan.unit}` +
            (willZero ? '  ->  0' : '  (kept, above threshold ⚠️ check)'),
        );
      }
    } else {
      console.log('    (no batches)');
    }
    console.log();
  }

  // Report stray dust batches under healthy products (not auto-fixed)
  console.log('-'.repeat(80));
  console.log(`Stray dust batches under HEALTHY products (flagged, NOT modified): ${strayDustBatches.length}`);
  for (const s of strayDustBatches) {
    console.log(`  - ${s.product} | batch ${s.batchNumber || s.batchId.slice(0, 8)} = ${fmt(s.stock)} | product stock = ${fmt(s.productStock)}`);
  }
  console.log();

  // Summary
  console.log('='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`Products to zero : ${productPlans.length}`);
  console.log(`Batches to zero  : ${batchUpdateCount}`);
  console.log(`Stray dust flags : ${strayDustBatches.length}`);
  console.log();

  if (!APPLY) {
    console.log('🟢 DRY RUN complete. No changes were written.');
    console.log('   Run with --apply to perform the cleanup.');
    return;
  }

  if (productPlans.length === 0) {
    console.log('Nothing to clean. Exiting.');
    return;
  }

  console.log('🔴 APPLYING CHANGES...');
  let updated = 0;
  for (const plan of productPlans) {
    await prisma.$transaction(async (tx) => {
      for (const b of plan.batches) {
        if (Math.abs(b.stock) < THRESHOLD) {
          await tx.productBatch.update({ where: { id: b.id }, data: { stock: 0 } });
        }
      }
      await tx.product.update({ where: { id: plan.id }, data: { stock: 0 } });
    });
    updated++;
    console.log(`  ✅ Cleaned: ${plan.name}`);
  }
  console.log(`\n✅ Done. ${updated} product(s) cleaned.`);
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

