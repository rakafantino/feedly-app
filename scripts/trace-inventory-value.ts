import prisma from '../src/lib/prisma';

async function main() {
  const store = await prisma.store.findFirst();
  if (!store) {
    console.error('No store found');
    return;
  }
  const storeId = store.id;

  console.log(`Tracing Inventory Value for Store: ${store.name} (${storeId})\n`);

  // 1. Total PO Value (Barang yang pernah dibeli)
  const allPOs = await prisma.purchaseOrder.findMany({
    where: { storeId },
    include: { items: true }
  });
  
  let totalPOValue = 0;
  allPOs.forEach(po => {
    totalPOValue += po.totalAmount;
  });
  console.log(`[+] Total Nilai Pembelian (Semua PO): Rp ${totalPOValue.toLocaleString('id-ID')}`);

  // 2. Total COGS (Barang yang sudah terjual)
  const allTransactions = await prisma.transaction.findMany({
    where: { storeId },
    include: { items: { include: { product: true } } }
  });

  let totalCOGS = 0;
  allTransactions.forEach(tx => {
    tx.items.forEach(item => {
      const costPrice = (item as any).cost_price ?? item.product?.purchase_price ?? (item.price * 0.7);
      totalCOGS += costPrice * item.quantity;
    });
  });
  console.log(`[-] Total HPP Barang Terjual (COGS): Rp ${totalCOGS.toLocaleString('id-ID')}`);

  // 3. Total Waste & Adjustments
  const adjustments = await prisma.stockAdjustment.findMany({
    where: { storeId }
  });

  let totalWaste = 0;
  let totalCorrections = 0;
  adjustments.forEach(adj => {
    if (adj.type === 'CORRECTION' && adj.totalValue > 0) {
      totalCorrections += adj.totalValue;
    } else if (adj.type !== 'SYSTEM_ERROR') {
      totalWaste += Math.abs(adj.totalValue);
    }
  });
  console.log(`[-] Total Barang Rusak/Expired (Waste): Rp ${totalWaste.toLocaleString('id-ID')}`);
  console.log(`[+] Total Koreksi Stok Masuk: Rp ${totalCorrections.toLocaleString('id-ID')}`);

  // 4. Expected Inventory Value
  const expectedValue = totalPOValue - totalCOGS - totalWaste + totalCorrections;
  console.log(`--------------------------------------------------`);
  console.log(`ESTIMASI NILAI INVENTARIS (Berdasarkan Arus Barang): Rp ${expectedValue.toLocaleString('id-ID')}\n`);

  // 5. Actual Inventory Value (Current Stock * Purchase Price)
  const products = await prisma.product.findMany({
    where: { storeId, isDeleted: false }
  });

  let actualValue = 0;
  products.forEach(p => {
    actualValue += (p.purchase_price || 0) * p.stock;
  });
  
  console.log(`==================================================`);
  console.log(`NILAI INVENTARIS AKTUAL (Stok Saat Ini x Harga Beli): Rp ${actualValue.toLocaleString('id-ID')}`);
  console.log(`==================================================\n`);

  console.log(`Selisih (Estimasi vs Aktual): Rp ${(expectedValue - actualValue).toLocaleString('id-ID')}`);
  
  if (expectedValue !== actualValue) {
    console.log(`\nAlasan kenapa bisa ada selisih:`);
    console.log(`1. Harga beli (purchase_price) produk diubah setelah PO dibuat.`);
    console.log(`2. Ada produk yang ditambahkan manual (tanpa PO) tapi diberi stok awal.`);
    console.log(`3. Perhitungan HPP (COGS) menggunakan estimasi 70% jika cost_price tidak terekam.`);
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
