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
    
    // Periksa parameter query untuk pengecekan stok
    const url = new URL(request.url);
    const checkStock = url.searchParams.get('checkStock') === 'true';
    
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
}

// PATCH /api/products/[id] - untuk pembaruan parsial produk (seperti threshold)
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

        // Memanggil API stock-alerts untuk memeriksa stok rendah
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
        } else {
          console.log('Stock alerts updated after product edit');
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
        unit: data.unit || 'pcs',
        threshold: data.threshold || null,
      }
    });

    // Menangani notifikasi stok setelah update produk
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
          products: [updatedProduct]
        }),
      });

      if (!stockCheckResponse.ok) {
        console.error('Error updating stock alerts:', await stockCheckResponse.text());
      } else {
        console.log('Stock alerts updated after product edit');
      }
    } catch (error) {
      console.error('Error handling stock notification after product edit:', error);
      // Jangan gagalkan seluruh request jika notifikasi gagal
    }

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
      
      // Hapus notifikasi stok untuk produk yang dihapus
      try {
        // Mendapatkan protocol dan host untuk API call
        const protocol = request.nextUrl.protocol; // http: atau https:
        const host = request.headers.get('host') || 'localhost:3000';

        // Hapus notifikasi dengan DELETE request ke api/stock-alerts
        // Metode yang lebih eksplisit untuk menghapus notifikasi
        const stockDeleteResponse = await fetch(`${protocol}//${host}/api/stock-alerts?productId=${id}`, {
          method: 'DELETE'
        });

        if (!stockDeleteResponse.ok) {
          console.error('Error explicitly deleting stock alert:', await stockDeleteResponse.text());
          
          // Sebagai fallback, gunakan pendekatan sebelumnya jika DELETE gagal
          console.log('Trying fallback method to clear alert...');
          
          // Dapatkan nama produk untuk log
          const productName = existingProduct.name;
          
          // Buat produk dummy dengan stok tinggi untuk memicu penghapusan notifikasi
          const productForStockCheck = {
            id: id,
            name: productName,
            stock: 1000000, // Stok sangat tinggi
            threshold: existingProduct.threshold || 5,
            unit: existingProduct.unit || 'pcs',
            category: existingProduct.category
          };

          // Memanggil API stock-alerts yang sudah ada untuk menghapus notifikasi
          const stockCheckResponse = await fetch(`${protocol}//${host}/api/stock-alerts`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              products: [productForStockCheck]
            }),
          });
          
          if (stockCheckResponse.ok) {
            console.log('Stock alerts cleared via fallback method');
          }
        } else {
          const deleteResult = await stockDeleteResponse.json();
          console.log(`Stock alert deleted explicitly: ${deleteResult.deleted ? 'Success' : 'No alert found'}`);
        }
      } catch (error) {
        console.error('Error handling stock notification for deleted product:', error);
        // Jangan gagalkan seluruh request jika notifikasi gagal
      }
      
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