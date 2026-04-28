import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const args = process.argv.slice(2);
const shouldApply = args.includes("--apply");
const filters = args.filter((arg) => arg !== "--apply");
const storeQuery = filters.join(" ").trim();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "-";
  }

  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  }).format(value);
}

function buildRepairBatchNumber(productId: string): string {
  const now = new Date();
  const stamp = now
    .toISOString()
    .replace(/[-:TZ.]/g, "")
    .slice(0, 14);
  return `REPAIR-${stamp}-${productId.slice(-4)}`;
}

async function resolveStoreId(): Promise<string | null> {
  if (!storeQuery) {
    return null;
  }

  const store = await prisma.store.findFirst({
    where: {
      OR: [{ id: storeQuery }, { name: { equals: storeQuery, mode: "insensitive" } }, { name: { contains: storeQuery, mode: "insensitive" } }],
    },
    select: { id: true },
  });

  if (!store) {
    throw new Error(`Store not found for query: ${storeQuery}`);
  }

  return store.id;
}

async function main() {
  console.log("\n=== Stock Batch Repair ===\n");
  console.log(`Mode   : ${shouldApply ? "APPLY" : "DRY RUN"}`);
  console.log(`Filter : ${storeQuery || "all stores"}\n`);

  const storeId = await resolveStoreId();

  const products = await prisma.product.findMany({
    where: {
      isDeleted: false,
      ...(storeId ? { storeId } : {}),
    },
    include: {
      store: {
        select: {
          name: true,
        },
      },
      batches: {
        select: {
          stock: true,
        },
      },
    },
  });

  const repairs = products
    .map((product) => {
      const activeBatchStock = product.batches.filter((batch) => batch.stock > 0).reduce((sum, batch) => sum + batch.stock, 0);
      const gap = product.stock - activeBatchStock;

      return {
        id: product.id,
        name: product.name,
        storeId: product.storeId,
        storeName: product.store.name,
        unit: product.unit,
        productStock: product.stock,
        activeBatchStock,
        gap,
        purchasePrice: product.purchase_price ?? product.hpp_price ?? 0,
        expiryDate: product.expiry_date,
      };
    })
    .filter((item) => Math.abs(item.gap) > 0.0001);

  if (repairs.length === 0) {
    console.log("No mismatches found.");
    return;
  }

  console.log(`Mismatches to repair: ${repairs.length}\n`);

  for (const repair of repairs) {
    const action = repair.gap > 0 ? `CREATE BATCH ${formatNumber(repair.gap)} ${repair.unit}` : `SYNC PRODUCT STOCK TO ${formatNumber(repair.activeBatchStock)} ${repair.unit}`;

    console.log(`- [${repair.storeName}] ${repair.name} | product=${formatNumber(repair.productStock)} | batches=${formatNumber(repair.activeBatchStock)} | gap=${formatNumber(repair.gap)} | action=${action}`);
  }

  if (!shouldApply) {
    console.log("\nDry run finished. Re-run with --apply to write changes.");
    return;
  }

  console.log("\nApplying repairs...\n");

  for (const repair of repairs) {
    await prisma.$transaction(async (tx) => {
      if (repair.gap > 0) {
        await tx.productBatch.create({
          data: {
            productId: repair.id,
            stock: repair.gap,
            batchNumber: buildRepairBatchNumber(repair.id),
            purchasePrice: repair.purchasePrice,
            expiryDate: repair.expiryDate,
            inDate: new Date(),
          },
        });
      } else {
        await tx.product.update({
          where: { id: repair.id },
          data: { stock: repair.activeBatchStock },
        });
      }
    });

    console.log(`- Repaired ${repair.name} (${repair.storeName}) | gap=${formatNumber(repair.gap)}`);
  }

  console.log("\nRepair completed.");
}

main()
  .catch((error) => {
    console.error("Repair failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
