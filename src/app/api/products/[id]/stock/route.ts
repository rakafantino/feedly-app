import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';

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

    // Perbarui notifikasi stok
    try {
      // Mendapatkan protocol dan host untuk API call
      const protocol = request.nextUrl.protocol; // http: atau https:
      const host = request.headers.get('host') || 'localhost:3000';

      // Pastikan notifikasi stok diperbarui dengan benar
      // Gunakan DELETE untuk menghapus dengan explisit jika stok tidak rendah lagi
      if (newStock > (product.threshold || 5)) {
        // Stok di atas threshold, hapus notifikasi jika ada
        console.log(`Stock now above threshold (${newStock} > ${product.threshold || 5}), explicitly deleting alert`);
        
        try {
          const deleteResponse = await fetch(`${protocol}//${host}/api/stock-alerts?productId=${id}`, {
            method: 'DELETE'
          });
          
          if (deleteResponse.ok) {
            const result = await deleteResponse.json();
            console.log(`Explicit alert delete result: ${result.deleted ? 'deleted' : 'not found'}`);
          } else {
            console.error('Failed to delete alert:', await deleteResponse.text());
          }
        } catch (deleteError) {
          console.error('Error deleting stock alert:', deleteError);
        }
      }
      
      // Pastikan notifikasi diperbarui dengan force update
      const stockCheckResponse = await fetch(`${protocol}//${host}/api/stock-alerts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          products: [updatedProduct],
          forceUpdate: true,   // Force update untuk memastikan notifikasi terbaru
          bypassCache: true    // Bypass cache untuk data terbaru
        }),
      });

      if (!stockCheckResponse.ok) {
        console.error('Error updating stock alerts after stock change:', await stockCheckResponse.text());
      } else {
        console.log('Stock alerts updated after stock change operation');
      }
    } catch (error) {
      console.error('Error handling stock notification after stock update:', error);
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