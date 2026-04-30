import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  console.log("🚀 Starting PO Payment History Migration...\n");

  const purchaseOrders = await prisma.purchaseOrder.findMany({
    where: {
      amountPaid: {
        gt: 0,
      },
    },
    select: {
      id: true,
      poNumber: true,
      supplierId: true,
      storeId: true,
      amountPaid: true,
      totalAmount: true,
      paymentStatus: true,
      updatedAt: true,
      createdAt: true,
    },
  });

  console.log(`Found ${purchaseOrders.length} Purchase Orders with payments to migrate.\n`);

  let migratedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const po of purchaseOrders) {
    try {
      const existingPayments = await prisma.purchaseOrderPayment.count({
        where: {
          purchaseOrderId: po.id,
        },
      });

      if (existingPayments > 0) {
        console.log(`  ⏭️  Skipping PO ${po.poNumber} (already has ${existingPayments} payment record(s))`);
        skippedCount++;
        continue;
      }

      await prisma.purchaseOrderPayment.create({
        data: {
          purchaseOrderId: po.id,
          amount: po.amountPaid,
          paymentMethod: "SYSTEM_IMPORT",
          notes: `Imported from existing payment data. Original status: ${po.paymentStatus}`,
          paidAt: po.updatedAt,
        },
      });

      migratedCount++;
      console.log(`  ✅ Migrated PO ${po.poNumber} - Rp ${po.amountPaid.toLocaleString("id-ID")} (paid on ${po.updatedAt.toISOString().split("T")[0]})`);
    } catch (error) {
      errorCount++;
      console.error(`  ❌ Error migrating PO ${po.poNumber}:`, error);
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log("📊 Migration Summary:");
  console.log(`   ✅ Successfully migrated: ${migratedCount}`);
  console.log(`   ⏭️  Skipped (already has records): ${skippedCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log("=".repeat(50));
  console.log("\n✨ Migration completed!");
}

main()
  .catch((e) => {
    console.error("Fatal error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
