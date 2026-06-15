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
    const supplier = await prisma.supplier.findFirst({
      where: { name: { contains: 'bayu', mode: 'insensitive' }, storeId: store!.id }
    });

    const allPOs = await prisma.purchaseOrder.findMany({
        where: { supplierId: supplier!.id },
        orderBy: { createdAt: 'asc' }
    });

    let tPO = 0, tPaid = 0;
    for (const po of allPOs) {
        tPO += po.totalAmount;
        tPaid += po.amountPaid;
    }

    const allReturns = await prisma.purchaseReturn.findMany({
        where: { supplierId: supplier!.id }
    });
    
    let tRet = 0;
    for (const r of allReturns) { tRet += r.totalAmount; }

    console.log(`tPO: ${tPO}, tPaid: ${tPaid}, tRet: ${tRet}`);
    console.log(`True Global Debt: ${tPO - tPaid - tRet}`);
    console.log(`Current DB remainingAmount Sum: ${allPOs.reduce((s, p) => s + p.remainingAmount, 0)}`);

  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch(console.error);
