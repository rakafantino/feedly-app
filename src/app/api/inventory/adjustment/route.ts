import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";
import prisma from "@/lib/prisma";
import { NotificationService } from "@/services/notification.service";
import { BatchService } from "@/services/batch.service";
import { assertProductStockIntegrity, getProductStockIntegrity } from "@/lib/stock-integrity";

/**
 * POST /api/inventory/adjustment
 * Record a stock adjustment (Waste, Damaged, Correction)
 */
export const POST = withAuth(
  async (req: NextRequest, session: any, storeId: string | null) => {
    try {
      if (!storeId) {
        return NextResponse.json({ error: "Store selection required" }, { status: 400 });
      }

      const { productId, batchId, quantity, type, reason } = await req.json();

      if (!productId || !type || quantity === 0) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
      }

      if (typeof quantity !== "number" || Number.isNaN(quantity)) {
        return NextResponse.json({ error: "Quantity must be a valid number" }, { status: 400 });
      }

      const product = await prisma.product.findFirst({
        where: { id: productId, storeId },
      });

      if (!product) {
        return NextResponse.json({ error: "Product not found" }, { status: 404 });
      }

      if (!(await getProductStockIntegrity(prisma, productId))) {
        return NextResponse.json({ error: "Product not found" }, { status: 404 });
      }

      if (quantity < 0) {
        try {
          await assertProductStockIntegrity(prisma, productId);
        } catch (error) {
          return NextResponse.json({ error: error instanceof Error ? error.message : "Stock mismatch detected" }, { status: 409 });
        }
      }

      let batch = null;
      if (batchId) {
        batch = await prisma.productBatch.findFirst({
          where: { id: batchId, productId },
        });
        if (!batch) {
          return NextResponse.json({ error: "Batch not found" }, { status: 404 });
        }

        if (quantity < 0 && batch.stock + quantity < 0) {
          return NextResponse.json({ error: "Insufficient batch stock" }, { status: 400 });
        }
      } else {
        if (quantity < 0) {
          return NextResponse.json({ error: "Batch selection is required for stock deduction. Please repair or sync stock batches first if no active batch is available." }, { status: 400 });
        }
      }

      let costPrice = 0;
      if (batch && batch.purchasePrice) {
        costPrice = batch.purchasePrice;
      } else if (product.purchase_price) {
        costPrice = product.purchase_price;
      }

      const result = await prisma.$transaction(async (tx) => {
        let adjustmentBatchId = batchId as string | null;

        if (batchId) {
          await tx.productBatch.update({
            where: { id: batchId },
            data: { stock: { increment: quantity } },
          });
          await tx.product.update({
            where: { id: productId },
            data: { stock: { increment: quantity } },
          });
        } else {
          const createdBatch = await BatchService.addGenericBatch(productId, quantity, tx);
          adjustmentBatchId = createdBatch.id;
        }

        const adjustment = await tx.stockAdjustment.create({
          data: {
            storeId,
            productId,
            batchId: adjustmentBatchId,
            quantity,
            type,
            reason,
            costPerUnit: costPrice,
            totalValue: quantity * costPrice,
            createdById: session.user.id,
          },
        });

        return adjustment;
      });

      setTimeout(async () => {
        try {
          await NotificationService.checkExpiredProducts(storeId);
          await NotificationService.checkLowStockProducts(storeId);
        } catch (e) {
          console.error("Post-adjustment check failed", e);
        }
      }, 100);

      return NextResponse.json({ success: true, data: result });
    } catch (error) {
      console.error("[API] Stock Adjustment Error:", error);
      return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
  },
  { requireStore: true },
);
