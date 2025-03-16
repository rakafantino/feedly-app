import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

// Dummy PO data untuk testing dan fallback
const dummyPurchaseOrders = [
  {
    id: 'po-1',
    poNumber: 'PO-20230425-001',
    supplierId: 'supp-1',
    supplierName: 'PT Pakan Ternak Sejahtera',
    supplierPhone: '081234567890',
    status: 'processing',
    createdAt: new Date().toISOString(),
    estimatedDelivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    notes: 'Tolong dikirim secepatnya',
    items: [
      {
        id: 'item-1',
        productId: 'prod-1',
        productName: 'Pakan Ayam Premium',
        quantity: 20,
        unit: 'karung',
        price: 320000
      },
      {
        id: 'item-2',
        productId: 'prod-2',
        productName: 'Vitamin Ternak',
        quantity: 5,
        unit: 'botol',
        price: 150000
      }
    ]
  },
  {
    id: 'po-2',
    poNumber: 'PO-20230423-001',
    supplierId: 'supp-2',
    supplierName: 'CV Makmur Pakan',
    supplierPhone: '082345678901',
    status: 'sent',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    estimatedDelivery: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    notes: null,
    items: [
      {
        id: 'item-3',
        productId: 'prod-3',
        productName: 'Pakan Sapi Perah',
        quantity: 10,
        unit: 'karung',
        price: 275000
      }
    ]
  },
  {
    id: 'po-3',
    poNumber: 'PO-20230415-001',
    supplierId: 'supp-1',
    supplierName: 'PT Pakan Ternak Sejahtera',
    supplierPhone: '081234567890',
    status: 'completed',
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    estimatedDelivery: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    notes: null,
    items: [
      {
        id: 'item-4',
        productId: 'prod-1',
        productName: 'Pakan Ayam Premium',
        quantity: 15,
        unit: 'karung',
        price: 320000
      }
    ]
  }
];

// GET /api/purchase-orders/[id]
// Mengambil detail purchase order berdasarkan ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<any> }
) {
  try {
    const session = await auth();
    
    if (!session) {
      return NextResponse.json(
        { error: "Tidak memiliki akses" },
        { status: 401 }
      );
    }

    // Penanganan context.params yang mungkin Promise di Next.js terbaru
    const resolvedParams = await params;
    const purchaseOrderId = resolvedParams?.id;

    if (!purchaseOrderId) {
      return NextResponse.json(
        { error: "ID Purchase order tidak valid" },
        { status: 400 }
      );
    }

    try {
      // Coba ambil data dari database
      const purchaseOrder = await (prisma as any).purchaseOrder.findUnique({
        where: { id: purchaseOrderId },
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
        items: purchaseOrder.items.map((item: any) => ({
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
      
      // Fallback ke dummy data
      const purchaseOrder = dummyPurchaseOrders.find(po => po.id === purchaseOrderId);

      if (!purchaseOrder) {
        return NextResponse.json(
          { error: "Purchase order tidak ditemukan" },
          { status: 404 }
        );
      }

      return NextResponse.json({ 
        purchaseOrder,
        usingDummyData: true 
      });
    }
  } catch (error) {
    console.error(`GET /api/purchase-orders/[id] error:`, error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mengambil data purchase order' },
      { status: 500 }
    );
  }
}

// PUT /api/purchase-orders/[id]
// Mengupdate purchase order berdasarkan ID
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<any> }
) {
  try {
    const session = await auth();
    
    if (!session) {
      return NextResponse.json(
        { error: "Tidak memiliki akses" },
        { status: 401 }
      );
    }

    // Penanganan context.params yang mungkin Promise di Next.js terbaru
    const resolvedParams = await params;
    const purchaseOrderId = resolvedParams?.id;

    if (!purchaseOrderId) {
      return NextResponse.json(
        { error: "ID Purchase order tidak valid" },
        { status: 400 }
      );
    }

    const body = await request.json();
    
    // Validasi input
    if (!body.status) {
      return NextResponse.json(
        { error: "Status wajib diisi" },
        { status: 400 }
      );
    }

    try {
      // Cek apakah PO ada
      const existingPO = await (prisma as any).purchaseOrder.findUnique({
        where: { id: purchaseOrderId }
      });

      if (!existingPO) {
        return NextResponse.json(
          { error: "Purchase order tidak ditemukan" },
          { status: 404 }
        );
      }

      // Update PO
      const updatedPO = await (prisma as any).purchaseOrder.update({
        where: { id: purchaseOrderId },
        data: {
          status: body.status,
          notes: body.notes !== undefined ? body.notes : existingPO.notes,
          estimatedDelivery: body.estimatedDelivery 
            ? new Date(body.estimatedDelivery) 
            : existingPO.estimatedDelivery
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
        items: updatedPO.items.map((item: any) => ({
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
      
      // Fallback ke dummy data
      const purchaseOrderIndex = dummyPurchaseOrders.findIndex(po => po.id === purchaseOrderId);

      if (purchaseOrderIndex === -1) {
        return NextResponse.json(
          { error: "Purchase order tidak ditemukan" },
          { status: 404 }
        );
      }

      // Update PO dummy
      const updatedPO = {
        ...dummyPurchaseOrders[purchaseOrderIndex],
        status: body.status,
        notes: body.notes !== undefined ? body.notes : dummyPurchaseOrders[purchaseOrderIndex].notes,
        estimatedDelivery: body.estimatedDelivery 
          ? new Date(body.estimatedDelivery).toISOString()
          : dummyPurchaseOrders[purchaseOrderIndex].estimatedDelivery
      };

      return NextResponse.json({ 
        purchaseOrder: updatedPO,
        usingDummyData: true 
      });
    }
  } catch (error) {
    console.error(`PUT /api/purchase-orders/[id] error:`, error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat memperbarui purchase order' },
      { status: 500 }
    );
  }
}

// DELETE /api/purchase-orders/[id]
// Menghapus purchase order berdasarkan ID
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<any> }
) {
  try {
    const session = await auth();
    
    if (!session) {
      return NextResponse.json(
        { error: "Tidak memiliki akses" },
        { status: 401 }
      );
    }

    // Penanganan context.params yang mungkin Promise di Next.js terbaru
    const resolvedParams = await params;
    const purchaseOrderId = resolvedParams?.id;

    if (!purchaseOrderId) {
      return NextResponse.json(
        { error: "ID Purchase order tidak valid" },
        { status: 400 }
      );
    }

    try {
      // Cek apakah PO ada
      const existingPO = await (prisma as any).purchaseOrder.findUnique({
        where: { id: purchaseOrderId }
      });

      if (!existingPO) {
        return NextResponse.json(
          { error: "Purchase order tidak ditemukan" },
          { status: 404 }
        );
      }

      // Hapus PO
      await (prisma as any).purchaseOrder.delete({
        where: { id: purchaseOrderId }
      });

      return NextResponse.json(
        { message: "Purchase order berhasil dihapus" },
        { status: 200 }
      );
    } catch (dbError) {
      console.error('Database error:', dbError);
      
      // Fallback ke dummy data
      const purchaseOrderIndex = dummyPurchaseOrders.findIndex(po => po.id === purchaseOrderId);

      if (purchaseOrderIndex === -1) {
        return NextResponse.json(
          { error: "Purchase order tidak ditemukan" },
          { status: 404 }
        );
      }

      // Anggap saja berhasil dihapus (untuk dummy)
      return NextResponse.json({
        message: "Purchase order berhasil dihapus (data dummy)",
        usingDummyData: true
      }, { status: 200 });
    }
  } catch (error) {
    console.error(`DELETE /api/purchase-orders/[id] error:`, error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat menghapus purchase order' },
      { status: 500 }
    );
  }
} 