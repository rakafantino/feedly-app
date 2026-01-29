
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { purchaseReportService } from "@/services/purchase-report.service";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const storeId = searchParams.get("storeId") || session.user?.storeId;
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    if (!storeId) {
      return NextResponse.json({ error: "Store ID required" }, { status: 400 });
    }

    // Default to current month if not provided
    const today = new Date();
    // Helper to parse YYYY-MM-DD as local date
    const parseLocalDate = (dateStr: string | null, defaultDate: Date) => {
        if (!dateStr) return defaultDate;
        if (dateStr.includes('T')) return new Date(dateStr);
        const [y, m, d] = dateStr.split('-').map(Number);
        return new Date(y, m - 1, d); // Local midnight
    };

    const startDate = parseLocalDate(startDateParam, new Date(today.getFullYear(), today.getMonth(), 1));
    const endDate = parseLocalDate(endDateParam, new Date(today.getFullYear(), today.getMonth() + 1, 0));

    // Adjust endDate to end of day if it's just a date string (no time)
    if (endDateParam && !endDateParam.includes("T")) {
        endDate.setHours(23, 59, 59, 999);
    }

    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");

    const data = await purchaseReportService.getPurchaseReport(storeId, startDate, endDate, page, limit);

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching purchase report:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
