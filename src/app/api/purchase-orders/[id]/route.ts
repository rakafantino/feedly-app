import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/api-middleware';
import { purchaseOrderUpdateSchema } from '@/lib/validations/purchase-order';

// GET /api/purchase-orders/[id]
// Mengambil detail purchase order berdasarkan ID
export const GET = withAuth(async (request: NextRequest, session, storeId) => {
  try {
    const pathname = request.nextUrl.pathname;
    const purchaseOrderId = pathname.split('/').pop();

    if (!purchaseOrderId) {
      return NextResponse.json(
        { error: "ID Purchase order tidak valid" },
        { status: 400 }
      );
    }

    try {
      // Ambil data dari database
      const purchaseOrder = await prisma.purchaseOrder.findUnique({
        where: { 
          id: purchaseOrderId,
          ...(storeId ? { storeId } : {})
        },
        include: {
          supplier: true,
          items: {
            include: {
              product: true
            }
          }
        }
      });

      if (!purchaseOrder) {
        return NextResponse.json(
          { error: "Purchase order tidak ditemukan" },
          { status: 404 }
        );
      }

      // Format data untuk frontend
      const formattedPO = {
        id: purchaseOrder.id,
        poNumber: purchaseOrder.poNumber,
        supplierId: purchaseOrder.supplierId,
        supplier: {
          id: purchaseOrder.supplier.id,
          name: purchaseOrder.supplier.name,
          phone: purchaseOrder.supplier.phone || '',
          address: purchaseOrder.supplier.address || '',
          email: purchaseOrder.supplier.email || null
        },
        supplierName: purchaseOrder.supplier.name,
        supplierPhone: purchaseOrder.supplier.phone || null,
        status: purchaseOrder.status,
        createdAt: purchaseOrder.createdAt.toISOString(),
        estimatedDelivery: purchaseOrder.estimatedDelivery ? purchaseOrder.estimatedDelivery.toISOString() : null,
        notes: purchaseOrder.notes,
        items: purchaseOrder.items.map((item) => ({
          id: item.id,
          productId: item.productId,
          productName: item.product.name,
          quantity: item.quantity,
          unit: item.unit,
          price: item.price
        }))
      };

      return NextResponse.json({ purchaseOrder: formattedPO });
    } catch (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json(
        { error: 'Terjadi kesalahan database' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error(`GET /api/purchase-orders/[id] error:`, error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mengambil data purchase order' },
      { status: 500 }
    );
  }
}, { requireStore: true });

// PUT /api/purchase-orders/[id]
// Mengupdate purchase order berdasarkan ID
export const PUT = withAuth(async (request: NextRequest, session, storeId) => {
  try {
    const pathname = request.nextUrl.pathname;
    const purchaseOrderId = pathname.split('/').pop();

    if (!purchaseOrderId) {
      return NextResponse.json(
        { error: "ID Purchase order tidak valid" },
        { status: 400 }
      );
    }

    const body = await request.json();
    
    // Validasi input
    const result = purchaseOrderUpdateSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Validasi gagal", details: result.error.flatten() },
        { status: 400 }
      );
    }
    
    const data = result.data;

    try {
      // Cek apakah PO ada dan milik toko yang sama
      const existingPO = await prisma.purchaseOrder.findUnique({
        where: { 
          id: purchaseOrderId,
          ...(storeId ? { storeId } : {})
        }
      });

      if (!existingPO) {
        return NextResponse.json(
          { error: "Purchase order tidak ditemukan" },
          { status: 404 }
        );
      }

      // Update PO
      const updatedPO = await prisma.purchaseOrder.update({
        where: { id: purchaseOrderId },
        data: {
          ...(data.status && { status: data.status }),
          ...(data.notes !== undefined && { notes: data.notes }),
          ...(data.estimatedDelivery !== undefined && { 
            estimatedDelivery: data.estimatedDelivery ? new Date(data.estimatedDelivery) : null 
          })
        },
        include: {
          supplier: true,
          items: {
            include: {
              product: true
            }
          }
        }
      });

      // Format data untuk frontend
      const formattedPO = {
        id: updatedPO.id,
        poNumber: updatedPO.poNumber,
        supplierId: updatedPO.supplierId,
        supplier: {
          id: updatedPO.supplier.id,
          name: updatedPO.supplier.name,
          phone: updatedPO.supplier.phone || '',
          address: updatedPO.supplier.address || '',
          email: updatedPO.supplier.email || null
        },
        supplierName: updatedPO.supplier.name,
        supplierPhone: updatedPO.supplier.phone || null,
        status: updatedPO.status,
        createdAt: updatedPO.createdAt.toISOString(),
        estimatedDelivery: updatedPO.estimatedDelivery ? updatedPO.estimatedDelivery.toISOString() : null,
        notes: updatedPO.notes,
        items: updatedPO.items.map((item) => ({
          id: item.id,
          productId: item.productId,
          productName: item.product.name,
          quantity: item.quantity,
          unit: item.unit,
          price: item.price
        }))
      };

      return NextResponse.json({ purchaseOrder: formattedPO });
    } catch (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json(
        { error: 'Terjadi kesalahan saat memperbarui purchase order' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error(`PUT /api/purchase-orders/[id] error:`, error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat memperbarui purchase order' },
      { status: 500 }
    );
  }
}, { requireStore: true });

// DELETE /api/purchase-orders/[id]
// Menghapus purchase order berdasarkan ID
export const DELETE = withAuth(async (request: NextRequest, session, storeId) => {
  try {
    const pathname = request.nextUrl.pathname;
    const purchaseOrderId = pathname.split('/').pop();

    if (!purchaseOrderId) {
      return NextResponse.json(
        { error: "ID Purchase order tidak valid" },
        { status: 400 }
      );
    }

    try {
      // Cek apakah PO ada dan milik toko
      const existingPO = await prisma.purchaseOrder.findUnique({
        where: { 
          id: purchaseOrderId,
          ...(storeId ? { storeId } : {})
        }
      });

      if (!existingPO) {
        return NextResponse.json(
          { error: "Purchase order tidak ditemukan" },
          { status: 404 }
        );
      }

      // Hapus PO
      await prisma.purchaseOrder.delete({
        where: { id: purchaseOrderId }
      });

      return NextResponse.json(
        { message: "Purchase order berhasil dihapus" },
        { status: 200 }
      );
    } catch (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json(
        { error: 'Terjadi kesalahan saat menghapus purchase order' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error(`DELETE /api/purchase-orders/[id] error:`, error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat menghapus purchase order' },
      { status: 500 }
    );
  }
}, { requireStore: true }); 