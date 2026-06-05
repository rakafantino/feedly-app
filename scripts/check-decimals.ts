/**
 * Check Decimals Script
 * Run: npx tsx scripts/check-decimals.ts
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
  console.log('--- SCANNING DATABASE FOR LONG DECIMALS (READ ONLY) ---');
  
  const products = await prisma.product.findMany({ select: { id: true, name: true, stock: true } });
  const batches = await prisma.productBatch.findMany({ select: { id: true, productId: true, stock: true } });
  const txItems = await prisma.transactionItem.findMany({ select: { id: true, quantity: true, productId: true } });

  const hasLongDecimal = (val: number | null | undefined) => {
    if (val === null || val === undefined) return false;
    const s = val.toFixed(20);
    return s.includes('.') && s.split('.')[1].replace(/0+$/, '').length > 3;
  };

  const badProducts = products.filter(p => hasLongDecimal(p.stock));
  const badBatches = batches.filter(b => hasLongDecimal(b.stock));
  const badTxItems = txItems.filter(t => hasLongDecimal(t.quantity));

  console.log(`\n📦 PRODUCTS: Found ${badProducts.length} items with > 3 decimal places (out of ${products.length}).`);
  badProducts.slice(0, 10).forEach(p => console.log(`  - [ID: ${p.id}] ${p.name}: ${p.stock}`));

  console.log(`\n🗃️ BATCHES: Found ${badBatches.length} items with > 3 decimal places (out of ${batches.length}).`);
  badBatches.slice(0, 10).forEach(b => console.log(`  - [Batch: ${b.id}] Product ID: ${b.productId} -> Stock: ${b.stock}`));

  console.log(`\n🛒 TX ITEMS: Found ${badTxItems.length} items with > 3 decimal places (out of ${txItems.length}).`);
  badTxItems.slice(0, 5).forEach(t => console.log(`  - [TxItem: ${t.id}] Product ID: ${t.productId} -> Qty: ${t.quantity}`));

  console.log('--- CLEANING DATABASE FOR LONG DECIMALS ---');

  // Fix Products
  if (badProducts.length > 0) {
    console.log(`Fixing ${badProducts.length} Products...`);
    for (const p of badProducts) {
      const fixed = Math.round(Number(p.stock) * 1000) / 1000;
      await prisma.product.update({ where: { id: p.id }, data: { stock: fixed } });
    }
  }

  // Fix Batches
  if (badBatches.length > 0) {
    console.log(`Fixing ${badBatches.length} Batches...`);
    for (const b of badBatches) {
      const fixed = Math.round(Number(b.stock) * 1000) / 1000;
      await prisma.productBatch.update({ where: { id: b.id }, data: { stock: fixed } });
    }
  }

  // Fix Transaction Items
  if (badTxItems.length > 0) {
    console.log(`Fixing ${badTxItems.length} Transaction Items...`);
    for (const t of badTxItems) {
      const fixed = Math.round(Number(t.quantity) * 1000) / 1000;
      await prisma.transactionItem.update({ where: { id: t.id }, data: { quantity: fixed } });
    }
  }

  console.log('\n✅ Database successfully cleaned up!');
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
