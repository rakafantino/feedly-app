import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local', override: true });

import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter } as any);

  try {
    const store = await prisma.store.findFirst();
    
    // Ambil supplier Bayu
    const supplier = await prisma.supplier.findFirst({
      where: { name: { contains: 'bayu', mode: 'insensitive' }, storeId: store!.id }
    });

    if (!supplier) return console.log('Supplier not found');

    const unpaidPOs = await prisma.purchaseOrder.findMany({
      where: { 
        supplierId: supplier.id,
        remainingAmount: { gt: 0 }
      },
      select: {
        poNumber: true,
        remainingAmount: true
      }
    });

    let totalRemaining = 0;
    console.log(`\nPO BELUM LUNAS UNTUK: ${supplier.name}`);
    for (const po of unpaidPOs) {
        console.log(`- ${po.poNumber}: Rp ${po.remainingAmount.toLocaleString('id-ID')}`);
        totalRemaining += po.remainingAmount;
    }
    console.log(`------------------------------------`);
    console.log(`TOTAL SISA HUTANG DI DB : Rp ${totalRemaining.toLocaleString('id-ID')}\n`);

  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch(console.error);
