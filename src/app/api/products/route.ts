import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-middleware';
import { productSchema } from '@/lib/validations/product';
import { ProductService } from '@/services/product.service';

// GET /api/products
export const GET = withAuth(async (request: NextRequest, session, storeId) => {
  try {
    const url = new URL(request.url);
    const result = await ProductService.getProducts({
      storeId: storeId!,
      search: url.searchParams.get('search') || '',
      page: parseInt(url.searchParams.get('page') || '1'),
      limit: parseInt(url.searchParams.get('limit') || '10'),
      category: url.searchParams.get('category') || undefined,
      lowStock: url.searchParams.get('lowStock') === 'true',
      excludeRetail: url.searchParams.get('excludeRetail') === 'true',
      minimal: url.searchParams.get('minimal') === 'true'
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('GET /api/products error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mengambil data produk' },
      { status: 500 }
    );
  }
}, { requireStore: true });

// POST /api/products
export const POST = withAuth(async (request: NextRequest, session, storeId) => {
  try {
    const body = await request.json();
    const validationResult = productSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed', 
          details: validationResult.error.flatten().fieldErrors 
        },
        { status: 400 }
      );
    }

    const product = await ProductService.createProduct(storeId!, validationResult.data);
    return NextResponse.json({ product }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/products error:', error);
    
    // Check for known business errors
    const isBusinessError = error.message === "Supplier tidak ditemukan atau tidak termasuk dalam toko Anda" ||
                            error.message === "Barcode sudah digunakan oleh produk lain di toko Anda";

    return NextResponse.json(
      { error: error.message || 'Terjadi kesalahan saat menambahkan produk' },
      { status: isBusinessError ? 400 : 500 }
    );
  }
}, { requireStore: true });
 