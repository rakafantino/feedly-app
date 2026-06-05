import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-middleware";

export const GET = withAuth(async (request: NextRequest, session, storeId) => {
  try {
    const pathname = request.nextUrl.pathname;
    const segments = pathname.split("/");
    const id = segments[segments.length - 2];

    const history = await prisma.priceHistory.findMany({
      where: { productId: id, storeId: storeId! },
      orderBy: { createdAt: 'desc' }
    });

    // Manually enrich the history with PO Supplier names based on referenceId
    const enrichedHistory = await Promise.all(history.map(async (item) => {
      let purchaseOrder = null;
      if (item.source === "SYSTEM_RECEIVE" && item.referenceId) {
        purchaseOrder = await prisma.purchaseOrder.findUnique({
          where: { id: item.referenceId },
          include: { supplier: { select: { name: true } } }
        });
      }
      return {
        ...item,
        purchaseOrder
      };
    }));

    return NextResponse.json({ history: enrichedHistory });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch price history" }, { status: 500 });
  }
}, { requireStore: true });