import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Get all products
export async function GET() {
  try {
    const products = await prisma.product.findMany({
      include: {
        supplier: true
      }
    });
    
    return NextResponse.json({ products }, { status: 200 });
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// Create a new product
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    const requiredFields = ['name', 'category', 'price', 'stock', 'unit'];
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `${field} is required` },
          { status: 400 }
        );
      }
    }
    
    // Create product
    const product = await prisma.product.create({
      data: {
        name: body.name,
        category: body.category,
        price: parseFloat(body.price),
        stock: parseFloat(body.stock),
        unit: body.unit,
        supplierId: body.supplierId || null,
        description: body.description || null,
        barcode: body.barcode || null,
        threshold: body.threshold ? parseFloat(body.threshold) : null
      }
    });
    
    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    console.error('Error creating product:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
} 