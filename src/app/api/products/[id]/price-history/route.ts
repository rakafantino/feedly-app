import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-middleware";

export const GET = withAuth(async (request: NextRequest, session, storeId) => {
  try {
    const pathname = request.nextUrl.pathname;
    // Extract ID from /api/products/[id]/price-history
    const segments = pathname.split("/");
    const id = segments[segments.length - 2];

    const history = await prisma.priceHistory.findMany({
      where: { productId: id, storeId: storeId! },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ history });
  } catch {
    return NextResponse.json({ error: "Failed to fetch price history" }, { status: 500 });
  }
}, { requireStore: true });