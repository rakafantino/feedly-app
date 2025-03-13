import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';

// PATCH /api/products/[id]/stock
export async function PATCH(
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
    const { adjustment, isAddition = true } = data;

    // Validasi adjustment
    if (typeof adjustment !== 'number' || adjustment <= 0) {
      return NextResponse.json(
        { error: "Adjustment harus berupa angka positif" },
        { status: 400 }
      );
    }

    // Check if product exists
    const existingProduct = await prisma.product.findFirst({
      where: { 
        id,
        isDeleted: false
      }
    });

    if (!existingProduct) {
      return NextResponse.json(
        { error: "Produk tidak ditemukan" },
        { status: 404 }
      );
    }

    // Hitung stok baru berdasarkan penambahan atau pengurangan
    let newStock = existingProduct.stock;
    if (isAddition) {
      newStock += adjustment;
    } else {
      newStock = Math.max(0, newStock - adjustment); // Pastikan stok tidak negatif
    }

    // Update stok produk
    const updatedProduct = await prisma.product.update({
      where: { id },
      data: { stock: newStock }
    });

    // Menangani notifikasi stok
    try {
      // Jika kita tidak bisa mendapatkan socket, masih OK untuk melanjutkan update produk
      // Socket di-upgrade dari NextResponse yang tidak dapat kita akses langsung di sini,
      // jadi kita akan mengirim request terpisah ke API stock-alerts
      
      // Kirim ke API stock-alerts untuk memperbarui notifikasi
      const protocol = request.nextUrl.protocol; // http: atau https:
      const host = request.headers.get('host') || 'localhost:3000';

      // Jika stok sekarang di atas threshold, update notifikasi (mungkin akan dihapus)
      // Jika stok sekarang sama atau di bawah threshold, mungkin perlu mengirim notifikasi baru
      const stockCheckResponse = await fetch(`${protocol}//${host}/api/stock-alerts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          products: [updatedProduct]
        }),
      });

      if (!stockCheckResponse.ok) {
        console.error('Error updating stock alerts:', await stockCheckResponse.text());
      }
    } catch (error) {
      console.error('Error handling stock notification:', error);
      // Jangan gagalkan seluruh request jika notifikasi gagal
    }

    return NextResponse.json({ 
      product: updatedProduct,
      success: true,
      message: "Stok produk berhasil diperbarui"
    });
  } catch (error) {
    console.error("PATCH /api/products/[id]/stock error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan saat memperbarui stok produk" },
      { status: 500 }
    );
  }
} 