import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-middleware";
import { purchaseOrderSchema } from "@/lib/validations/purchase-order";

// GET /api/purchase-orders
// Mengambil semua purchase orders
export const GET = withAuth(
  async (request: NextRequest, session, storeId) => {
    try {
      // Ambil parameter dari query string
      const { searchParams } = new URL(request.url);
      const status = searchParams.get("status");
      const limitParam = searchParams.get("limit");
      const fetchAll = limitParam === "all";
      const parsedLimit = limitParam ? parseInt(limitParam, 10) : 10;
      const limit = fetchAll || !Number.isFinite(parsedLimit) || parsedLimit <= 0 ? 10 : parsedLimit;
      const parsedPage = searchParams.get("page") ? parseInt(searchParams.get("page") as string, 10) : 1;
      const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
      const skip = (page - 1) * limit;

      // Buat filter
      const where: any = {};
      if (status && status !== "all") {
        where.status = status;
      }

      // Filter berdasarkan storeId
      if (storeId) {
        where.storeId = storeId;
      }

      try {
        // Ambil total count untuk pagination
        const totalCount = await prisma.purchaseOrder.count({ where });

        // Ambil purchase orders
        const purchaseOrders = await prisma.purchaseOrder.findMany({
          where,
          include: {
            supplier: {
              select: {
                name: true,
                phone: true,
              },
            },
            items: {
              include: {
                product: {
                  select: {
                    name: true,
                    unit: true,
                  },
                },
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          ...(fetchAll ? {} : { skip, take: limit }),
        });

        // Map data untuk frontend
        const formattedPOs = purchaseOrders.map((po) => ({
          id: po.id,
          poNumber: po.poNumber,
          supplierId: po.supplierId,
          supplierName: po.supplier.name,
          supplierPhone: po.supplier.phone,
          status: po.status,
          paymentStatus: po.paymentStatus,
          amountPaid: po.amountPaid,
          remainingAmount: po.remainingAmount,
          dueDate: po.dueDate ? po.dueDate.toISOString() : null,
          createdAt: po.createdAt.toISOString(),
          estimatedDelivery: po.estimatedDelivery ? po.estimatedDelivery.toISOString() : null,
          notes: po.notes,
          items: po.items.map((item) => ({
            id: item.id,
            productId: item.productId,
            productName: item.product.name,
            quantity: item.quantity,
            unit: item.unit,
            price: item.price,
          })),
        }));

        return NextResponse.json({
          purchaseOrders: formattedPOs,
          pagination: {
            total: totalCount,
            page: fetchAll ? 1 : page,
            limit: fetchAll ? totalCount : limit,
            pages: fetchAll ? 1 : Math.ceil(totalCount / limit),
          },
        });
      } catch (dbError) {
        console.error("Database error:", dbError);

        return NextResponse.json({ error: "Terjadi kesalahan saat mengambil data. Silakan coba lagi." }, { status: 500 });
      }
    } catch (error) {
      console.error("GET /api/purchase-orders error:", error);
      return NextResponse.json({ error: "Terjadi kesalahan saat mengambil data purchase orders" }, { status: 500 });
    }
  },
  { requireStore: true },
);

// POST /api/purchase-orders
// Membuat purchase order baru
export const POST = withAuth(
  async (request: NextRequest, session, storeId) => {
    try {
      // Pastikan storeId tersedia
      if (!storeId) {
        return NextResponse.json({ error: "Store ID diperlukan untuk membuat purchase order" }, { status: 400 });
      }

      const body = await request.json();

      const result = purchaseOrderSchema.safeParse(body);
      if (!result.success) {
        return NextResponse.json({ error: "Validasi gagal", details: result.error.flatten() }, { status: 400 });
      }

      const data = result.data;

      // Validasi bahwa supplier berada dalam toko yang sama
      const supplier = await prisma.supplier.findFirst({
        where: {
          id: data.supplierId,
          storeId,
        },
      });

      if (!supplier) {
        return NextResponse.json({ error: "Supplier tidak ditemukan atau tidak termasuk dalam toko Anda" }, { status: 400 });
      }

      // Validasi bahwa semua produk berada dalam toko yang sama (batch query instead of N+1)
      const productIds = data.items.map((item: { productId: string }) => item.productId);
      const validProducts = await prisma.product.findMany({
        where: {
          id: { in: productIds },
          storeId,
        },
        select: { id: true },
      });
      const foundIds = new Set(validProducts.map((p) => p.id));
      const missingId = productIds.find((id: string) => !foundIds.has(id));
      if (missingId) {
        return NextResponse.json({ error: `Produk dengan ID ${missingId} tidak ditemukan atau tidak termasuk dalam toko Anda` }, { status: 400 });
      }

      try {
        // Generate nomor PO
        // Format: PO-YYYYMMDD-XXX
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        const dateStr = `${year}${month}${day}`;

        // Cari PO terakhir untuk hari ini
        const lastPO = await prisma.purchaseOrder.findFirst({
          where: {
            poNumber: {
              startsWith: `PO-${dateStr}`,
            },
            storeId,
          },
          orderBy: {
            poNumber: "desc",
          },
        });

        // Tentukan nomor urut
        let sequence = 1;
        if (lastPO) {
          const lastSequence = parseInt(lastPO.poNumber.split("-")[2]);
          sequence = lastSequence + 1;
        }

        // Format nomor PO
        const poNumber = `PO-${dateStr}-${String(sequence).padStart(3, "0")}`;

        // Buat purchase order dengan items dalam satu transaksi
        const purchaseOrder = await prisma.$transaction(
          async (prisma) => {
            // Hitung total amount
            const totalAmount = data.items.reduce((acc: number, item: any) => acc + item.quantity * item.price, 0);

            let paymentStatus = data.paymentStatus || "UNPAID";
            const amountPaid = data.amountPaid || 0;
            let remainingAmount = totalAmount - amountPaid;

            // Validasi basic
            if (amountPaid >= totalAmount) {
              paymentStatus = "PAID";
              remainingAmount = 0;
            } else if (amountPaid > 0) {
              paymentStatus = "PARTIAL";
            }

            // Buat purchase order
            const po = await prisma.purchaseOrder.create({
              data: {
                poNumber,
                supplierId: data.supplierId,
                status: data.status || "draft",
                paymentStatus,
                amountPaid,
                remainingAmount,
                totalAmount,
                dueDate: data.dueDate ? new Date(data.dueDate) : null,
                estimatedDelivery: data.estimatedDelivery ? new Date(data.estimatedDelivery) : null,
                notes: data.notes,
                storeId: storeId,
              },
            });

            // Buat purchase order items
            for (const item of data.items) {
              await prisma.purchaseOrderItem.create({
                data: {
                  purchaseOrderId: po.id,
                  productId: item.productId,
                  quantity: item.quantity,
                  unit: item.unit || "pcs",
                  price: item.price,
                },
              });
            }

            return po;
          },
          {
            maxWait: 10000, // 10 seconds
            timeout: 30000, // 30 seconds
          },
        );

        return NextResponse.json({ purchaseOrder }, { status: 201 });
      } catch (dbError: any) {
        console.error("Database error:", dbError);

        if (dbError.code === "P2002") {
          return NextResponse.json({ error: "Nomor PO sudah digunakan. Silakan coba lagi." }, { status: 400 });
        }

        return NextResponse.json({ error: `Terjadi kesalahan database: ${dbError.message}` }, { status: 500 });
      }
    } catch (error) {
      console.error("POST /api/purchase-orders error:", error);
      return NextResponse.json({ error: "Terjadi kesalahan saat membuat purchase order" }, { status: 500 });
    }
  },
  { requireStore: true },
);
