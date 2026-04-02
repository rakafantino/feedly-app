import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  console.log("🔍 Checking Database Contents...\n");

  const storeCount = await prisma.store.count();
  console.log(`Stores: ${storeCount}`);

  const productCount = await prisma.product.count();
  console.log(`Products: ${productCount}`);

  const supplierCount = await prisma.supplier.count();
  console.log(`Suppliers: ${supplierCount}`);

  const poCount = await prisma.purchaseOrder.count();
  console.log(`Purchase Orders: ${poCount}`);

  const poPaymentCount = await prisma.purchaseOrderPayment.count();
  console.log(`Purchase Order Payments: ${poPaymentCount}`);

  const transactionCount = await prisma.transaction.count();
  console.log(`Transactions: ${transactionCount}`);

  const userCount = await prisma.user.count();
  console.log(`Users: ${userCount}`);

  console.log("\n--- Recent Purchase Orders ---");
  const recentPOs = await prisma.purchaseOrder.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
    include: { supplier: true },
  });

  for (const po of recentPOs) {
    console.log(`- ${po.poNumber} | ${po.supplier?.name || "N/A"} | Status: ${po.status} | Payment: ${po.paymentStatus} | Total: Rp ${po.totalAmount.toLocaleString("id-ID")}`);
  }

  console.log("\n--- Recent Payments ---");
  const recentPayments = await prisma.purchaseOrderPayment.findMany({
    take: 5,
    orderBy: { paidAt: "desc" },
    include: { purchaseOrder: true },
  });

  for (const pay of recentPayments) {
    console.log(`- PO: ${pay.purchaseOrder?.poNumber || pay.purchaseOrderId} | Amount: Rp ${pay.amount.toLocaleString("id-ID")} | Method: ${pay.paymentMethod} | Date: ${pay.paidAt.toISOString().split("T")[0]}`);
  }

  console.log("\n✨ Check completed!");
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
