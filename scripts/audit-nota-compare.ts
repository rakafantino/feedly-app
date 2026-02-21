/**
 * Audit Script: DETAIL Harga Nota vs DB
 * 
 * Untuk setiap produk di DB, hitung "Harga Per Karung/Pak" (= purchase_price × conversionRate)
 * dan bandingkan dengan harga di nota.
 * 
 * Run: npx tsx scripts/audit-nota-compare.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

// ═══════ NOTA DATA (from photos) ═══════
// Format: [nota_name, nota_price_per_unit, qty_purchased]
// nota_price_per_unit = total price for the lot (1 karung/pack/box)
const NOTA_ITEMS: [string, number, number][] = [
  // Nota 1 (5,300,000)
  ['S12 VIVO', 530000, 1],
  ['S55 SP', 404000, 1],
  ['311 VIVO', 535000, 1],
  ['324-2', 411000, 1],
  ['D93', 410000, 1],
  ['ABS-CR', 328000, 1],
  ['241-PL', 422000, 1],
  ['PIP-CR', 440000, 1],
  ['BURAS CR', 290000, 1],
  ['J.BULAT 85kg', 620000, 1],  // 85kg × 7,300
  ['J.MENIR 25KG', 245000, 1],
  ['J.PECAH 15KG', 133000, 5],  // 5 × 133,000

  // Nota 2 (1,021,000)
  ['PF 1000', 195000, 1],
  ['PF 999', 185000, 1],
  ['T.MINUM 1L', 6000, 10],
  ['T.MINUM 4L', 12000, 10],
  ['T.MAKAN 1KG', 10000, 10],
  // X MBAH JOYO - not delivered
  // X DRAGON SN - not delivered
  ['VITACILOH', 47000, 1],
  // X NEOBRO - not delivered
  ['TETRA CLOOR', 133000, 1],  // 2 botol = 133,000 total? Or 1 pack of 12?
  ['TRIMEJIN', 124000, 1],
  ['594', 11400, 5],  // 5 × 11,400

  // Nota 3 (2,949,000)
  ['PADI AYAM 25kg', 208000, 1],  // 25kg × 8,300
  ['VITA RABBIT', 217000, 1],
  ['781-1', 265000, 1],
  ['782-2', 331000, 1],
  ['782-3', 329000, 1],
  ['782-4', 329000, 1],
  ['SATRIA-2', 210000, 1],
  ['SATRIA-3', 210000, 1],
  ['SATRIA-4', 210000, 1],
  ['SATRIA-5', 210000, 1],
  ['PF 500', 220000, 1],
  ['PF 800', 210000, 1],

  // Nota 4 (3,717,000)
  ['C.CHOISE HIJAU', 415000, 1],
  ['C.CHOISE PINK', 465000, 1],
  ['FELIBITE IKAN', 450000, 1],
  // X MR PUSS MERAH - not delivered
  ['MR PUSS HIJAU', 415000, 1],
  ['BOLT UNGU', 422000, 1],
  ['BOLT KUNING', 422000, 1],
  ['LEZATO', 392000, 1],
  ['SANTAP', 372000, 1],
  ['WHISKAS DEWASA', 163000, 1],
  ['WHISKAS JUNIOR', 163000, 1],
  ['GROWSSY', 38000, 1],

  // Nota 5 (805,000)
  ['TOP 25 LTR', 108000, 1],
  ['TOP 5 LTR', 160000, 1],
  ['TOP 10 LTR', 150000, 1],
  ['TAKARI', 4000, 10],  // 10 × 4,000
  ['DEDAK HALUS 46kg', 170000, 1],  // 46kg × 3,700
  ['DEDAK BIASA 71kg', 177000, 1],  // 71kg × 2,500 = 177,500? Nota says 177,000

  // Nota 6 (2,865,000)
  ['G.COIN PERKUTUT', 130000, 1],  // 10pcs pack
  ['G.COIN HIJAU', 108000, 1],
  ['JUARA KUNING', 105000, 1],
  ['JUARA HIJAU', 105000, 1],
  ['LEOPART', 7000, 10],  // 10 × 7,000
  ['EBOD CANARY', 110000, 1],
  ['EBOD LOVEBIRD', 95000, 1],
  ['EXCEL UNGU', 419000, 1],
  ['EXCEL HIJAU', 419000, 1],
  ['EXCEL OREN', 419000, 1],
  ['EXCEL PINK', 470000, 1],
  ['C.CHOISE OREN', 415000, 1],
];

async function audit() {
  console.log('\n🔍 === PERBANDINGAN DETAIL: NOTA vs DB ===\n');
  
  const store = await prisma.store.findFirst({
    where: { name: { contains: 'S.M.P.M' } }
  });
  if (!store) { console.log('❌ Store not found'); return; }

  // Fetch ALL products with conversion info
  const products = await prisma.product.findMany({
    where: { storeId: store.id, isDeleted: false },
    include: {
      convertedFrom: {
        select: { id: true, name: true, conversionRate: true, purchase_price: true }
      },
      conversionTarget: {
        select: { id: true, name: true, stock: true, purchase_price: true, unit: true }
      },
      items: {
        select: { quantity: true }
      }
    },
    orderBy: { name: 'asc' }
  });

  // For each product, calculate "effective per-unit cost" (for parent = purchase_price per karung)
  // We want to show: what's the total cost of the entire product lot as recorded in DB
  console.log('─'.repeat(100));
  console.log(
    '#'.padStart(3),
    'Nama DB'.padEnd(35),
    'Stok'.padStart(5),
    'Rate'.padStart(5),
    'Harga/Ecer'.padStart(11),
    'Total DB'.padStart(13),
    '│',
    'Status'
  );
  console.log('─'.repeat(100));

  let totalDB = 0;
  let idx = 0;
  const dbEntries: { name: string; totalCost: number; isRetail: boolean; parentName: string; rate: number; unitCost: number; stock: number; qtySold: number }[] = [];

  for (const p of products) {
    const isRetail = p.convertedFrom.length > 0;
    const parent = isRetail ? p.convertedFrom[0] : null;
    const cost = p.purchase_price ?? 0;
    
    // Calculate qty sold for this product
    const qtySold = p.items.reduce((sum: number, item: { quantity: number }) => sum + item.quantity, 0);
    
    // Total cost of the original full lot
    let totalLotCost: number;
    let rate: number;
    
    if (isRetail && parent) {
      rate = parent.conversionRate ?? 1;
      // The initial full lot cost = rate × unit_price
      totalLotCost = rate * cost;
    } else {
      rate = 0;
      // For non-retail, original lot = (current stock + sold) × cost
      totalLotCost = (p.stock + qtySold) * cost;
    }

    // Current value
    const currentValue = p.stock * cost;
    totalDB += currentValue;

    dbEntries.push({
      name: p.name,
      totalCost: totalLotCost,
      isRetail,
      parentName: parent?.name || '',
      rate,
      unitCost: cost,
      stock: p.stock,
      qtySold
    });
  }

  // Now sort: show retail products grouped by parent, with non-retail separate
  // First: parent products (non-retail, no convertedFrom)
  const parentEntries = dbEntries.filter(e => !e.isRetail);
  const retailEntries = dbEntries.filter(e => e.isRetail);

  // Show retail entries (these correspond to nota items)
  console.log('\n🏷️  PRODUK ECERAN → Harga Asal Per Karung/Pak (dibandingkan nota)');
  console.log('─'.repeat(110));
  console.log(
    '#'.padStart(3),
    'Nama DB (Eceran)'.padEnd(32),
    'Rate'.padStart(5),
    'Harga/Unit'.padStart(11),
    'Total 1 Karung'.padStart(15),
    '│',
    'Matched Nota'.padEnd(20),
    'Harga Nota'.padStart(12),
    'Selisih'.padStart(10)
  );
  console.log('─'.repeat(110));

  let totalNotaMatched = 0;
  let totalDBMatched = 0;
  let totalDiff = 0;
  let unmatchedNota = [...NOTA_ITEMS];

  idx = 0;
  for (const e of retailEntries) {
    idx++;
    const totalPerKarung = e.rate * e.unitCost;
    
    // Try to find matching nota item
    let matchIdx = -1;
    let matchedNota: [string, number, number] | null = null;
    
    // Simple fuzzy match by name
    for (let i = 0; i < unmatchedNota.length; i++) {
      const notaName = unmatchedNota[i][0].toLowerCase();
      const dbName = e.name.toLowerCase().replace(' (eceran)', '').replace('(eceran)', '');
      const parentName = e.parentName.toLowerCase();
      
      if (parentName.includes(notaName.replace(/[^a-z0-9]/g, '').slice(0, 5)) ||
          notaName.includes(dbName.replace(/[^a-z0-9]/g, '').slice(0, 5)) ||
          dbName.includes(notaName.replace(/[^a-z0-9]/g, '').slice(0, 5))) {
        matchIdx = i;
        matchedNota = unmatchedNota[i];
        break;
      }
    }

    if (matchedNota) {
      unmatchedNota.splice(matchIdx, 1);
      const notaTotal = matchedNota[1] * matchedNota[2];
      const diff = totalPerKarung - notaTotal;
      totalNotaMatched += notaTotal;
      totalDBMatched += totalPerKarung;
      totalDiff += diff;

      const diffStr = diff === 0 ? '✓' : (diff > 0 ? `+${diff.toLocaleString('id-ID')}` : diff.toLocaleString('id-ID'));
      const highlight = Math.abs(diff) > 100 ? ' ⚠️' : '';
      
      console.log(
        String(idx).padStart(3),
        e.name.substring(0, 32).padEnd(32),
        `1:${e.rate}`.padStart(5),
        e.unitCost.toLocaleString('id-ID').padStart(11),
        totalPerKarung.toLocaleString('id-ID').padStart(15),
        '│',
        matchedNota[0].substring(0, 20).padEnd(20),
        notaTotal.toLocaleString('id-ID').padStart(12),
        (diffStr + highlight).padStart(10)
      );
    } else {
      console.log(
        String(idx).padStart(3),
        e.name.substring(0, 32).padEnd(32),
        `1:${e.rate}`.padStart(5),
        e.unitCost.toLocaleString('id-ID').padStart(11),
        totalPerKarung.toLocaleString('id-ID').padStart(15),
        '│',
        '(tidak match nota)'.padEnd(20),
        ''.padStart(12),
        '?'.padStart(10)
      );
    }
  }

  console.log('─'.repeat(110));
  console.log(
    '   ',
    'SUBTOTAL ECERAN'.padEnd(32),
    ''.padStart(5),
    ''.padStart(11),
    totalDBMatched.toLocaleString('id-ID').padStart(15),
    '│',
    ''.padEnd(20),
    totalNotaMatched.toLocaleString('id-ID').padStart(12),
    totalDiff.toLocaleString('id-ID').padStart(10)
  );

  // Show non-retail products
  console.log('\n📦 PRODUK NON-ECERAN (Parent / Standalone)');
  console.log('─'.repeat(100));
  console.log(
    '#'.padStart(3),
    'Nama DB'.padEnd(35),
    'Stok'.padStart(5),
    'Terjual'.padStart(8),
    'Harga Beli'.padStart(12),
    'Stok×Harga'.padStart(13),
    '│',
    'Catatan'
  );
  console.log('─'.repeat(100));

  let parentTotal = 0;
  idx = 0;
  for (const e of parentEntries) {
    idx++;
    const currentValue = e.stock * e.unitCost;
    parentTotal += currentValue;

    const note = e.stock === 0 ? '(sudah dikonversi semua)' : '';
    
    console.log(
      String(idx).padStart(3),
      e.name.substring(0, 35).padEnd(35),
      String(e.stock).padStart(5),
      String(e.qtySold).padStart(8),
      e.unitCost.toLocaleString('id-ID').padStart(12),
      currentValue.toLocaleString('id-ID').padStart(13),
      '│',
      note
    );
  }
  console.log('─'.repeat(100));
  console.log(`    ${'SUBTOTAL NON-ECERAN'.padEnd(35)} ${''.padStart(5)} ${''.padStart(8)} ${''.padStart(12)} ${parentTotal.toLocaleString('id-ID').padStart(13)}`);

  // Unmatched nota items
  if (unmatchedNota.length > 0) {
    console.log('\n❓ ITEM NOTA YANG TIDAK ADA MATCH DI DB');
    console.log('─'.repeat(60));
    let unmatchedTotal = 0;
    for (const [name, price, qty] of unmatchedNota) {
      const total = price * qty;
      unmatchedTotal += total;
      const qtyStr = qty > 1 ? ` (${qty} × ${price.toLocaleString('id-ID')})` : '';
      console.log(`  - ${name}${qtyStr} = Rp ${total.toLocaleString('id-ID')}`);
    }
    console.log('─'.repeat(60));
    console.log(`  Total item tidak match: Rp ${unmatchedTotal.toLocaleString('id-ID')}`);
    console.log('  → Item ini ada di nota tapi TIDAK ditemukan di DB.');
    console.log('  → Kemungkinan: nama berbeda, belum diinput, atau produk non-inventaris (supplies).');
  }

  // Final summary
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`GRAND TOTAL DB (valuasi saat ini) : Rp ${totalDB.toLocaleString('id-ID')}`);
  console.log(`TOTAL NOTA                        : Rp ${NOTA_ITEMS.reduce((s, [, p, q]) => s + p * q, 0).toLocaleString('id-ID')}`);
  console.log(`SELISIH                           : Rp ${(totalDB - NOTA_ITEMS.reduce((s, [, p, q]) => s + p * q, 0)).toLocaleString('id-ID')}`);
  console.log(`${'═'.repeat(60)}`);
}

audit()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
