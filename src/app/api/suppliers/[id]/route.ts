import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';

// GET /api/suppliers/[id]
// Mengambil detail supplier berdasarkan ID
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

    const resolvedParams = await params;
    const supplierId = resolvedParams.id;

    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
      include: {
        products: {
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
      where: { supplierId },
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
}

// PUT /api/suppliers/[id]
// Mengupdate supplier berdasarkan ID
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

    const resolvedParams = await params;
    const supplierId = resolvedParams.id;
    const body = await request.json();
    
    // Validasi input
    if (!body.name || !body.name.trim()) {
      return NextResponse.json(
        { error: "Nama supplier wajib diisi" },
        { status: 400 }
      );
    }

    // Cek apakah supplier ada
    const existingSupplier = await prisma.supplier.findUnique({
      where: { id: supplierId }
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
}

// DELETE /api/suppliers/[id]
// Menghapus supplier berdasarkan ID
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

    const resolvedParams = await params;
    const supplierId = resolvedParams.id;

    // Cek apakah supplier terkait dengan produk
    const productsCount = await prisma.product.count({
      where: { supplierId }
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

    // Cek apakah supplier ada
    const existingSupplier = await prisma.supplier.findUnique({
      where: { id: supplierId }
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
} 