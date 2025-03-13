import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    // Validasi sesi dan izin
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("Processing import request");

    // Mendapatkan file dari form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      console.log("No file provided in request");
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    console.log(`Received file: ${file.name}, size: ${file.size} bytes, type: ${file.type}`);

    // Membaca dan memproses file CSV
    const text = await file.text();
    console.log(`CSV content length: ${text.length} characters`);
    
    if (!text || text.trim() === '') {
      return NextResponse.json({ error: "CSV file is empty" }, { status: 400 });
    }

    // Split by lines and filter empty lines
    const lines = text.split('\n').filter(line => line.trim() !== '');
    console.log(`CSV lines count: ${lines.length}`);
    
    if (lines.length < 2) {
      return NextResponse.json({ error: "CSV file is empty or invalid" }, { status: 400 });
    }

    // Lewati baris komentar
    let headerIndex = 0;
    if (lines[0].trim().startsWith('#')) {
      headerIndex = 1;
      if (lines.length < 3) { // Header + minimal 1 data
        return NextResponse.json({ error: "CSV file doesn't have enough data" }, { status: 400 });
      }
    }

    // Mendapatkan header dan memvalidasi
    const headerLine = lines[headerIndex];
    console.log(`Header line: ${headerLine}`);
    
    // Parse headers, handling quoted values
    const headers = parseCSVLine(headerLine).map(h => h.trim());
    console.log(`Parsed headers: ${headers.join(', ')}`);
    
    const requiredHeaders = ['name', 'price', 'stock', 'unit'];
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
    
    if (missingHeaders.length > 0) {
      return NextResponse.json({ 
        error: `Missing required headers: ${missingHeaders.join(', ')}` 
      }, { status: 400 });
    }

    // Memproses data produk
    const products: any[] = [];
    const errors: string[] = [];
    
    // Start from the line after header, skip comments
    for (let i = headerIndex + 1; i < lines.length; i++) {
      try {
        // Skip empty lines
        if (lines[i].trim() === '' || lines[i].trim().startsWith('#')) {
          continue;
        }
        
        const values = parseCSVLine(lines[i]);
        
        if (values.length !== headers.length) {
          errors.push(`Line ${i + 1}: Column count mismatch. Expected ${headers.length}, got ${values.length}`);
          continue;
        }

        // Membuat objek produk dari CSV
        const productData: Record<string, any> = {};
        headers.forEach((header, index) => {
          let value = values[index];
          
          // Menghapus tanda kutip jika ada
          if (value.startsWith('"') && value.endsWith('"')) {
            value = value.substring(1, value.length - 1).replace(/""/g, '"');
          }
          
          // Konversi tipe data
          if (header === 'price' || header === 'stock' || header === 'threshold') {
            const numValue = parseFloat(value);
            productData[header] = isNaN(numValue) ? null : numValue;
          } else {
            productData[header] = value || null;
          }
        });

        // Validasi data produk
        if (!productData.name || productData.name.trim() === '') {
          errors.push(`Line ${i + 1}: Product name is required`);
          continue;
        }

        if (isNaN(productData.price) || productData.price <= 0) {
          errors.push(`Line ${i + 1}: Invalid price value`);
          continue;
        }

        if (isNaN(productData.stock) || productData.stock < 0) {
          errors.push(`Line ${i + 1}: Invalid stock value`);
          continue;
        }

        // Mencari supplier jika ada
        let supplierId = null;
        if (productData.supplier) {
          const supplier = await prisma.supplier.findFirst({
            where: { name: productData.supplier }
          });
          
          if (supplier) {
            supplierId = supplier.id;
          }
        }

        // Menambahkan produk ke array untuk diproses
        products.push({
          name: productData.name,
          description: productData.description,
          category: productData.category,
          price: productData.price,
          stock: productData.stock,
          unit: productData.unit,
          barcode: productData.barcode,
          supplierId: supplierId,
          threshold: productData.threshold,
        });
      } catch (error) {
        errors.push(`Line ${i + 1}: ${(error as Error).message}`);
      }
    }

    // Menyimpan produk ke database
    let importedCount = 0;
    const skippedProducts: string[] = [];

    if (products.length > 0) {
      // Menggunakan transaction untuk memastikan semua operasi berhasil
      try {
        await prisma.$transaction(async (tx) => {
          for (const product of products) {
            try {
              // Cek apakah produk dengan barcode yang sama sudah ada
              if (product.barcode) {
                const existingProduct = await tx.product.findFirst({
                  where: { 
                    barcode: product.barcode,
                    isDeleted: false
                  }
                });
                
                if (existingProduct) {
                  // Update produk yang sudah ada
                  await tx.product.update({
                    where: { id: existingProduct.id },
                    data: product
                  });
                } else {
                  // Buat produk baru
                  await tx.product.create({ data: product });
                }
              } else {
                // Buat produk baru tanpa barcode
                await tx.product.create({ data: product });
              }
              
              importedCount++;
            } catch (innerError) {
              // Handle specific Prisma errors
              if ((innerError as any).code === 'P2002' && (innerError as any).meta?.target?.includes('barcode')) {
                // Barcode unique constraint error
                skippedProducts.push(`Baris dengan barcode ${product.barcode}: duplikat barcode yang sudah ada`);
                errors.push(`Barcode "${product.barcode}" sudah digunakan oleh produk lain`);
              } else {
                // Rethrow other errors
                throw innerError;
              }
            }
          }
        });
      } catch (txError) {
        console.error("Transaction error:", txError);
        errors.push(`Error transaksi database: ${(txError as Error).message}`);
      }
    }

    return NextResponse.json({
      imported: importedCount,
      total: lines.length - 1,
      skipped: skippedProducts.length,
      errors: errors
    });
  } catch (error) {
    console.error("Error importing products:", error);
    return NextResponse.json(
      { error: "Failed to import products" },
      { status: 500 }
    );
  }
}

// Helper function untuk parsing baris CSV dengan mempertimbangkan tanda kutip
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      // Jika karakter berikutnya juga tanda kutip, itu adalah escape untuk tanda kutip
      if (i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++; // Skip karakter berikutnya
      } else {
        // Toggle status inQuotes
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Koma di luar tanda kutip menandakan kolom baru
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  // Tambahkan kolom terakhir
  result.push(current);
  
  return result;
} 