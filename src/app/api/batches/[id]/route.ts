import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";
import prisma from "@/lib/prisma";

export const PATCH = withAuth(async (req: NextRequest, session: any, storeId: string | null, { params }: { params: { id: string } }) => {
  try {
    const { id } = params;
    const { batchNumber, expiryDate } = await req.json();

    if (!id) {
      return NextResponse.json({ error: "Batch ID diperlukan" }, { status: 400 });
    }

    if (!storeId) {
      return NextResponse.json({ error: "Store ID diperlukan" }, { status: 400 });
    }

    // Verify the batch belongs to a product in the current user's store
    const existingBatch = await prisma.productBatch.findFirst({
      where: {
        id,
        product: {
          storeId: storeId
        }
      }
    });

    if (!existingBatch) {
      return NextResponse.json({ error: "Batch tidak ditemukan atau Anda tidak memiliki akses" }, { status: 404 });
    }

    // Prepare update data
    const updateData: any = {};
    if (batchNumber !== undefined) updateData.batchNumber = batchNumber;
    if (expiryDate !== undefined) updateData.expiryDate = expiryDate ? new Date(expiryDate) : null;

    // Update the batch
    const updatedBatch = await prisma.productBatch.update({
      where: { id },
      data: updateData,
    });

    // Option: Sync latest expiry date to product if this is the newest batch
    // We update the product's global expiry_date if it's the only one or the closest one?
    // For simplicity, we just update the batch. The global product expiry_date is usually set 
    // to the earliest expiry by some background process or left as-is for legacy display.
    // Given the dilemma, leaving it decoupled is safest for now unless user requests auto-sync.

    return NextResponse.json(updatedBatch);
  } catch (error: any) {
    console.error("Error updating batch:", error);
    return NextResponse.json({ error: "Terjadi kesalahan internal peladen", details: error.message }, { status: 500 });
  }
}, { requireStore: true });
