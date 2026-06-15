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
    const suppliers = await prisma.supplier.findMany();
    let totalFixes = 0;
    
    for (const supplier of suppliers) {
      // In the frontend, the data returned from API is grouped manually.
      // But retur history comes from all purchase returns of the supplier.
      // We will mimic exactly how the real debt is supposed to be calculated
      // by pulling all POs and all returns.
      const allPOs = await prisma.purchaseOrder.findMany({
        where: { supplierId: supplier.id },
        orderBy: { createdAt: 'asc' }
      });

      const allReturns = await prisma.purchaseReturn.findMany({
        where: { supplierId: supplier.id }
      });

      let totalPO = 0;
      let totalPaid = 0;
      let totalReturn = 0;

      for (const po of allPOs) {
        totalPO += po.totalAmount;
        totalPaid += po.amountPaid;
      }
      
      for (const ret of allReturns) {
        totalReturn += ret.totalAmount;
      }

      const trueGlobalDebt = Math.max(0, totalPO - totalPaid - totalReturn);
      const currentDBDebt = allPOs.reduce((sum, po) => sum + po.remainingAmount, 0);

      if (currentDBDebt > trueGlobalDebt) {
        let driftToFix = currentDBDebt - trueGlobalDebt;
        console.log(`\nFixing Supplier: ${supplier.name} | Drift: Rp ${driftToFix}`);
        
        const unpaidPOs = allPOs.filter(p => p.remainingAmount > 0).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        const transactionOps = [];

        for (const po of unpaidPOs) {
          if (driftToFix <= 0) break;

          const deduction = Math.min(po.remainingAmount, driftToFix);
          const newRemaining = po.remainingAmount - deduction;
          
          transactionOps.push(
              prisma.purchaseOrder.update({
                where: { id: po.id },
                data: { 
                    remainingAmount: newRemaining,
                    paymentStatus: newRemaining <= 0 ? 'PAID' : 'PARTIAL'
                }
              })
          );
          
          driftToFix -= deduction;
          console.log(`  - Prepared deduction for PO ${po.poNumber} by Rp ${deduction}. New Remaining: Rp ${newRemaining}`);
        }
        
        if (transactionOps.length > 0) {
            await prisma.$transaction(transactionOps);
            console.log(`  ✅ Successfully committed transaction for ${supplier.name}`);
            totalFixes++;
        }
      }
    }
    console.log(`\nPatch completed! Applied fixes to ${totalFixes} supplier(s).`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch(console.error);
