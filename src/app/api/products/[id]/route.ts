import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';

// GET /api/products/[id]
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    
    if (!session) {
      return NextResponse.json(
        { error: "Tidak memiliki akses" },
        { status: 401 }
      );
    }

    // Get params safely by awaiting the Promise
    const { id } = await context.params;
    
    if (!id) {
      return NextResponse.json(
        { error: "ID produk tidak valid" },
        { status: 400 }
      );
    }
    
    // Gunakan findFirst dengan multiple conditions
    const product = await prisma.product.findFirst({
      where: { 
        id,
        isDeleted: false
      }
    });

    if (!product) {
      return NextResponse.json(
        { error: "Produk tidak ditemukan" },
        { status: 404 }
      );
    }

    return NextResponse.json({ product });
  } catch (error) {
    console.error("GET /api/products error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan saat mengambil data produk" },
      { status: 500 }
    );
  }
}

// PUT /api/products/[id]
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    
    if (!session) {
      return NextResponse.json(
        { error: "Tidak memiliki akses" },
        { status: 401 }
      );
    }

    // Get params safely by awaiting the Promise
    const { id } = await context.params;
    
    if (!id) {
      return NextResponse.json(
        { error: "ID produk tidak valid" },
        { status: 400 }
      );
    }
    
    const data = await request.json();

    // Check if product exists
    const existingProduct = await prisma.product.findUnique({
      where: { id }
    });

    if (!existingProduct) {
      return NextResponse.json(
        { error: "Produk tidak ditemukan" },
        { status: 404 }
      );
    }

    // Validation
    if (data.price < 0) {
      return NextResponse.json(
        { error: "Harga tidak boleh negatif" },
        { status: 400 }
      );
    }

    if (data.stock < 0) {
      return NextResponse.json(
        { error: "Stok tidak boleh negatif" },
        { status: 400 }
      );
    }

    // Update product
    const updatedProduct = await prisma.product.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description || null,
        barcode: data.barcode || null,
        category: data.category || null,
        price: data.price,
        stock: data.stock,
        unit: data.unit || 'pcs'
      }
    });

    return NextResponse.json({ product: updatedProduct });
  } catch (error) {
    console.error("PUT /api/products error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan saat mengupdate produk" },
      { status: 500 }
    );
  }
}

// DELETE /api/products/[id]
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    
    if (!session) {
      return NextResponse.json(
        { error: "Tidak memiliki akses" },
        { status: 401 }
      );
    }

    // Get params safely by awaiting the Promise
    const { id } = await context.params;
    
    if (!id) {
      return NextResponse.json(
        { error: "ID produk tidak valid" },
        { status: 400 }
      );
    }

    // Check if product exists
    const existingProduct = await prisma.product.findUnique({
      where: { id }
    });

    if (!existingProduct) {
      return NextResponse.json(
        { error: "Produk tidak ditemukan" },
        { status: 404 }
      );
    }

    try {
      // Implement soft delete instead of hard delete
      await prisma.product.update({
        where: { id },
        data: { isDeleted: true }
      });
      
      return NextResponse.json(
        { message: "Produk berhasil dihapus" },
        { status: 200 }
      );
    } catch (error) {
      console.error("Soft delete error:", error);
      return NextResponse.json(
        { error: "Terjadi kesalahan saat menghapus produk" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("DELETE /api/products error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan saat menghapus produk" },
      { status: 500 }
    );
  }
} 