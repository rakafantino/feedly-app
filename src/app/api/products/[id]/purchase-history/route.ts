import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-middleware";

function parsePositiveInt(value: string | null, defaultValue: number, maxValue?: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return defaultValue;
  return maxValue ? Math.min(parsed, maxValue) : parsed;
}

export const GET = withAuth(
  async (request: NextRequest, session, storeId) => {
    try {
      const segments = request.nextUrl.pathname.split("/");
      const productId = segments[segments.length - 2];

      if (!productId) {
        return NextResponse.json({ error: "ID produk tidak valid" }, { status: 400 });
      }

      const product = await prisma.product.findFirst({
        where: { id: productId, isDeleted: false, storeId: storeId! },
        select: { id: true },
      });

      if (!product) {
        return NextResponse.json({ error: "Produk tidak ditemukan" }, { status: 404 });
      }

      const { searchParams } = new URL(request.url);
      const page = parsePositiveInt(searchParams.get("page"), 1);
      const limit = parsePositiveInt(searchParams.get("limit"), 10, 100);
      const skip = (page - 1) * limit;
      const where = {
        productId,
        purchaseOrder: {
          storeId: storeId!,
        },
      };

      const [total, items, summaryItems] = await Promise.all([
        prisma.purchaseOrderItem.count({ where }),
        prisma.purchaseOrderItem.findMany({
          where,
          select: {
            id: true,
            quantity: true,
            receivedQuantity: true,
            unit: true,
            price: true,
            purchaseOrder: {
              select: {
                id: true,
                poNumber: true,
                status: true,
                paymentStatus: true,
                createdAt: true,
                estimatedDelivery: true,
                supplier: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
          orderBy: {
            purchaseOrder: {
              createdAt: "desc",
            },
          },
          skip,
          take: limit,
        }),
        prisma.purchaseOrderItem.findMany({
          where,
          select: {
            quantity: true,
            receivedQuantity: true,
            price: true,
            purchaseOrderId: true,
          },
        }),
      ]);

      const history = items.map((item) => ({
        id: item.id,
        purchaseOrderId: item.purchaseOrder.id,
        poNumber: item.purchaseOrder.poNumber,
        supplierName: item.purchaseOrder.supplier.name,
        status: item.purchaseOrder.status,
        paymentStatus: item.purchaseOrder.paymentStatus,
        createdAt: item.purchaseOrder.createdAt.toISOString(),
        estimatedDelivery: item.purchaseOrder.estimatedDelivery?.toISOString() ?? null,
        quantityOrdered: item.quantity,
        receivedQuantity: item.receivedQuantity,
        unit: item.unit,
        unitPrice: item.price,
        lineTotal: item.quantity * item.price,
      }));

      const summary = summaryItems.reduce(
        (acc, item) => {
          acc.totalOrdered += item.quantity;
          acc.totalReceived += item.receivedQuantity;
          acc.totalAmount += item.quantity * item.price;
          acc.purchaseOrderIds.add(item.purchaseOrderId);
          return acc;
        },
        {
          totalOrdered: 0,
          totalReceived: 0,
          totalAmount: 0,
          purchaseOrderIds: new Set<string>(),
        },
      );

      return NextResponse.json({
        history,
        summary: {
          totalOrdered: summary.totalOrdered,
          totalReceived: summary.totalReceived,
          totalAmount: summary.totalAmount,
          totalPurchaseOrders: summary.purchaseOrderIds.size,
        },
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("GET /api/products/[id]/purchase-history error:", error);
      return NextResponse.json({ error: "Terjadi kesalahan saat mengambil riwayat PO produk" }, { status: 500 });
    }
  },
  { requireStore: true },
);
