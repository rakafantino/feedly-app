import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { checkLowStockProducts } from '@/lib/notificationService';

// PUT /api/products/[id]/stock
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

    const { id } = await context.params;
    
    if (!id) {
      return NextResponse.json(
        { error: "ID produk tidak valid" },
        { status: 400 }
      );
    }
    
    const data = await request.json();
    const { stock, operation } = data;
    
    if (typeof stock !== 'number' || isNaN(stock) || stock < 0) {
      return NextResponse.json(
        { error: "Jumlah stok tidak valid" },
        { status: 400 }
      );
    }

    // Cari produk terlebih dahulu
    const product = await prisma.product.findUnique({
      where: { id }
    });

    if (!product) {
      return NextResponse.json(
        { error: "Produk tidak ditemukan" },
        { status: 404 }
      );
    }

    let newStock: number;

    // Operasi stok (increment atau set)
    if (operation === 'increment') {
      newStock = product.stock + stock;
    } else if (operation === 'decrement') {
      newStock = Math.max(0, product.stock - stock); // Prevent negative stock
    } else {
      // Default: langsung set nilai stok
      newStock = stock;
    }

    // Update stok produk
    const updatedProduct = await prisma.product.update({
      where: { id },
      data: { stock: newStock }
    });

    // Setelah stok di-update, perbarui notifikasi stok rendah secara langsung via service
    try {
      // Force check untuk store yang terkait agar notifikasi langsung sinkron
      await checkLowStockProducts(updatedProduct.storeId, true);
      console.log('[Stock Update] Low stock notifications refreshed via service for store:', updatedProduct.storeId);
    } catch (error) {
      console.error('Error refreshing stock alerts via service after stock update:', error);
      // Jangan gagalkan seluruh request jika notifikasi gagal
    }

    return NextResponse.json({
      message: "Stok produk berhasil diperbarui",
      product: updatedProduct
    });
  } catch (error) {
    console.error("PUT /api/products/[id]/stock error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan saat memperbarui stok produk" },
      { status: 500 }
    );
  }
}