import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";
import prisma from "@/lib/prisma";

export const GET = withAuth(
  async (request: NextRequest, session, storeId) => {
    try {
      const pathname = request.nextUrl.pathname;
      const segments = pathname.split("/");
      const supplierId = segments[segments.length - 2];

      if (!supplierId) {
        return NextResponse.json({ error: "ID supplier tidak valid" }, { status: 400 });
      }

      if (!storeId) {
        return NextResponse.json({ error: "Store ID tidak ditemukan" }, { status: 400 });
      }

      const returns = await prisma.purchaseReturn.findMany({
        where: {
          supplierId,
          storeId: storeId as string,
        },
        include: {
          purchaseOrder: {
            select: {
              id: true,
              poNumber: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      const formatted = returns.map((ret) => ({
        id: ret.id,
        totalAmount: ret.totalAmount,
        reason: ret.reason,
        notes: ret.notes,
        createdAt: ret.createdAt.toISOString(),
        poId: ret.purchaseOrder?.id,
        poNumber: ret.purchaseOrder?.poNumber || "Unknown",
      }));

      return NextResponse.json(formatted);
    } catch (error) {
      console.error(`GET /api/suppliers/[id]/purchase-returns error:`, error);
      return NextResponse.json({ error: "Terjadi kesalahan saat mengambil riwayat retur" }, { status: 500 });
    }
  },
  { requireStore: true },
);