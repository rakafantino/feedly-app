import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session || !session.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Try to get storeId from session or cookie
        // Prioritize session storeId if available (robustness), then cookie
        let storeId = session.user.storeId;

        if (!storeId) {
            // Read from server-side cookie (HttpOnly cookies are accessible here)
            storeId = request.cookies.get("selectedStoreId")?.value || null;
        }

        if (!storeId) {
            return NextResponse.json({ error: "No active store selected" }, { status: 404 });
        }

        const store = await prisma.store.findUnique({
            where: { id: storeId },
            select: {
                id: true,
                name: true,
                address: true,
                phone: true,
                email: true,
                description: true,
            }
        });

        if (!store) {
            return NextResponse.json({ error: "Store not found" }, { status: 404 });
        }

        return NextResponse.json({ store });
    } catch (error) {
        console.error("Error fetching active store:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
