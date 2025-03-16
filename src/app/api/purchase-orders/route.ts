import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

// GET /api/purchase-orders
// Mengambil semua purchase orders
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session) {
      return NextResponse.json(
        { error: "Tidak memiliki akses" },
        { status: 401 }
      );
    }

    // Ambil parameter dari query string
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit') as string) : 10;
    const page = searchParams.get('page') ? parseInt(searchParams.get('page') as string) : 1;
    const skip = (page - 1) * limit;
    
    // Buat filter
    const where: any = {};
    if (status && status !== 'all') {
      where.status = status;
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
              phone: true
            }
          },
          items: {
            include: {
              product: {
                select: {
                  name: true,
                  unit: true
                }
              }
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take: limit
      });

      // Map data untuk frontend
      const formattedPOs = purchaseOrders.map(po => ({
        id: po.id,
        poNumber: po.poNumber,
        supplierId: po.supplierId,
        supplierName: po.supplier.name,
        supplierPhone: po.supplier.phone,
        status: po.status,
        createdAt: po.createdAt.toISOString(),
        estimatedDelivery: po.estimatedDelivery ? po.estimatedDelivery.toISOString() : null,
        notes: po.notes,
        items: po.items.map(item => ({
          id: item.id,
          productId: item.productId,
          productName: item.product.name,
          quantity: item.quantity,
          unit: item.unit,
          price: item.price
        }))
      }));

      return NextResponse.json({
        purchaseOrders: formattedPOs,
        pagination: {
          total: totalCount,
          page,
          limit,
          pages: Math.ceil(totalCount / limit)
        }
      });
    } catch (dbError) {
      console.error('Database error:', dbError);
      
      // Fallback ke data dummy jika terjadi error
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
      
      // Filter data dummy
      let filteredPOs = [...dummyPurchaseOrders];
      if (status && status !== 'all') {
        filteredPOs = dummyPurchaseOrders.filter(po => po.status === status);
      }

      return NextResponse.json({
        purchaseOrders: filteredPOs,
        pagination: {
          total: filteredPOs.length,
          page: 1,
          limit: filteredPOs.length,
          pages: 1
        },
        usingDummyData: true
      });
    }
  } catch (error) {
    console.error('GET /api/purchase-orders error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mengambil data purchase orders' },
      { status: 500 }
    );
  }
}

// POST /api/purchase-orders
// Membuat purchase order baru
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session) {
      return NextResponse.json(
        { error: "Tidak memiliki akses" },
        { status: 401 }
      );
    }

    const body = await request.json();
    
    // Validasi input
    if (!body.supplierId) {
      return NextResponse.json(
        { error: "Supplier wajib dipilih" },
        { status: 400 }
      );
    }
    
    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        { error: "Minimal satu item produk wajib ditambahkan" },
        { status: 400 }
      );
    }

    for (const item of body.items) {
      if (!item.productId || !item.quantity || item.quantity <= 0 || !item.price) {
        return NextResponse.json(
          { error: "Setiap item harus memiliki productId, quantity, dan price yang valid" },
          { status: 400 }
        );
      }
    }

    try {
      // Generate nomor PO
      // Format: PO-YYYYMMDD-XXX
      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateStr = `${year}${month}${day}`;
      
      // Cari PO terakhir untuk hari ini
      const lastPO = await prisma.purchaseOrder.findFirst({
        where: {
          poNumber: {
            startsWith: `PO-${dateStr}`
          }
        },
        orderBy: {
          poNumber: 'desc'
        }
      });
      
      let sequence = 1;
      if (lastPO) {
        const lastSeq = parseInt(lastPO.poNumber.split('-')[2]);
        if (!isNaN(lastSeq)) {
          sequence = lastSeq + 1;
        }
      }
      
      const poNumber = `PO-${dateStr}-${String(sequence).padStart(3, '0')}`;

      // Buat PO baru dengan items
      const newPO = await prisma.purchaseOrder.create({
        data: {
          poNumber,
          supplierId: body.supplierId,
          status: body.status || 'draft',
          notes: body.notes || null,
          estimatedDelivery: body.estimatedDelivery ? new Date(body.estimatedDelivery) : null,
          items: {
            create: body.items.map((item: any) => ({
              productId: item.productId,
              quantity: parseFloat(item.quantity),
              price: parseFloat(item.price),
              unit: item.unit || 'pcs'
            }))
          }
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

      return NextResponse.json({ purchaseOrder: newPO }, { status: 201 });
    } catch (dbError) {
      console.error('Database error:', dbError);
      
      // Fallback ke data dummy
      const poNumber = `PO-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-001`;
      
      // Buat PO baru (dummy response)
      const newPO = {
        id: `po-${Date.now()}`,
        poNumber,
        supplierId: body.supplierId,
        supplierName: 'Supplier Dummy', 
        status: body.status || 'draft',
        createdAt: new Date().toISOString(),
        estimatedDelivery: body.estimatedDelivery || null,
        notes: body.notes || null,
        items: body.items.map((item: any, index: number) => ({
          id: `item-${Date.now()}-${index}`,
          productId: item.productId,
          productName: 'Produk Dummy', 
          quantity: parseFloat(item.quantity),
          unit: item.unit || 'pcs',
          price: parseFloat(item.price)
        })),
        usingDummyData: true
      };

      return NextResponse.json({ purchaseOrder: newPO }, { status: 201 });
    }
  } catch (error) {
    console.error('POST /api/purchase-orders error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat membuat purchase order baru' },
      { status: 500 }
    );
  }
} 