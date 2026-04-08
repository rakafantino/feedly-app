import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-middleware";
import { z } from "zod";
import { createPurchaseReturn, getPurchaseReturnsByPO } from "@/services/purchase-return.service";

const purchaseReturnItemSchema = z.object({
  productId: z.string(),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
});

const createPurchaseReturnSchema = z.object({
  reason: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(purchaseReturnItemSchema).min(1),
});

export const POST = withAuth(
  async (request: NextRequest, session, storeId) => {
    try {
      const pathname = request.nextUrl.pathname;
      const segments = pathname.split("/");
      const purchaseOrderId = segments[3];

      if (!purchaseOrderId) {
        return NextResponse.json({ error: "ID Purchase order tidak valid" }, { status: 400 });
      }

      const body = await request.json();
      const result = createPurchaseReturnSchema.safeParse(body);
      if (!result.success) {
        return NextResponse.json({ error: "Validasi gagal", details: result.error.flatten() }, { status: 400 });
      }

      const existingPO = await prisma.purchaseOrder.findFirst({
        where: { id: purchaseOrderId, storeId: storeId! },
        include: { items: true, supplier: true },
      });

      if (!existingPO) {
        return NextResponse.json({ error: "Purchase order tidak ditemukan" }, { status: 404 });
      }

      if (!["received", "partially_received"].includes(existingPO.status)) {
        return NextResponse.json(
          {
            error: "PO tidak bisa diretur. Status harus 'Diterima' atau 'Diterima Sebagian'",
          },
          { status: 400 },
        );
      }

      for (const returnItem of result.data.items) {
        const poItem = existingPO.items.find((i) => i.productId === returnItem.productId);
        if (!poItem) {
          return NextResponse.json(
            {
              error: `Produk tidak ditemukan di PO: ${returnItem.productId}`,
            },
            { status: 400 },
          );
        }
        const receivedQty = poItem.receivedQuantity || 0;
        if (returnItem.quantity > receivedQty) {
          return NextResponse.json(
            {
              error: `Jumlah retur (${returnItem.quantity}) melebihi jumlah diterima (${receivedQty}) untuk produk ${poItem.productId}`,
            },
            { status: 400 },
          );
        }
      }

      const purchaseReturn = await createPurchaseReturn({
        purchaseOrderId,
        supplierId: existingPO.supplierId,
        storeId: storeId!,
        reason: result.data.reason,
        notes: result.data.notes,
        createdById: session.user.id,
        items: result.data.items,
      });

      return NextResponse.json({ purchaseReturn }, { status: 201 });
    } catch (error) {
      console.error("POST /api/purchase-orders/[id]/return error:", error);
      return NextResponse.json({ error: "Terjadi kesalahan saat memproses retur" }, { status: 500 });
    }
  },
  { requireStore: true },
);

export const GET = withAuth(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async (request: NextRequest, _session, _storeId) => {
    try {
      const pathname = request.nextUrl.pathname;
      const segments = pathname.split("/");
      const purchaseOrderId = segments[3];

      if (!purchaseOrderId) {
        return NextResponse.json({ error: "ID Purchase order tidak valid" }, { status: 400 });
      }

      const returns = await getPurchaseReturnsByPO(purchaseOrderId);

      return NextResponse.json({ returns });
    } catch (error) {
      console.error("GET /api/purchase-orders/[id]/return error:", error);
      return NextResponse.json({ error: "Terjadi kesalahan saat mengambil data retur" }, { status: 500 });
    }
  },
  { requireStore: true },
);
