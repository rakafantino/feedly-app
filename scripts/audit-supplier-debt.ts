import prisma from '../src/lib/prisma';

async function main() {
  const store = await prisma.store.findFirst();
  if (!store) return;

  const pos = await prisma.purchaseOrder.findMany({
    where: { storeId: store.id },
    orderBy: { createdAt: 'asc' },
    include: { supplier: true }
  });

  let totalHutang = 0;
  let totalPO = 0;
  let totalPaid = 0;

  console.log('--- RINCIAN SEMUA PO ---');
  pos.forEach((po, index) => {
    const hutang = po.totalAmount - po.amountPaid;
    totalHutang += hutang;
    totalPO += po.totalAmount;
    totalPaid += po.amountPaid;

    console.log(`${index + 1}. ${po.poNumber} | Tgl: ${po.createdAt.toISOString().split('T')[0]} | Supplier: ${po.supplier.name}`);
    console.log(`   Nilai PO: Rp ${po.totalAmount.toLocaleString('id-ID')}`);
    console.log(`   Dibayar : Rp ${po.amountPaid.toLocaleString('id-ID')}`);
    console.log(`   Hutang  : Rp ${hutang.toLocaleString('id-ID')}\n`);
  });

  console.log('=========================================');
  console.log(`TOTAL NILAI SEMUA PO : Rp ${totalPO.toLocaleString('id-ID')}`);
  console.log(`TOTAL SUDAH DIBAYAR  : Rp ${totalPaid.toLocaleString('id-ID')}`);
  console.log(`TOTAL SISA HUTANG    : Rp ${totalHutang.toLocaleString('id-ID')}`);
  console.log('=========================================');
}

main().catch(console.error).finally(() => prisma.$disconnect());
