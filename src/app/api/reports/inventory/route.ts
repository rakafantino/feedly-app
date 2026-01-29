
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { inventoryService } from "@/services/inventory.service";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const storeId = searchParams.get("storeId") || session.user?.storeId;

    if (!storeId) {
      return NextResponse.json({ error: "Store ID required" }, { status: 400 });
    }

    const mode = searchParams.get("mode") || "valuation";
    const days = parseInt(searchParams.get("days") || "30");

    let data;

    if (mode === "dead_stock") {
      data = await inventoryService.getDeadStock(storeId, days);
    } else {
      data = await inventoryService.getInventoryValuation(storeId);
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching inventory valuation:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
