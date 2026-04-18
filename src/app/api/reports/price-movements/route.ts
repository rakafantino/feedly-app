import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-middleware";

export const GET = withAuth(async (request: NextRequest, session, storeId) => {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50;
    const priceType = searchParams.get('priceType');

    const where: any = { storeId: storeId! };
    if (priceType && priceType !== 'ALL') {
      where.priceType = priceType;
    }

    const history = await prisma.priceHistory.findMany({
      where,
      include: {
        product: { select: { name: true, product_code: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    return NextResponse.json({ history });
  } catch {
    return NextResponse.json({ error: "Failed to fetch price movements" }, { status: 500 });
  }
}, { requireStore: true });