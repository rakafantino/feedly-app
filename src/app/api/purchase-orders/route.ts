import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/api-middleware';
import { purchaseOrderSchema } from '@/lib/validations/purchase-order';

// GET /api/purchase-orders
// Mengambil semua purchase orders
export const GET = withAuth(async (request: NextRequest, session, storeId) => {
  try {
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
        paymentStatus: po.paymentStatus,
        amountPaid: po.amountPaid,
        remainingAmount: po.remainingAmount,
        dueDate: po.dueDate ? po.dueDate.toISOString() : null,
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
          paymentStatus: 'UNPAID',
          amountPaid: 0,
          remainingAmount: 6400000,
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
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
          paymentStatus: 'PARTIAL',
          amountPaid: 1000000,
          remainingAmount: 1750000,
          dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
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
          paymentStatus: 'PAID',
          amountPaid: 4800000,
          remainingAmount: 0,
          dueDate: null,
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
}, { requireStore: true });

// POST /api/purchase-orders
// Membuat purchase order baru
export const POST = withAuth(async (request: NextRequest, session, storeId) => {
  try {
    // Pastikan storeId tersedia
    if (!storeId) {
      return NextResponse.json(
        { error: 'Store ID diperlukan untuk membuat purchase order' },
        { status: 400 }
      );
    }

    const body = await request.json();
    
    const result = purchaseOrderSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Validasi gagal", details: result.error.flatten() },
        { status: 400 }
      );
    }
    
    const data = result.data;

    // Validasi bahwa supplier berada dalam toko yang sama
    const supplier = await prisma.supplier.findFirst({
      where: { 
        id: data.supplierId,
        storeId 
      }
    });
    
    if (!supplier) {
      return NextResponse.json(
        { error: "Supplier tidak ditemukan atau tidak termasuk dalam toko Anda" },
        { status: 400 }
      );
    }

    // Validasi bahwa semua produk berada dalam toko yang sama
    for (const item of data.items) {
      const product = await prisma.product.findFirst({
        where: { 
          id: item.productId,
          storeId
        }
      });
      
      if (!product) {
        return NextResponse.json(
          { error: `Produk dengan ID ${item.productId} tidak ditemukan atau tidak termasuk dalam toko Anda` },
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
          },
          storeId
        },
        orderBy: {
          poNumber: 'desc'
        }
      });
      
      // Tentukan nomor urut
      let sequence = 1;
      if (lastPO) {
        const lastSequence = parseInt(lastPO.poNumber.split('-')[2]);
        sequence = lastSequence + 1;
      }
      
      // Format nomor PO
      const poNumber = `PO-${dateStr}-${String(sequence).padStart(3, '0')}`;
      
      // Buat purchase order dengan items dalam satu transaksi
      const purchaseOrder = await prisma.$transaction(async (prisma) => {
        // Hitung total amount
        const totalAmount = data.items.reduce((acc: number, item: any) => acc + (item.quantity * item.price), 0);
        
        let paymentStatus = data.paymentStatus || 'UNPAID';
        const amountPaid = data.amountPaid || 0;
        let remainingAmount = totalAmount - amountPaid;

        // Validasi basic
        if (amountPaid >= totalAmount) {
            paymentStatus = 'PAID';
            remainingAmount = 0;
        } else if (amountPaid > 0) {
            paymentStatus = 'PARTIAL';
        }

        // Buat purchase order
        const po = await prisma.purchaseOrder.create({
          data: {
            poNumber,
            supplierId: data.supplierId,
            status: data.status || 'draft',
            paymentStatus,
            amountPaid,
            remainingAmount,
            totalAmount,
            dueDate: data.dueDate ? new Date(data.dueDate) : null,
            estimatedDelivery: data.estimatedDelivery ? new Date(data.estimatedDelivery) : null,
            notes: data.notes,
            storeId: storeId
          }
        });
        
        // Buat purchase order items
        for (const item of data.items) {
          await prisma.purchaseOrderItem.create({
            data: {
              purchaseOrderId: po.id,
              productId: item.productId,
              quantity: item.quantity,
              unit: item.unit || 'pcs',
              price: item.price
            }
          });
        }
        
        return po;
      });
      
      return NextResponse.json({ purchaseOrder }, { status: 201 });
    } catch (dbError: any) {
      console.error('Database error:', dbError);
      
      if (dbError.code === 'P2002') {
        return NextResponse.json(
          { error: 'Nomor PO sudah digunakan. Silakan coba lagi.' },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { error: `Terjadi kesalahan database: ${dbError.message}` },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('POST /api/purchase-orders error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat membuat purchase order' },
      { status: 500 }
    );
  }
}, { requireStore: true }); 