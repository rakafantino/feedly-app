/**
 * Audit Script: Cross-check Nota vs Database Purchase Prices
 * 
 * Shows ALL products with their purchase_price, stock, and total value
 * so the user can compare against physical receipts (nota).
 * 
 * Run: npx tsx scripts/audit-valuation.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function audit() {
  console.log('\n🔍 === AUDIT VALUASI INVENTARIS vs NOTA ===\n');
  
  // Get Toko S.M.P.M specifically
  const store = await prisma.store.findFirst({
    where: { name: { contains: 'S.M.P.M' } }
  });
  if (!store) {
    // fallback to first store
    const fallback = await prisma.store.findFirst();
    if (!fallback) { console.log('❌ Store not found'); return; }
    console.log(`🏪 Store: ${fallback.name}\n`);
    await auditStore(fallback.id);
  } else {
    console.log(`🏪 Store: ${store.name}\n`);
    await auditStore(store.id);
  }
}

async function auditStore(storeId: string) {
  // Fetch ALL products (including retail children)
  const products = await prisma.product.findMany({
    where: { storeId, isDeleted: false },
    include: {
      convertedFrom: {
        select: { id: true, name: true, purchase_price: true, conversionRate: true }
      },
      conversionTarget: {
        select: { id: true, name: true, stock: true, purchase_price: true }
      }
    },
    orderBy: { name: 'asc' }
  });

  // Separate parent/standalone vs retail
  const parentProducts = products.filter(p => p.convertedFrom.length === 0);
  const retailProducts = products.filter(p => p.convertedFrom.length > 0);

  let grandTotal = 0;
  let grandTotalParentOnly = 0;

  // ─────── SECTION 1: Parent / Standalone Products ───────
  console.log('📦 PRODUK UTAMA (Non-Eceran)');
  console.log('─'.repeat(95));
  console.log(
    '#'.padStart(3),
    'Nama Produk'.padEnd(35),
    'Stok'.padStart(6),
    'Unit'.padEnd(6),
    'Harga Beli'.padStart(12),
    'Total Nilai'.padStart(14),
    'Punya Eceran?'
  );
  console.log('─'.repeat(95));

  let idx = 0;
  for (const p of parentProducts) {
    idx++;
    const cost = p.purchase_price ?? 0;
    const value = p.stock * cost;
    grandTotal += value;
    grandTotalParentOnly += value;

    const hasRetail = (p.conversionTarget as unknown as { id: string }[])?.length > 0 ? '✓ Ya' : '';

    console.log(
      String(idx).padStart(3),
      p.name.substring(0, 35).padEnd(35),
      String(p.stock).padStart(6),
      (p.unit || 'pcs').padEnd(6),
      cost.toLocaleString('id-ID').padStart(12),
      value.toLocaleString('id-ID').padStart(14),
      hasRetail
    );
  }
  console.log('─'.repeat(95));
  console.log(`${''.padStart(3)} ${'Subtotal Produk Utama'.padEnd(35)} ${''.padStart(6)} ${''.padEnd(6)} ${''.padStart(12)} ${grandTotalParentOnly.toLocaleString('id-ID').padStart(14)}`);
  console.log('');

  // ─────── SECTION 2: Retail Products ───────
  if (retailProducts.length > 0) {
    console.log('🏷️  PRODUK ECERAN (Hasil Konversi)');
    console.log('─'.repeat(110));
    console.log(
      '#'.padStart(3),
      'Nama Eceran'.padEnd(30),
      'Parent'.padEnd(25),
      'Stok'.padStart(6),
      'Unit'.padEnd(6),
      'Harga/Unit'.padStart(12),
      'Total Nilai'.padStart(14),
      'Rate'
    );
    console.log('─'.repeat(110));

    let retailTotal = 0;
    let ridx = 0;
    for (const p of retailProducts) {
      ridx++;
      const cost = p.purchase_price ?? 0;
      const value = p.stock * cost;
      retailTotal += value;
      grandTotal += value;

      const parent = p.convertedFrom[0];
      const parentName = parent?.name || '?';
      const rate = parent?.conversionRate || '?';

      console.log(
        String(ridx).padStart(3),
        p.name.substring(0, 30).padEnd(30),
        parentName.substring(0, 25).padEnd(25),
        String(p.stock).padStart(6),
        (p.unit || 'pcs').padEnd(6),
        cost.toLocaleString('id-ID').padStart(12),
        value.toLocaleString('id-ID').padStart(14),
        `1:${rate}`
      );
    }
    console.log('─'.repeat(110));
    console.log(`${''.padStart(3)} ${'Subtotal Eceran'.padEnd(30)} ${''.padEnd(25)} ${''.padStart(6)} ${''.padEnd(6)} ${''.padStart(12)} ${retailTotal.toLocaleString('id-ID').padStart(14)}`);
    console.log('');
  }

  // ─────── SECTION 3: Grand Total ───────
  console.log('═'.repeat(60));
  console.log(`GRAND TOTAL VALUASI: Rp ${grandTotal.toLocaleString('id-ID')}`);
  console.log(`  - Produk Utama   : Rp ${grandTotalParentOnly.toLocaleString('id-ID')}`);
  console.log(`  - Produk Eceran  : Rp ${(grandTotal - grandTotalParentOnly).toLocaleString('id-ID')}`);
  console.log('═'.repeat(60));
  console.log('');

  // ─────── SECTION 4: Quick check for potential double-counting ───────
  console.log('⚠️  CEK DOUBLE-COUNTING');
  console.log('─'.repeat(80));
  console.log('Produk yang SUDAH dikonversi ke eceran (parent stok + eceran stok dihitung ganda):');
  console.log('');

  for (const p of parentProducts) {
    const retailChildren = (p.conversionTarget as unknown as { id: string; name: string; stock: number; purchase_price: number | null }[]) || [];
    if (retailChildren.length > 0) {
      const parentValue = (p.purchase_price ?? 0) * p.stock;
      let childrenValue = 0;
      for (const child of retailChildren) {
        childrenValue += (child.purchase_price ?? 0) * child.stock;
      }

      console.log(`  📦 ${p.name}`);
      console.log(`     Parent: ${p.stock} ${p.unit} × Rp ${(p.purchase_price ?? 0).toLocaleString('id-ID')} = Rp ${parentValue.toLocaleString('id-ID')}`);
      for (const child of retailChildren) {
        const cv = (child.purchase_price ?? 0) * child.stock;
        console.log(`     └─ Eceran: ${child.name} → ${child.stock} × Rp ${(child.purchase_price ?? 0).toLocaleString('id-ID')} = Rp ${cv.toLocaleString('id-ID')}`);
      }
      console.log(`     Total gabungan: Rp ${(parentValue + childrenValue).toLocaleString('id-ID')}`);
      console.log('');
    }
  }

  // ─────── NOTA COMPARISON ───────
  console.log('');
  console.log('📝 NOTA BELANJA (dari foto):');
  console.log('─'.repeat(40));
  console.log('Nota 1: Rp 5.300.000');
  console.log('Nota 2: Rp 1.021.000');
  console.log('Nota 3: Rp 2.949.000');
  console.log('Nota 4: Rp 3.717.000');
  console.log('Nota 5: Rp   805.000');
  const notaTotal = 5300000 + 1021000 + 2949000 + 3717000 + 805000;
  console.log(`Total Nota: Rp ${notaTotal.toLocaleString('id-ID')}`);
  console.log('');
  console.log(`Valuasi DB : Rp ${grandTotal.toLocaleString('id-ID')}`);
  console.log(`Total Nota : Rp ${notaTotal.toLocaleString('id-ID')}`);
  console.log(`Selisih    : Rp ${(grandTotal - notaTotal).toLocaleString('id-ID')}`);
  console.log('');
  console.log('🔎 Catatan: Item di nota yang bertanda "X" atau tanpa harga (MBAH JOYO, DRAGON SN, MR PUSS MERAH, NEOBRO)');
  console.log('   kemungkinan bonus/gratis, jadi purchase_price = 0 di DB.');
  console.log('   Jika ada nota LAIN yang belum difoto, selisih bisa dari situ.');
}

audit()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
