import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";
import { getAllPurchaseReturns } from "@/services/purchase-return.service";

export const GET = withAuth(
  async (request: NextRequest, session, storeId) => {
    try {
      if (!storeId) {
        return NextResponse.json({ error: "Store ID diperlukan" }, { status: 400 });
      }

      const returns = await getAllPurchaseReturns(storeId);

      return NextResponse.json({ returns });
    } catch (error) {
      console.error("GET /api/purchase-returns error:", error);
      return NextResponse.json({ error: "Terjadi kesalahan saat mengambil data retur" }, { status: 500 });
    }
  },
  { requireStore: true },
);