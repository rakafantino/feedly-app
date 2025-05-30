import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/api-middleware';

// GET /api/suppliers/[id]
// Mengambil detail supplier berdasarkan ID
export const GET = withAuth(async (request: NextRequest, session, storeId) => {
  try {
    // Dapatkan ID dari URL
    const pathname = request.nextUrl.pathname;
    const supplierId = pathname.split('/').pop();

    if (!supplierId) {
      return NextResponse.json(
        { error: "ID supplier tidak valid" },
        { status: 400 }
      );
    }

    // Filter berdasarkan toko
    const supplier = await prisma.supplier.findFirst({
      where: { 
        id: supplierId,
        ...(storeId ? { storeId } : {})
      },
      include: {
        products: {
          where: {
            ...(storeId ? { storeId } : {}),
            isDeleted: false
          },
          select: {
            id: true,
            name: true,
            stock: true,
            unit: true,
            price: true
          }
        }
        // purchaseOrders akan direnable setelah migrasi
      }
    });

    if (!supplier) {
      return NextResponse.json(
        { error: "Supplier tidak ditemukan" },
        { status: 404 }
      );
    }

    // Coba ambil PO terkait secara manual
    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where: { 
        supplierId,
        ...(storeId ? { storeId } : {})
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 5 // Ambil 5 PO terbaru
    });

    return NextResponse.json({ 
      supplier: {
        ...supplier,
        purchaseOrders
      } 
    });
  } catch (error) {
    console.error(`GET /api/suppliers/[id] error:`, error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mengambil data supplier' },
      { status: 500 }
    );
  }
}, { requireStore: true });

// PUT /api/suppliers/[id]
// Mengupdate supplier berdasarkan ID
export const PUT = withAuth(async (request: NextRequest, session, storeId) => {
  try {
    // Dapatkan ID dari URL
    const pathname = request.nextUrl.pathname;
    const supplierId = pathname.split('/').pop();

    if (!supplierId) {
      return NextResponse.json(
        { error: "ID supplier tidak valid" },
        { status: 400 }
      );
    }

    const body = await request.json();
    
    // Validasi input
    if (!body.name || !body.name.trim()) {
      return NextResponse.json(
        { error: "Nama supplier wajib diisi" },
        { status: 400 }
      );
    }

    // Cek apakah supplier ada dan milik toko yang sama
    const existingSupplier = await prisma.supplier.findFirst({
      where: { 
        id: supplierId,
        ...(storeId ? { storeId } : {})
      }
    });

    if (!existingSupplier) {
      return NextResponse.json(
        { error: "Supplier tidak ditemukan" },
        { status: 404 }
      );
    }

    const updatedSupplier = await prisma.supplier.update({
      where: { id: supplierId },
      data: {
        name: body.name.trim(),
        email: body.email ? body.email.trim() : null,
        phone: body.phone ? body.phone.trim() : null,
        address: body.address ? body.address.trim() : null
      }
    });

    return NextResponse.json({ supplier: updatedSupplier });
  } catch (error) {
    console.error(`PUT /api/suppliers/[id] error:`, error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat memperbarui supplier' },
      { status: 500 }
    );
  }
}, { requireStore: true });

// DELETE /api/suppliers/[id]
// Menghapus supplier berdasarkan ID
export const DELETE = withAuth(async (request: NextRequest, session, storeId) => {
  try {
    // Dapatkan ID dari URL
    const pathname = request.nextUrl.pathname;
    const supplierId = pathname.split('/').pop();

    if (!supplierId) {
      return NextResponse.json(
        { error: "ID supplier tidak valid" },
        { status: 400 }
      );
    }

    // Cek apakah supplier terkait dengan produk
    const productsCount = await prisma.product.count({
      where: { 
        supplierId,
        ...(storeId ? { storeId } : {})
      }
    });

    if (productsCount > 0) {
      return NextResponse.json(
        { 
          error: "Supplier ini digunakan oleh beberapa produk. Hapus atau update produk terlebih dahulu.",
          relatedProducts: productsCount
        },
        { status: 400 }
      );
    }

    // Cek apakah supplier ada dan milik toko yang sama
    const existingSupplier = await prisma.supplier.findFirst({
      where: { 
        id: supplierId,
        ...(storeId ? { storeId } : {})
      }
    });

    if (!existingSupplier) {
      return NextResponse.json(
        { error: "Supplier tidak ditemukan" },
        { status: 404 }
      );
    }

    // Hapus supplier
    await prisma.supplier.delete({
      where: { id: supplierId }
    });

    return NextResponse.json(
      { message: "Supplier berhasil dihapus" },
      { status: 200 }
    );
  } catch (error) {
    console.error(`DELETE /api/suppliers/[id] error:`, error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat menghapus supplier' },
      { status: 500 }
    );
  }
}, { requireStore: true }); 