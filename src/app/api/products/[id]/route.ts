import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/api-middleware';

// GET /api/products/[id]
export const GET = withAuth(async (request: NextRequest, session, storeId) => {
  try {
    // Dapatkan ID dari URL
    const pathname = request.nextUrl.pathname;
    const id = pathname.split('/').pop();
    
    if (!id) {
      return NextResponse.json(
        { error: "ID produk tidak valid" },
        { status: 400 }
      );
    }
    
    // Periksa parameter query untuk pengecekan stok
    const url = new URL(request.url);
    const checkStock = url.searchParams.get('checkStock') === 'true';
    
    // Gunakan findFirst dengan multiple conditions
    const product = await prisma.product.findFirst({
      where: { 
        id,
        isDeleted: false,
        ...(storeId ? { storeId } : {})
      },
      include: {
        supplier: true // Tambahkan include supplier untuk mendapatkan data supplier lengkap
      }
    });

    if (!product) {
      return NextResponse.json(
        { error: "Produk tidak ditemukan" },
        { status: 404 }
      );
    }

    // Jika parameter checkStock=true, periksa notifikasi stok
    if (checkStock) {
      try {
        // Mendapatkan protocol dan host untuk API call
        const protocol = request.nextUrl.protocol; // http: atau https:
        const host = request.headers.get('host') || 'localhost:3000';

        // Memanggil API stock-alerts untuk memeriksa stok rendah
        const stockCheckResponse = await fetch(`${protocol}//${host}/api/stock-alerts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            products: [product]
          }),
        });

        if (!stockCheckResponse.ok) {
          console.error('Error updating stock alerts:', await stockCheckResponse.text());
        } else {
          console.log('Stock alerts updated during product view');
        }
      } catch (error) {
        console.error('Error handling stock notification during product view:', error);
        // Jangan gagalkan seluruh request jika notifikasi gagal
      }
    }

    return NextResponse.json({ product });
  } catch (error) {
    console.error("GET /api/products error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan saat mengambil data produk" },
      { status: 500 }
    );
  }
}, { requireStore: true });

// PATCH /api/products/[id] - untuk pembaruan parsial produk (seperti threshold)
export const PATCH = withAuth(async (request: NextRequest, session, storeId) => {
  try {
    // Dapatkan ID dari URL
    const pathname = request.nextUrl.pathname;
    const id = pathname.split('/').pop();
    
    if (!id) {
      return NextResponse.json(
        { error: "ID produk tidak valid" },
        { status: 400 }
      );
    }
    
    const data = await request.json();

    // Check if product exists and belongs to the store
    const existingProduct = await prisma.product.findFirst({
      where: { 
        id,
        isDeleted: false,
        ...(storeId ? { storeId } : {})
      }
    });

    if (!existingProduct) {
      return NextResponse.json(
        { error: "Produk tidak ditemukan" },
        { status: 404 }
      );
    }

    // Update product with only provided fields
    const updatedProduct = await prisma.product.update({
      where: { id },
      data
    });

    // Jika stok atau threshold diperbarui, periksa notifikasi stok
    if ('stock' in data || 'threshold' in data) {
      try {
        // Mendapatkan protocol dan host untuk API call
        const protocol = request.nextUrl.protocol; // http: atau https:
        const host = request.headers.get('host') || 'localhost:3000';

        // Pastikan notifikasi diperbarui, gunakan opsi force update
        const stockCheckResponse = await fetch(`${protocol}//${host}/api/stock-alerts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            products: [updatedProduct],
            forceUpdate: true,  // Pastikan notifikasi selalu diperbarui
            bypassCache: true   // Bypass cache untuk memastikan data terbaru
          }),
        });

        if (!stockCheckResponse.ok) {
          console.error('Error updating stock alerts:', await stockCheckResponse.text());
        } else {
          console.log('Stock alerts updated after product edit via PATCH');
          
          // Jika stok sekarang di atas threshold, eksplisit hapus notifikasi
          // untuk memastikan notifikasi hilang segera
          const threshold = updatedProduct.threshold ?? 5; // Default threshold 5
          if (updatedProduct.stock > threshold) {
            try {
              // Hapus notifikasi secara eksplisit untuk memastikan UI diperbarui
              const stockDeleteResponse = await fetch(`${protocol}//${host}/api/stock-alerts?productId=${id}`, {
                method: 'DELETE'
              });
              
              if (stockDeleteResponse.ok) {
                console.log('Stock alert explicitly deleted for non-low stock product');
              }
            } catch (deleteError) {
              console.error('Failed to explicitly delete stock alert:', deleteError);
            }
          }
        }
      } catch (error) {
        console.error('Error handling stock notification after product edit:', error);
        // Jangan gagalkan seluruh request jika notifikasi gagal
      }
    }

    return NextResponse.json({ product: updatedProduct });
  } catch (error) {
    console.error("PATCH /api/products error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan saat memperbarui produk" },
      { status: 500 }
    );
  }
}, { requireStore: true });

// PUT /api/products/[id]
export const PUT = withAuth(async (request: NextRequest, session, storeId) => {
  try {
    // Dapatkan ID dari URL
    const pathname = request.nextUrl.pathname;
    const id = pathname.split('/').pop();
    
    if (!id) {
      return NextResponse.json(
        { error: "ID produk tidak valid" },
        { status: 400 }
      );
    }
    
    const data = await request.json();

    // Check if product exists and belongs to the store
    const existingProduct = await prisma.product.findFirst({
      where: { 
        id,
        ...(storeId ? { storeId } : {})
      }
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

    // Pastikan barcode unik jika diisi atau diubah
    if (data.barcode && data.barcode !== existingProduct.barcode) {
      const barcodeExists = await prisma.product.findFirst({
        where: {
          barcode: data.barcode,
          id: { not: id },
          ...(storeId ? { storeId } : {}),
          isDeleted: false
        }
      });

      if (barcodeExists) {
        return NextResponse.json(
          { error: "Barcode sudah digunakan oleh produk lain" },
          { status: 400 }
        );
      }
    }

    // Validasi jika supplier diubah
    if (data.supplierId) {
      const supplier = await prisma.supplier.findFirst({
        where: {
          id: data.supplierId,
          ...(storeId ? { storeId } : {})
        }
      });

      if (!supplier) {
        return NextResponse.json(
          { error: "Supplier tidak ditemukan atau tidak termasuk dalam toko Anda" },
          { status: 400 }
        );
      }
    }

    // Update product
    const updatedProduct = await prisma.product.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        barcode: data.barcode,
        category: data.category,
        price: data.price,
        stock: data.stock,
        unit: data.unit,
        threshold: data.threshold,
        purchase_price: data.purchase_price,
        min_selling_price: data.min_selling_price,
        batch_number: data.batch_number,
        expiry_date: data.expiry_date,
        purchase_date: data.purchase_date,
        supplierId: data.supplierId
      }
    });

    // Periksa notifikasi stok
    try {
      // Mendapatkan protocol dan host untuk API call
      const protocol = request.nextUrl.protocol;
      const host = request.headers.get('host') || 'localhost:3000';

      // Panggil API notifikasi stok
      const stockCheckResponse = await fetch(`${protocol}//${host}/api/stock-alerts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          products: [updatedProduct],
          forceUpdate: true
        }),
      });

      if (!stockCheckResponse.ok) {
        console.error('Error updating stock alerts:', await stockCheckResponse.text());
      } else {
        console.log('Stock alerts updated after product edit');
      }
    } catch (error) {
      console.error('Error handling stock notification during product edit:', error);
    }

    return NextResponse.json({ product: updatedProduct });
  } catch (error) {
    console.error("PUT /api/products error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan saat memperbarui produk" },
      { status: 500 }
    );
  }
}, { requireStore: true });

// DELETE /api/products/[id]
export const DELETE = withAuth(async (request: NextRequest, session, storeId) => {
  try {
    // Dapatkan ID dari URL
    const pathname = request.nextUrl.pathname;
    const id = pathname.split('/').pop();
    
    if (!id) {
      return NextResponse.json(
        { error: "ID produk tidak valid" },
        { status: 400 }
      );
    }
    
    // Check if product exists and belongs to the store
    const existingProduct = await prisma.product.findFirst({
      where: { 
        id,
        ...(storeId ? { storeId } : {})
      }
    });

    if (!existingProduct) {
      return NextResponse.json(
        { error: "Produk tidak ditemukan" },
        { status: 404 }
      );
    }

    // Gunakan soft delete dengan mengupdate isDeleted ke true
    await prisma.product.update({
      where: { id },
      data: { isDeleted: true }
    });

    // Hapus semua notifikasi stok rendah untuk produk ini
    try {
      // Mendapatkan protocol dan host untuk API call
      const protocol = request.nextUrl.protocol;
      const host = request.headers.get('host') || 'localhost:3000';

      // Secara eksplisit hapus notifikasi stok rendah
      const stockDeleteResponse = await fetch(`${protocol}//${host}/api/stock-alerts?productId=${id}`, {
        method: 'DELETE'
      });
      
      if (stockDeleteResponse.ok) {
        console.log('Stock alert deleted for removed product');
      }
    } catch (error) {
      console.error('Error deleting stock notification for removed product:', error);
    }

    return NextResponse.json({ 
      success: true,
      message: "Produk berhasil dihapus" 
    });
  } catch (error) {
    console.error("DELETE /api/products error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan saat menghapus produk" },
      { status: 500 }
    );
  }
}, { requireStore: true }); 