/**
 * Audit Script: Trace the gap between Nota Total and DB Valuation
 * Shows: COGS from sold items + detailed product comparison
 * 
 * Run: npx tsx scripts/audit-gap.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

const NOTA_TOTAL = 16657000;

async function audit() {
  console.log('\n🔍 === ANALISIS SELISIH: NOTA vs DB ===\n');
  
  const store = await prisma.store.findFirst({
    where: { name: { contains: 'S.M.P.M' } }
  });
  if (!store) { console.log('❌ Store not found'); return; }
  console.log(`🏪 Store: ${store.name}\n`);

  // 1. Get all transactions and their items (COGS)
  const transactions = await prisma.transaction.findMany({
    where: { storeId: store.id },
    include: {
      items: {
        include: {
          product: { select: { name: true, unit: true } }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  console.log('💰 TRANSAKSI PENJUALAN');
  console.log('─'.repeat(90));
  
  let totalRevenue = 0;
  let totalCOGS = 0;

  for (const tx of transactions) {
    console.log(`\n📋 ${tx.invoiceNumber} | ${tx.createdAt.toISOString().slice(0, 16)} | Total: Rp ${tx.total.toLocaleString('id-ID')}`);
    console.log(
      '  ',
      'Produk'.padEnd(30),
      'Qty'.padStart(5),
      'Harga Jual'.padStart(12),
      'Revenue'.padStart(12),
      'HPP/Unit'.padStart(12),
      'COGS'.padStart(12)
    );

    for (const item of tx.items) {
      const revenue = item.price * item.quantity;
      const costPrice = (item as unknown as { cost_price: number }).cost_price ?? 0;
      const cogs = costPrice * item.quantity;
      totalRevenue += revenue;
      totalCOGS += cogs;

      console.log(
        '  ',
        (item.product?.name || '?').substring(0, 30).padEnd(30),
        String(item.quantity).padStart(5),
        item.price.toLocaleString('id-ID').padStart(12),
        revenue.toLocaleString('id-ID').padStart(12),
        costPrice.toLocaleString('id-ID').padStart(12),
        cogs.toLocaleString('id-ID').padStart(12)
      );
    }
  }
  
  console.log('\n' + '─'.repeat(90));
  console.log(`Total Revenue (Pendapatan)   : Rp ${totalRevenue.toLocaleString('id-ID')}`);
  console.log(`Total COGS (HPP Terjual)     : Rp ${totalCOGS.toLocaleString('id-ID')}`);
  console.log(`Laba Kotor                   : Rp ${(totalRevenue - totalCOGS).toLocaleString('id-ID')}`);

  // 2. Stock adjustments netto
  const adjustments = await prisma.stockAdjustment.findMany({
    where: { storeId: store.id },
    include: { product: { select: { name: true } } }
  });

  let adjLoss = 0;
  let adjGain = 0;
  for (const adj of adjustments) {
    if (adj.totalValue < 0) adjLoss += Math.abs(adj.totalValue);
    else adjGain += adj.totalValue;
  }

  console.log(`\nStock Adjustments Netto       : Rp ${(adjGain - adjLoss).toLocaleString('id-ID')}`);

  // 3. Current valuation
  const products = await prisma.product.findMany({
    where: { storeId: store.id, isDeleted: false },
    select: { stock: true, purchase_price: true }
  });

  let currentValuation = 0;
  for (const p of products) {
    const cost = p.purchase_price ?? 0;
    if (p.stock > 0 && cost > 0) {
      currentValuation += p.stock * cost;
    }
  }

  // 4. Reconciliation
  console.log('\n' + '═'.repeat(60));
  console.log('📊 REKONSILIASI');
  console.log('═'.repeat(60));
  console.log(`A. Total Belanja (Nota)      : Rp ${NOTA_TOTAL.toLocaleString('id-ID')}`);
  console.log(`B. COGS Terjual              : Rp ${totalCOGS.toLocaleString('id-ID')}`);
  console.log(`C. Kerugian Adjustment       : Rp ${adjLoss.toLocaleString('id-ID')}`);
  console.log(`D. Koreksi Adjustment        : Rp ${adjGain.toLocaleString('id-ID')}`);
  console.log('─'.repeat(60));

  const expectedValuation = NOTA_TOTAL - totalCOGS - adjLoss + adjGain;
  console.log(`Seharusnya (A - B - C + D)   : Rp ${expectedValuation.toLocaleString('id-ID')}`);
  console.log(`Valuasi DB Aktual            : Rp ${currentValuation.toLocaleString('id-ID')}`);
  console.log(`Selisih                      : Rp ${(currentValuation - expectedValuation).toLocaleString('id-ID')}`);
  console.log('═'.repeat(60));

  if (Math.abs(currentValuation - expectedValuation) > 100) {
    console.log('\n⚠️  Selisih > Rp 100 menunjukkan ada perbedaan harga beli');
    console.log('   antara yang tercatat di nota vs yang di-input di DB.');
    console.log('   Cek produk-produk yang harga belinya di-input berbeda dari nota.');
  } else {
    console.log('\n✅  Valuasi cocok! Selisih kecil dari pembulatan eceran.');
  }
}

audit()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
