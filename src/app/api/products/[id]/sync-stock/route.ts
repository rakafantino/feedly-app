
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-middleware";

export const POST = withAuth(async (req: NextRequest, session, storeId, { params }) => {
  try {
    const { id: productId } = await params;

    if (!productId) {
      return NextResponse.json({ error: "Product ID required" }, { status: 400 });
    }

    // 1. Get all batches
    const batches = await prisma.productBatch.findMany({
      where: { productId }
    });

    const totalBatchStock = batches.reduce((sum: number, b: any) => sum + b.stock, 0);

    // 2. Get current product stock
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { stock: true }
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // 3. Update if different
    if (product.stock !== totalBatchStock) {
      await prisma.product.update({
        where: { id: productId },
        data: { stock: totalBatchStock }
      });
      return NextResponse.json({ 
        message: "Stock synchronized", 
        previousStock: product.stock, 
        newStock: totalBatchStock 
      });
    }

    return NextResponse.json({ message: "Stock is already in sync" });

  } catch (error) {
    console.error("Error syncing stock:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}, { requireStore: true });
