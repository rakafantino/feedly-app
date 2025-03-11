import { NextRequest, NextResponse } from 'next/server';
import prisma  from '@/lib/prisma';

// Get all products with optional pagination and filtering
export async function GET(request: NextRequest) {
  try {
    // Parse URL parameters
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '100', 10); // Default to a high limit if not specified
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    
    // Base query conditions
    const where: any = {};
    
    // Add category filter if provided
    if (category) {
      where.category = category;
    }
    
    // Add search filter if provided
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } },
      ];
    }
    
    // Calculate pagination
    const skip = (page - 1) * limit;
    
    // Get products with pagination and optional filtering
    const products = await prisma.product.findMany({
      where,
      orderBy: {
        name: 'asc'
      },
      skip: skip,
      take: limit,
    });
    
    // Get total count for pagination
    const totalCount = await prisma.product.count({ where });
    
    // Return products with pagination metadata
    return NextResponse.json({
      products,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
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