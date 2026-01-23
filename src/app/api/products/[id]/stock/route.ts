import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { checkLowStockProducts } from '@/lib/notificationService';
import { BatchService } from '@/services/batch.service';

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
    const { stock, operation, expiryDate, batchNumber, purchasePrice } = data;
    
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

    let updatedProduct;

    try {
      // Operasi stok menggunakan BatchService
      if (operation === 'increment') {
        const batchData = {
          productId: id,
          stock: stock,
          expiryDate: expiryDate ? new Date(expiryDate) : undefined,
          batchNumber: batchNumber || undefined,
          purchasePrice: purchasePrice || undefined
        };
        await BatchService.addBatch(batchData);
      } else if (operation === 'decrement') {
        await BatchService.deductStock(id, stock);
      } else {
        // Default: Set value (Stock Opname / Correction)
        const currentStock = product.stock;
        const difference = stock - currentStock;

        if (difference > 0) {
          // Add difference as generic adjustment batch
          await BatchService.addGenericBatch(id, difference);
        } else if (difference < 0) {
          // Deduct difference
          await BatchService.deductStock(id, Math.abs(difference));
        }
        // If difference is 0, do nothing
      }

      // Fetch updated product to return
      updatedProduct = await prisma.product.findUnique({
        where: { id }
      });
      
    } catch (err: any) {
      return NextResponse.json(
        { error: err.message || "Gagal memperbarui stok" },
        { status: 400 }
      );
    }

    // Setelah stok di-update, perbarui notifikasi stok rendah secara langsung via service
    try {
      if (updatedProduct) {
        // Force check untuk store yang terkait agar notifikasi langsung sinkron
        await checkLowStockProducts(updatedProduct.storeId, true);
        console.log('[Stock Update] Low stock notifications refreshed via service for store:', updatedProduct.storeId);
      }
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