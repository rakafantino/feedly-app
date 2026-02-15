import { NextRequest, NextResponse } from "next/server";
import { NotificationService } from "@/services/notification.service";
import prisma from "@/lib/db"; // Use raw connection to bypass RLS

export async function GET(request: NextRequest) {
  try {
    // 1. Verify Cron Secret
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // 2. Fetch all active stores
    const activeStores = await prisma.store.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    let totalStockChecked = 0;
    let totalExpiredChecked = 0;

    // 3. Process each store using raw prisma client (Bypassing RLS)
    for (const store of activeStores) {
      const stockResult = await NotificationService.checkLowStockProducts(store.id, prisma);
      await NotificationService.checkDebtDue(store.id, prisma);
      const expiredResult = await NotificationService.checkExpiredProducts(store.id, prisma);

      totalStockChecked += stockResult.count || 0;
      totalExpiredChecked += expiredResult.count || 0;
    }

    return NextResponse.json({
      success: true,
      processed: {
        stores: activeStores.length,
        stock: totalStockChecked,
        expired: totalExpiredChecked,
        debt: "checked",
      },
    });
  } catch (error) {
    console.error("Error running notification checks:", error);
    return NextResponse.json({ error: "Failed to run notification checks" }, { status: 500 });
  }
}
