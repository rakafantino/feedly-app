import { NextRequest, NextResponse } from 'next/server';
import prisma  from '@/lib/prisma';

// Get all products
export async function GET() {
  try {
    const products = await prisma.product.findMany({
      orderBy: {
        name: 'asc'
      }
    });
    
    return NextResponse.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}

// Create a new product
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validasi data
    if (!body.name || !body.price || !body.unit) {
      return NextResponse.json(
        { error: 'Name, price, and unit are required' },
        { status: 400 }
      );
    }

    // Konversi price ke number untuk memastikan format yang benar
    const price = Number(body.price);
    if (isNaN(price)) {
      return NextResponse.json(
        { error: 'Price must be a valid number' },
        { status: 400 }
      );
    }

    // Konversi stock ke number
    const stock = Number(body.stock || 0);
    if (isNaN(stock)) {
      return NextResponse.json(
        { error: 'Stock must be a valid number' },
        { status: 400 }
      );
    }
    
    // Buat produk baru
    const product = await prisma.product.create({
      data: {
        name: body.name,
        price,
        stock,
        unit: body.unit,
        barcode: body.barcode || null,
        category: body.category || null,
        supplierId: body.supplierId || null,
      },
    });
    
    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error('Error creating product:', error);
    return NextResponse.json(
      { error: 'Failed to create product' },
      { status: 500 }
    );
  }
} 