
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";
import { inventoryService } from "@/services/inventory.service";

export const GET = withAuth(async (req: NextRequest, session, storeId) => {
  try {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get("mode") || "valuation";
    const days = parseInt(searchParams.get("days") || "30");

    let data;

    if (mode === "dead_stock") {
      data = await inventoryService.getDeadStock(storeId!, days);
    } else {
      data = await inventoryService.getInventoryValuation(storeId!);
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching inventory valuation:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}, { requireStore: true });
