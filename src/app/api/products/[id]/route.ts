import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/api-middleware';
import { checkLowStockProducts } from '@/lib/notificationService';
import { productUpdateSchema } from '@/lib/validations/product';

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
        supplier: true, // Tambahkan include supplier untuk mendapatkan data supplier lengkap
        convertedFrom: { select: { id: true, name: true } } // Cek apakah produk ini adalah hasil konversi (barang eceran)
      } as any // Cast to any because Prisma types might be lagging behind schema push
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

    const body = await request.json();

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

    // Validate input using Zod
    const validationResult = productUpdateSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.error.flatten().fieldErrors
        },
        { status: 400 }
      );
    }

    const mb = validationResult.data;

    // Check for duplicate barcode if barcode is provided and not null
    if (mb.barcode && typeof mb.barcode === 'string') {
      const existingProductWithBarcode = await prisma.product.findFirst({
        where: {
          barcode: mb.barcode,
          storeId: storeId ?? undefined,
          isDeleted: false,
          NOT: {
            id: id
          }
        }
      });

      if (existingProductWithBarcode) {
        return NextResponse.json(
          { error: "Barcode sudah digunakan oleh produk lain di toko Anda" },
          { status: 400 }
        );
      }
    }

    // Validasi jika supplier diubah
    if (mb.supplierId && typeof mb.supplierId === 'string') {
      const supplier = await prisma.supplier.findFirst({
        where: {
          id: mb.supplierId,
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

    // Prepare update data handling relations explicitly
    const { supplierId, conversionTargetId, ...productData } = mb;

    const updatePayload: any = {
      ...productData,
    };

    // Handle Supplier Relation
    if (supplierId !== undefined) {
      if (supplierId) {
        updatePayload.supplier = { connect: { id: supplierId } };
      } else {
        updatePayload.supplier = { disconnect: true };
      }
    }

    // Handle Conversion Target Relation
    if (conversionTargetId !== undefined) {
      if (conversionTargetId) {
        updatePayload.conversionTarget = { connect: { id: conversionTargetId } };
      } else {
        updatePayload.conversionTarget = { disconnect: true };
      }
    }

    const updatedProduct = await prisma.product.update({
      where: {
        id: id,
        storeId: storeId ?? undefined
      },
      data: updatePayload
    });

    // --- CASCADING UPDATE LOGIC START ---
    // If this product has a conversion target (retail variant) & conversion rate
    // We should cascade price & batch updates to ensure consistency
    if (updatedProduct.conversionTargetId && updatedProduct.conversionRate) {

      // Prepare child update payload
      const childUpdates: any = {};
      let hasUpdates = false;

      // 1. Sync Purchase Price (HPP)
      if (updatedProduct.purchase_price) {
        childUpdates.purchase_price = updatedProduct.purchase_price / updatedProduct.conversionRate;
        hasUpdates = true;
      }

      // 2. Sync Minimum Selling Price
      if (updatedProduct.min_selling_price) {
        childUpdates.min_selling_price = updatedProduct.min_selling_price / updatedProduct.conversionRate;
        hasUpdates = true;
      }

      // 3. Sync Meta Data (Batch, Expiry, Purchase Date)
      // Only if they exist on parent (updates handle nulls too, but assume valid sync)
      if (updatedProduct.batch_number !== null) { childUpdates.batch_number = updatedProduct.batch_number; hasUpdates = true; }
      if (updatedProduct.expiry_date !== null) { childUpdates.expiry_date = updatedProduct.expiry_date; hasUpdates = true; }
      if (updatedProduct.purchase_date !== null) { childUpdates.purchase_date = updatedProduct.purchase_date; hasUpdates = true; }

      if (hasUpdates) {
        await prisma.product.update({
          where: { id: updatedProduct.conversionTargetId },
          data: childUpdates
        });
      }
    }
    // --- CASCADING UPDATE LOGIC END ---

    // Check stock alerts directly
    await checkLowStockProducts(storeId);

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

    // Cleanup: Unlink any products that use this deleted product as a conversion target
    await prisma.product.updateMany({
      where: {
        conversionTargetId: id
      } as any,
      data: {
        conversionTargetId: null,
        conversionRate: null
      } as any
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