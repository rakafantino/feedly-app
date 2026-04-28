import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const productQuery = process.argv.slice(2).join(" ").trim();

if (!productQuery) {
  console.error('Usage: npx ts-node --compiler-options \'{"module":"CommonJS"}\' scripts/audit-product-batch-gap.ts "<product name or id>"');
  process.exit(1);
}

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

function formatDate(value: Date | null | undefined): string {
  if (!value) {
    return "-";
  }

  return value.toISOString();
}

async function main() {
  console.log("\n=== Product Batch Gap Audit (READ ONLY) ===\n");
  console.log(`Query: ${productQuery}\n`);

  const product = await prisma.product.findFirst({
    where: {
      OR: [{ id: productQuery }, { name: { equals: productQuery, mode: "insensitive" } }, { name: { contains: productQuery, mode: "insensitive" } }],
    },
    include: {
      store: {
        select: {
          id: true,
          name: true,
        },
      },
      supplier: {
        select: {
          id: true,
          name: true,
        },
      },
      conversionTarget: {
        select: {
          id: true,
          name: true,
          stock: true,
          unit: true,
        },
      },
      convertedFrom: {
        select: {
          id: true,
          name: true,
          stock: true,
          unit: true,
          conversionRate: true,
        },
      },
      batches: {
        orderBy: [{ stock: "desc" }, { expiryDate: "asc" }, { inDate: "asc" }],
      },
    },
  });

  if (!product) {
    console.error("Product not found");
    return;
  }

  const positiveBatchStock = product.batches.filter((batch) => batch.stock > 0).reduce((sum, batch) => sum + batch.stock, 0);
  const totalBatchStock = product.batches.reduce((sum, batch) => sum + batch.stock, 0);
  const stockGap = product.stock - positiveBatchStock;

  console.log("Product");
  console.log(`- Store          : ${product.store.name} (${product.store.id})`);
  console.log(`- Product        : ${product.name}`);
  console.log(`- Product ID     : ${product.id}`);
  console.log(`- Unit           : ${product.unit}`);
  console.log(`- Product stock  : ${formatNumber(product.stock)}`);
  console.log(`- Active batches : ${formatNumber(positiveBatchStock)}`);
  console.log(`- All batches    : ${formatNumber(totalBatchStock)}`);
  console.log(`- Gap            : ${formatNumber(stockGap)}`);
  console.log(`- Supplier       : ${product.supplier?.name ?? "-"}`);
  console.log(`- Purchase price : ${formatNumber(product.purchase_price)}`);
  console.log(`- HPP price      : ${formatNumber(product.hpp_price)}`);
  console.log(`- Created at     : ${formatDate(product.createdAt)}`);
  console.log(`- Updated at     : ${formatDate(product.updatedAt)}`);

  if (product.conversionTarget) {
    console.log("\nConversion target");
    console.log(`- ${product.conversionTarget.name} | stock ${formatNumber(product.conversionTarget.stock)} ${product.conversionTarget.unit}`);
  }

  if (product.convertedFrom.length > 0) {
    console.log("\nConverted from");
    for (const parent of product.convertedFrom) {
      console.log(`- ${parent.name} | stock ${formatNumber(parent.stock)} ${parent.unit} | rate ${formatNumber(parent.conversionRate)}`);
    }
  }

  console.log("\nBatches");
  if (product.batches.length === 0) {
    console.log("- No batches found");
  } else {
    for (const batch of product.batches) {
      console.log(`- ${batch.id} | batch=${batch.batchNumber ?? "-"} | stock=${formatNumber(batch.stock)} | expiry=${formatDate(batch.expiryDate)} | in=${formatDate(batch.inDate)} | price=${formatNumber(batch.purchasePrice)}`);
    }
  }

  const recentAdjustments = await prisma.stockAdjustment.findMany({
    where: { productId: product.id },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: {
      batch: {
        select: {
          id: true,
          batchNumber: true,
        },
      },
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  console.log("\nRecent adjustments");
  if (recentAdjustments.length === 0) {
    console.log("- No adjustments found");
  } else {
    for (const adjustment of recentAdjustments) {
      console.log(
        `- ${formatDate(adjustment.createdAt)} | qty=${formatNumber(adjustment.quantity)} | type=${adjustment.type} | batch=${adjustment.batch?.batchNumber ?? adjustment.batchId ?? "-"} | by=${adjustment.createdBy?.name ?? adjustment.createdBy?.email ?? "-"} | reason=${adjustment.reason ?? "-"}`,
      );
    }
  }

  const recentSales = await prisma.transactionItem.findMany({
    where: { productId: product.id },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: {
      transaction: {
        select: {
          id: true,
          invoiceNumber: true,
          createdAt: true,
          storeId: true,
        },
      },
    },
  });

  console.log("\nRecent sales");
  if (recentSales.length === 0) {
    console.log("- No sales found");
  } else {
    for (const sale of recentSales) {
      console.log(
        `- ${formatDate(sale.transaction.createdAt)} | invoice=${sale.transaction.invoiceNumber ?? sale.transactionId} | qty=${formatNumber(sale.quantity)} | price=${formatNumber(sale.price)} | cost=${formatNumber(sale.cost_price)}`,
      );
    }
  }

  const salesAggregate = await prisma.transactionItem.aggregate({
    where: { productId: product.id },
    _sum: { quantity: true },
    _count: { id: true },
  });

  console.log("\nSales summary");
  console.log(`- Transaction count : ${salesAggregate._count.id}`);
  console.log(`- Total sold qty    : ${formatNumber(salesAggregate._sum.quantity)}`);

  const purchaseItems = await prisma.purchaseOrderItem.findMany({
    where: { productId: product.id },
    orderBy: { updatedAt: "desc" },
    take: 10,
    include: {
      purchaseOrder: {
        select: {
          id: true,
          poNumber: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          supplier: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  console.log("\nRecent PO receipts");
  if (purchaseItems.length === 0) {
    console.log("- No purchase order items found");
  } else {
    for (const item of purchaseItems) {
      console.log(
        `- ${formatDate(item.purchaseOrder.updatedAt)} | PO=${item.purchaseOrder.poNumber} | status=${item.purchaseOrder.status} | ordered=${formatNumber(item.quantity)} | received=${formatNumber(item.receivedQuantity)} | price=${formatNumber(item.price)} | supplier=${item.purchaseOrder.supplier.name}`,
      );
    }
  }

  const adjustmentAggregate = await prisma.stockAdjustment.aggregate({
    where: { productId: product.id },
    _sum: { quantity: true },
    _count: { id: true },
  });

  console.log("\nAdjustment summary");
  console.log(`- Adjustment count : ${adjustmentAggregate._count.id}`);
  console.log(`- Net qty          : ${formatNumber(adjustmentAggregate._sum.quantity)}`);

  const returnAggregate = await prisma.purchaseReturnItem.aggregate({
    where: { productId: product.id },
    _sum: { quantity: true },
    _count: { id: true },
  });

  console.log("\nPurchase return summary");
  console.log(`- Return count     : ${returnAggregate._count.id}`);
  console.log(`- Total return qty : ${formatNumber(returnAggregate._sum.quantity)}`);

  const sameStoreMismatches = await prisma.product.findMany({
    where: {
      storeId: product.storeId,
      isDeleted: false,
    },
    select: {
      id: true,
      name: true,
      stock: true,
      batches: {
        select: {
          stock: true,
        },
      },
    },
  });

  const mismatches = sameStoreMismatches
    .map((item) => {
      const activeBatchSum = item.batches.filter((batch) => batch.stock > 0).reduce((sum, batch) => sum + batch.stock, 0);

      return {
        id: item.id,
        name: item.name,
        productStock: item.stock,
        batchStock: activeBatchSum,
        gap: item.stock - activeBatchSum,
      };
    })
    .filter((item) => Math.abs(item.gap) > 0.0001)
    .sort((left, right) => Math.abs(right.gap) - Math.abs(left.gap))
    .slice(0, 10);

  console.log("\nTop mismatches in same store");
  if (mismatches.length === 0) {
    console.log("- No mismatched products found");
  } else {
    for (const mismatch of mismatches) {
      console.log(`- ${mismatch.name} | product=${formatNumber(mismatch.productStock)} | active batches=${formatNumber(mismatch.batchStock)} | gap=${formatNumber(mismatch.gap)} | id=${mismatch.id}`);
    }
  }

  console.log("\nDone.");
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
