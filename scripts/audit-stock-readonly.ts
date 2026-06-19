/**
 * Audit Stock Script (READ-ONLY)
 * Run: npx tsx scripts/audit-stock-readonly.ts
 * 
 * This script queries the production database to report:
 * - All products with stock > 0 (parent and retail)
 * - All batches with stock > 0
 * - Decimal precision issues
 * - Stock discrepancies between product and batch totals
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

function hasLongDecimal(val: number | null | undefined): boolean {
  if (val === null || val === undefined) return false;
  const s = val.toFixed(20);
  return s.includes('.') && s.split('.')[1].replace(/0+$/, '').length > 3;
}

function formatDecimal(val: number): string {
  if (Number.isInteger(val)) return val.toString();
  return val.toFixed(10).replace(/0+$/, '').replace(/\.$/, '');
}

async function main() {
  console.log('='.repeat(80));
  console.log('STOCK AUDIT REPORT - READ ONLY');
  console.log('Database:', process.env.DATABASE_URL?.substring(0, 50) + '...');
  console.log('Timestamp:', new Date().toISOString());
  console.log('='.repeat(80));
  console.log();

  // 1. Query all products with stock > 0
  const products = await prisma.product.findMany({
    where: { stock: { gt: 0 }, isDeleted: false },
    select: {
      id: true,
      name: true,
      stock: true,
      unit: true,
      conversionTargetId: true,
      conversionRate: true,
      storeId: true,
    },
    orderBy: { name: 'asc' },
  });

  console.log(`📦 Total Products with Stock > 0: ${products.length}`);
  console.log();

  // 2. Query all batches with stock > 0
  const batches = await prisma.productBatch.findMany({
    where: { stock: { gt: 0 } },
    select: {
      id: true,
      productId: true,
      stock: true,
      expiryDate: true,
      batchNumber: true,
      inDate: true,
      product: {
        select: {
          name: true,
          unit: true,
        },
      },
    },
    orderBy: [{ productId: 'asc' }, { inDate: 'asc' }],
  });

  console.log(`🗃️  Total Batches with Stock > 0: ${batches.length}`);
  console.log();

  // 3. Identify products with long decimals
  const longDecimalProducts = products.filter(p => hasLongDecimal(p.stock));
  const longDecimalBatches = batches.filter(b => hasLongDecimal(b.stock));

  console.log('='.repeat(80));
  console.log('⚠️  DECIMAL PRECISION ISSUES');
  console.log('='.repeat(80));
  console.log(`Products with > 3 decimal places: ${longDecimalProducts.length}`);
  if (longDecimalProducts.length > 0) {
    longDecimalProducts.slice(0, 20).forEach(p => {
      console.log(`  - ${p.name} (${p.unit}): ${formatDecimal(p.stock)}`);
    });
    if (longDecimalProducts.length > 20) {
      console.log(`  ... and ${longDecimalProducts.length - 20} more`);
    }
  }
  console.log();

  console.log(`Batches with > 3 decimal places: ${longDecimalBatches.length}`);
  if (longDecimalBatches.length > 0) {
    longDecimalBatches.slice(0, 20).forEach(b => {
      console.log(`  - ${b.product.name} (${b.product.unit}) [Batch: ${b.batchNumber || b.id.slice(0, 8)}]: ${formatDecimal(b.stock)}`);
    });
    if (longDecimalBatches.length > 20) {
      console.log(`  ... and ${longDecimalBatches.length - 20} more`);
    }
  }
  console.log();

  // 4. Group batches by product and check stock integrity
  const batchesByProduct = new Map<string, typeof batches>();
  for (const batch of batches) {
    if (!batchesByProduct.has(batch.productId)) {
      batchesByProduct.set(batch.productId, []);
    }
    batchesByProduct.get(batch.productId)!.push(batch);
  }

  console.log('='.repeat(80));
  console.log('📊 DETAILED PRODUCT STOCK REPORT');
  console.log('='.repeat(80));

  let mismatchCount = 0;
  const mismatches: Array<{ product: typeof products[0]; productStock: number; batchTotal: number; gap: number }> = [];

  for (const product of products) {
    const productBatches = batchesByProduct.get(product.id) || [];
    const batchTotal = productBatches.reduce((sum, b) => sum + b.stock, 0);
    const gap = Math.abs(product.stock - batchTotal);
    const isMismatch = gap > 0.001;

    if (isMismatch) {
      mismatchCount++;
      mismatches.push({ product, productStock: product.stock, batchTotal, gap });
    }

    const isParent = product.conversionTargetId !== null;
    const type = isParent ? 'INDUK' : 'ECERAN';
    const conversionInfo = product.conversionRate ? ` (1 ${product.unit} = ${product.conversionRate} ${productBatches[0]?.product.unit || '?'})` : '';

    console.log(`\n${'─'.repeat(80)}`);
    console.log(`[${type}] ${product.name}${conversionInfo}`);
    console.log(`  Unit: ${product.unit}`);
    console.log(`  Product Stock: ${formatDecimal(product.stock)} ${product.unit}`);
    console.log(`  Batch Count: ${productBatches.length}`);
    console.log(`  Batch Total: ${formatDecimal(batchTotal)} ${product.unit}`);
    
    if (isMismatch) {
      console.log(`  ⚠️  MISMATCH: Gap = ${formatDecimal(gap)} ${product.unit}`);
    } else {
      console.log(`  ✅ Stock matches batch total`);
    }

    if (hasLongDecimal(product.stock)) {
      console.log(`  ⚠️  Product stock has long decimal: ${formatDecimal(product.stock)}`);
    }

    if (productBatches.length > 0) {
      console.log(`  Batch Details:`);
      for (const batch of productBatches) {
        const expiryStr = batch.expiryDate ? ` | Exp: ${batch.expiryDate.toISOString().split('T')[0]}` : '';
        const batchNum = batch.batchNumber || batch.id.slice(0, 8);
        const decimalWarning = hasLongDecimal(batch.stock) ? ' ⚠️' : '';
        console.log(`    - [${batchNum}] Stock: ${formatDecimal(batch.stock)} ${product.unit}${expiryStr} | In: ${batch.inDate.toISOString().split('T')[0]}${decimalWarning}`);
      }
    } else {
      console.log(`  ⚠️  No active batches found (stock exists in product but no batches)`);
    }
  }

  // 5. Summary of mismatches
  console.log();
  console.log('='.repeat(80));
  console.log('⚠️  STOCK INTEGRITY MISMATCHES');
  console.log('='.repeat(80));
  console.log(`Total products with stock mismatch: ${mismatchCount}`);
  
  if (mismatches.length > 0) {
    console.log();
    console.log('Top 20 Mismatches:');
    mismatches
      .sort((a, b) => b.gap - a.gap)
      .slice(0, 20)
      .forEach((m, idx) => {
        console.log(`  ${idx + 1}. ${m.product.name}`);
        console.log(`     Product: ${formatDecimal(m.productStock)} | Batch Total: ${formatDecimal(m.batchTotal)} | Gap: ${formatDecimal(m.gap)}`);
      });
  }

  // 6. Summary statistics
  console.log();
  console.log('='.repeat(80));
  console.log('📈 SUMMARY STATISTICS');
  console.log('='.repeat(80));
  
  const parentProducts = products.filter(p => p.conversionTargetId !== null);
  const retailProducts = products.filter(p => p.conversionTargetId === null);
  const totalStock = products.reduce((sum, p) => sum + p.stock, 0);
  const totalBatchStock = batches.reduce((sum, b) => sum + b.stock, 0);

  console.log(`Parent Products (Induk): ${parentProducts.length}`);
  console.log(`Retail Products (Eceran): ${retailProducts.length}`);
  console.log(`Total Product Stock: ${formatDecimal(totalStock)}`);
  console.log(`Total Batch Stock: ${formatDecimal(totalBatchStock)}`);
  console.log(`Overall Stock Gap: ${formatDecimal(Math.abs(totalStock - totalBatchStock))}`);
  console.log();
  console.log('='.repeat(80));
  console.log('END OF REPORT');
  console.log('='.repeat(80));
}

main()
  .catch(e => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

