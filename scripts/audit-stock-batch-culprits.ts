import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const query = process.argv.slice(2).join(" ").trim();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

type CulpritTypeTotals = Record<string, { count: number; qty: number }>;

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "-";
  }

  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  }).format(value);
}

function formatDate(value: Date | null | undefined): string {
  if (!value) {
    return "-";
  }

  return value.toISOString();
}

function summarizeTypes(items: Array<{ type: string; quantity: number }>): CulpritTypeTotals {
  return items.reduce<CulpritTypeTotals>((accumulator, item) => {
    const current = accumulator[item.type] ?? { count: 0, qty: 0 };
    current.count += 1;
    current.qty += item.quantity;
    accumulator[item.type] = current;
    return accumulator;
  }, {});
}

function formatTypeSummary(summary: CulpritTypeTotals): string {
  const entries = Object.entries(summary);

  if (entries.length === 0) {
    return "-";
  }

  return entries
    .sort((left, right) => Math.abs(right[1].qty) - Math.abs(left[1].qty))
    .map(([type, stats]) => `${type}: qty=${formatNumber(stats.qty)} (${stats.count}x)`)
    .join(" | ");
}

async function resolveStoreId(): Promise<string | null> {
  if (!query) {
    return null;
  }

  const store = await prisma.store.findFirst({
    where: {
      OR: [{ id: query }, { name: { equals: query, mode: "insensitive" } }, { name: { contains: query, mode: "insensitive" } }],
    },
    select: { id: true },
  });

  return store?.id ?? null;
}

async function main() {
  console.log("\n=== Stock vs Batch Culprit Audit (READ ONLY) ===\n");

  const storeId = await resolveStoreId();

  if (query && !storeId) {
    console.log(`Store query not found, fallback to all stores: ${query}\n`);
  } else if (storeId) {
    console.log(`Filtering store: ${query}\n`);
  }

  const products = await prisma.product.findMany({
    where: {
      isDeleted: false,
      ...(storeId ? { storeId } : {}),
    },
    include: {
      store: {
        select: {
          id: true,
          name: true,
        },
      },
      batches: {
        select: {
          id: true,
          stock: true,
        },
      },
      conversionTarget: {
        select: {
          id: true,
          name: true,
        },
      },
      convertedFrom: {
        select: {
          id: true,
          name: true,
          conversionRate: true,
        },
      },
    },
  });

  const mismatches = products
    .map((product) => {
      const activeBatchStock = product.batches.filter((batch) => batch.stock > 0).reduce((sum, batch) => sum + batch.stock, 0);

      return {
        id: product.id,
        name: product.name,
        unit: product.unit,
        storeId: product.storeId,
        storeName: product.store.name,
        productStock: product.stock,
        activeBatchStock,
        gap: product.stock - activeBatchStock,
        batchCount: product.batches.length,
        activeBatchCount: product.batches.filter((batch) => batch.stock > 0).length,
        updatedAt: product.updatedAt,
        createdAt: product.createdAt,
        conversionTarget: product.conversionTarget,
        convertedFrom: product.convertedFrom,
      };
    })
    .filter((product) => Math.abs(product.gap) > 0.0001)
    .sort((left, right) => Math.abs(right.gap) - Math.abs(left.gap));

  console.log(`Products checked : ${products.length}`);
  console.log(`Mismatches found : ${mismatches.length}\n`);

  if (mismatches.length === 0) {
    console.log("No stock/batch mismatches found.");
    return;
  }

  const mismatchIds = mismatches.map((product) => product.id);

  const adjustments = await prisma.stockAdjustment.findMany({
    where: {
      productId: { in: mismatchIds },
    },
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });

  const adjustmentsByProduct = new Map<string, typeof adjustments>();
  for (const adjustment of adjustments) {
    const list = adjustmentsByProduct.get(adjustment.productId) ?? [];
    list.push(adjustment);
    adjustmentsByProduct.set(adjustment.productId, list);
  }

  const reports = mismatches.map((product) => {
    const productAdjustments = adjustmentsByProduct.get(product.id) ?? [];
    const nullBatchAdjustments = productAdjustments.filter((adjustment) => adjustment.batchId === null);
    const withBatchAdjustments = productAdjustments.filter((adjustment) => adjustment.batchId !== null);

    const nullBatchNet = nullBatchAdjustments.reduce((sum, adjustment) => sum + adjustment.quantity, 0);
    const withBatchNet = withBatchAdjustments.reduce((sum, adjustment) => sum + adjustment.quantity, 0);
    const suspectScore = Math.abs(Math.abs(product.gap) - Math.abs(nullBatchNet));

    return {
      ...product,
      nullBatchCount: nullBatchAdjustments.length,
      nullBatchNet,
      nullBatchTypes: summarizeTypes(
        nullBatchAdjustments.map((adjustment) => ({
          type: adjustment.type,
          quantity: adjustment.quantity,
        })),
      ),
      withBatchCount: withBatchAdjustments.length,
      withBatchNet,
      recentNullBatchAdjustments: nullBatchAdjustments.slice(0, 5),
      suspectScore,
    };
  });

  const likelyCulprits = reports
    .filter((report) => report.nullBatchCount > 0)
    .sort((left, right) => {
      if (left.suspectScore !== right.suspectScore) {
        return left.suspectScore - right.suspectScore;
      }

      return Math.abs(right.nullBatchNet) - Math.abs(left.nullBatchNet);
    });

  console.log("Likely culprits (mismatch correlated with null-batch adjustments)");
  if (likelyCulprits.length === 0) {
    console.log("- No mismatched products have null-batch adjustments recorded");
  } else {
    for (const report of likelyCulprits.slice(0, 15)) {
      console.log(
        `- ${report.name} | store=${report.storeName} | gap=${formatNumber(report.gap)} | null-batch net=${formatNumber(report.nullBatchNet)} | null-batch count=${report.nullBatchCount} | types=${formatTypeSummary(report.nullBatchTypes)}`,
      );
    }
  }

  console.log("\nDetailed mismatch reports");
  for (const report of reports.slice(0, 20)) {
    console.log(`\n[${report.storeName}] ${report.name}`);
    console.log(`- Product ID         : ${report.id}`);
    console.log(`- Stock              : ${formatNumber(report.productStock)} ${report.unit}`);
    console.log(`- Active batch stock : ${formatNumber(report.activeBatchStock)} ${report.unit}`);
    console.log(`- Gap                : ${formatNumber(report.gap)} ${report.unit}`);
    console.log(`- Batch count        : ${report.batchCount} total / ${report.activeBatchCount} active`);
    console.log(`- Created at         : ${formatDate(report.createdAt)}`);
    console.log(`- Updated at         : ${formatDate(report.updatedAt)}`);
    console.log(`- Null-batch adj     : ${report.nullBatchCount} rows | net ${formatNumber(report.nullBatchNet)}`);
    console.log(`- With-batch adj     : ${report.withBatchCount} rows | net ${formatNumber(report.withBatchNet)}`);
    console.log(`- Null-batch types   : ${formatTypeSummary(report.nullBatchTypes)}`);

    if (report.convertedFrom.length > 0) {
      const parents = report.convertedFrom.map((parent) => `${parent.name} (rate ${formatNumber(parent.conversionRate)})`).join(" | ");
      console.log(`- Converted from     : ${parents}`);
    }

    if (report.conversionTarget) {
      console.log(`- Conversion target  : ${report.conversionTarget.name}`);
    }

    if (report.recentNullBatchAdjustments.length > 0) {
      console.log("- Recent null-batch adjustments:");
      for (const adjustment of report.recentNullBatchAdjustments) {
        console.log(`  ${formatDate(adjustment.createdAt)} | type=${adjustment.type} | qty=${formatNumber(adjustment.quantity)} | by=${adjustment.createdBy?.name ?? adjustment.createdBy?.email ?? "-"} | reason=${adjustment.reason ?? "-"}`);
      }
    }
  }
}

main()
  .catch((error) => {
    console.error("Audit failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
