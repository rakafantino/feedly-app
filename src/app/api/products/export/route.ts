import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET() {
  try {
    // Validasi sesi dan izin
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const products = await prisma.product.findMany({
      where: {
        isDeleted: false,
      },
      orderBy: {
        updatedAt: 'desc',
      },
      include: {
        supplier: true,
      },
    });

    // Membuat CSV header
    const headers = [
      "name", 
      "description", 
      "category", 
      "price", 
      "stock", 
      "unit", 
      "barcode", 
      "supplier", 
      "threshold"
    ];

    // Mengubah data produk menjadi format CSV
    const csvRows = [
      headers.join(','), // header row
      ...products.map((product: any) => [
        `"${(product.name || '').replace(/"/g, '""')}"`,
        `"${(product.description || '').replace(/"/g, '""')}"`,
        `"${(product.category || '').replace(/"/g, '""')}"`,
        product.price,
        product.stock,
        `"${(product.unit || '').replace(/"/g, '""')}"`,
        `"${(product.barcode || '').replace(/"/g, '""')}"`,
        `"${(product.supplier?.name || '').replace(/"/g, '""')}"`,
        product.threshold || ''
      ].join(','))
    ];

    const csvContent = csvRows.join('\n');

    // Return CSV file
    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="products-export-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error("Error exporting products:", error);
    return NextResponse.json(
      { error: "Failed to export products" },
      { status: 500 }
    );
  }
} 