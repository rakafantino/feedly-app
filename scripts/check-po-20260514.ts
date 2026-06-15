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
    const p = await prisma.purchaseOrder.findFirst({
      where: { poNumber: 'PO-20260514-001' }
    });
    
    console.log(JSON.stringify(p, null, 2));

  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch(console.error);
