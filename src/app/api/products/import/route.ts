import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-middleware";

export const POST = withAuth(
  async (request: Request, session: any, storeId: string | null) => {
    try {
      if (!storeId) {
        return NextResponse.json({ error: "Store selection required" }, { status: 400 });
      }

      const formData = await request.formData();
      const file = formData.get("file") as File;

      if (!file) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 });
      }

      const text = await file.text();

      if (!text || text.trim() === "") {
        return NextResponse.json({ error: "CSV file is empty" }, { status: 400 });
      }

      const lines = text.split("\n").filter((line) => line.trim() !== "");

      if (lines.length < 2) {
        return NextResponse.json({ error: "CSV file is empty or invalid" }, { status: 400 });
      }

      let headerIndex = 0;
      if (lines[0].trim().startsWith("#")) {
        headerIndex = 1;
        if (lines.length < 3) {
          return NextResponse.json({ error: "CSV file doesn't have enough data" }, { status: 400 });
        }
      }

      const headerLine = lines[headerIndex];
      const headers = parseCSVLine(headerLine).map((h) => h.trim());

      const requiredHeaders = ["name", "price", "stock", "unit"];
      const missingHeaders = requiredHeaders.filter((h) => !headers.includes(h));

      if (missingHeaders.length > 0) {
        return NextResponse.json(
          {
            error: `Missing required headers: ${missingHeaders.join(", ")}`,
          },
          { status: 400 },
        );
      }

      const products: any[] = [];
      const errors: string[] = [];

      for (let i = headerIndex + 1; i < lines.length; i++) {
        try {
          if (lines[i].trim() === "" || lines[i].trim().startsWith("#")) {
            continue;
          }

          const values = parseCSVLine(lines[i]);

          if (values.length !== headers.length) {
            errors.push(`Line ${i + 1}: Column count mismatch. Expected ${headers.length}, got ${values.length}`);
            continue;
          }

          const productData: Record<string, any> = {};
          headers.forEach((header, index) => {
            let value = values[index];

            if (value.startsWith('"') && value.endsWith('"')) {
              value = value.substring(1, value.length - 1).replace(/""/g, '"');
            }

            if (header === "price" || header === "stock" || header === "threshold") {
              const numValue = parseFloat(value);
              productData[header] = isNaN(numValue) ? null : numValue;
            } else {
              productData[header] = value || null;
            }
          });

          if (!productData.name || productData.name.trim() === "") {
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

          let supplierId = null;

          if (productData.supplier_code) {
            const supplier = await prisma.supplier.findFirst({
              where: { code: productData.supplier_code, storeId: storeId },
            });
            if (supplier) supplierId = supplier.id;
          }

          if (!supplierId && (productData.supplier_name || productData.supplier)) {
            const supplierName = productData.supplier_name || productData.supplier;
            const supplier = await prisma.supplier.findFirst({
              where: { name: supplierName, storeId: storeId },
            });
            if (supplier) supplierId = supplier.id;
          }

          let productCode = productData.product_code;
          if (!productCode && productData.name) {
            const cleanName = productData.name
              .toString()
              .toUpperCase()
              .replace(/[^A-Z0-9]/g, "")
              .substring(0, 5);
            const random = Math.floor(Math.random() * 1000)
              .toString()
              .padStart(3, "0");
            productCode = `${cleanName}-${random}`;
          }

          products.push({
            name: productData.name,
            product_code: productCode,
            description: productData.description,
            category: productData.category,
            price: productData.price,
            stock: productData.stock,
            unit: productData.unit,
            barcode: productData.barcode,
            supplierId: supplierId,
            threshold: productData.threshold,
            storeId: storeId,
          });
        } catch (error) {
          errors.push(`Line ${i + 1}: ${(error as Error).message}`);
        }
      }

      let importedCount = 0;
      const skippedProducts: string[] = [];

      if (products.length > 0) {
        try {
          await prisma.$transaction(async (tx: any) => {
            for (const product of products) {
              try {
                let existingProduct = null;

                if (product.product_code) {
                  existingProduct = await tx.product.findUnique({
                    where: { product_code: product.product_code },
                  });
                }

                if (!existingProduct && product.barcode) {
                  existingProduct = await tx.product.findFirst({
                    where: { barcode: product.barcode, isDeleted: false },
                  });
                }

                if (existingProduct) {
                  const updateData: any = { ...product };
                  delete updateData.supplierId;

                  if (product.supplierId) {
                    updateData.productSuppliers = {
                      deleteMany: { supplierId: product.supplierId },
                      create: { supplierId: product.supplierId, isDefault: true },
                    };
                  }

                  await tx.product.update({
                    where: { id: existingProduct.id },
                    data: updateData,
                  });
                } else {
                  const createData: any = { ...product };
                  delete createData.supplierId;

                  if (product.supplierId) {
                    createData.productSuppliers = {
                      create: { supplierId: product.supplierId, isDefault: true },
                    };
                  }

                  await tx.product.create({ data: createData });
                }

                importedCount++;
              } catch (innerError) {
                if ((innerError as any).code === "P2002") {
                  const target = (innerError as any).meta?.target;

                  if (Array.isArray(target) ? target.includes("barcode") : target === "barcode") {
                    skippedProducts.push(`Baris dengan barcode ${product.barcode}: duplikat barcode yang sudah ada`);
                    errors.push(`Barcode "${product.barcode}" sudah digunakan oleh produk lain`);
                  } else if (Array.isArray(target) ? target.includes("product_code") : target === "product_code") {
                    skippedProducts.push(`Baris dengan SKU ${product.product_code}: duplikat SKU`);
                    errors.push(`Kode Produk (SKU) "${product.product_code}" sudah digunakan`);
                  } else {
                    throw innerError;
                  }
                } else {
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
        errors: errors,
      });
    } catch (error) {
      console.error("Error importing products:", error);
      return NextResponse.json({ error: "Failed to import products" }, { status: 500 });
    }
  },
  { requireStore: true },
);

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);

  return result;
}
