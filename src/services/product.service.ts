import prisma from '@/lib/prisma';
import { Product } from '@prisma/client';
import { BatchService } from './batch.service';
import { calculateCleanHpp } from '@/lib/hpp-calculator';

// Update Interface
export interface GetProductsParams {
  storeId: string;
  search?: string;
  page: number;
  limit: number;
  category?: string;
  lowStock?: boolean;
  excludeRetail?: boolean;
}


export type CreateProductData = Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted'>;

export class ProductService {
  static async getProducts({ storeId, search, page, limit, category, lowStock, excludeRetail }: GetProductsParams) {
    const skip = (page - 1) * limit;

    const where: any = {
      isDeleted: false,
      storeId: storeId
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (category) {
      where.category = category;
    }

    if (lowStock) {
       where.AND = [
          { threshold: { not: null } },
          { stock: { lte: prisma.product.fields.threshold } }
       ];
    }

    if (excludeRetail) {
      // Filter out products that are converted from other products (i.e. they are retail units)
      // If a product has a 'convertedFrom' relation, it means it is a child/retail product?
      // WAIT. Let's re-verify the relation direction.
      // Product Model:
      // conversionTargetId String?
      // conversionTarget Product? @relation("ProductConversion", ... fields: [conversionTargetId])
      // convertedFrom Product[] @relation("ProductConversion")
      
      // If Product A (Sack) converts to Product B (Ecer).
      // Product A has conversionTargetId = Product B.
      // Product B is the target.
      
      // We want to exclude Product B (Retail/Child).
      // Product B is the TARGET of a conversion.
      // Product B does NOT have conversionTargetId pointing to something else (unless multi-level).
      // But Product B IS pointed to by Product A.
      
      // The relation "ProductConversion" is defined on `conversionTarget` using `conversionTargetId`.
      // The reverse relation is `convertedFrom`.
      
      // If I am Product B (Retail), `convertedFrom` should contain Product A (Sack).
      // Because Product A references Product B as its target.
      
      // So if `excludeRetail` is TRUE, we want to exclude products that represent the RESULT of a conversion.
      // These products are referenced by OTHER products via `conversionTargetId`.
      // So they have incoming relations "convertedFrom".
      
      // So we want products where `convertedFrom` is empty.
      
      where.convertedFrom = {
        none: {}
      };
    }

    const [total, products] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: limit,
        include: {
          supplier: {
            select: {
              id: true,
              name: true
            }
          },
          batches: {
            where: { stock: { gt: 0 } },
            orderBy: { expiryDate: 'asc' }
          },
          convertedFrom: {
            select: {
              id: true,
              name: true,
              unit: true,
              stock: true,
              conversionRate: true
            }
          }
        }
      })
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      products,
      pagination: {
        total,
        page,
        limit,
        totalPages
      }
    };
  }

  static async createProduct(storeId: string, data: Partial<CreateProductData>) {
    // Validasi supplier jika ada
    if (data.supplierId) {
      const supplier = await prisma.supplier.findFirst({
        where: {
          id: data.supplierId,
          storeId: storeId
        }
      });

      if (!supplier) {
        throw new Error("Supplier tidak ditemukan atau tidak termasuk dalam toko Anda");
      }
    }

    // Validasi barcode unik
    if (data.barcode) {
      const existingProduct = await prisma.product.findFirst({
        where: {
          barcode: data.barcode,
          storeId: storeId,
          isDeleted: false
        }
      });

      if (existingProduct) {
        throw new Error("Barcode sudah digunakan oleh produk lain di toko Anda");
      }
    }

    // Validasi product_code (SKU) unik
    if (data.product_code) {
      const existingProduct = await prisma.product.findUnique({
        where: {
          storeId_product_code: {
            storeId: storeId,
            product_code: data.product_code
          }
        }
      });

      if (existingProduct) {
        throw new Error("Kode Produk (SKU) sudah digunakan");
      }
    }

    return prisma.$transaction(async (tx) => {
      // 1. Create product with 0 stock (to be incremented by batch service)
      const product = await tx.product.create({
        data: {
          name: data.name!,
          product_code: data.product_code ?? null,
          description: data.description ?? null,
          barcode: data.barcode ?? null,
          category: data.category!,
          price: data.price!,
          stock: 0, // Set to 0, let batch service handle the increment
          unit: data.unit ?? 'pcs',
          threshold: data.threshold ?? null,
          purchase_price: data.purchase_price ?? null,
          min_selling_price: data.min_selling_price ?? null,
          batch_number: data.batch_number ?? null,
          expiry_date: data.expiry_date ?? null,
          purchase_date: data.purchase_date ?? null,
          supplierId: data.supplierId ?? null,
          conversionTargetId: (data as any).conversionTargetId ?? null,
          conversionRate: (data as any).conversionRate ?? null,
          storeId: storeId,
          hppCalculationDetails: (data as any).hpp_calculation_details ?? null,
          hpp_price: calculateCleanHpp(data.purchase_price ?? null, (data as any).hpp_calculation_details)
        }
      });

      // 2. Add initial batch if stock provided
      if (data.stock && data.stock > 0) {
        await BatchService.addBatch({
          productId: product.id,
          stock: data.stock,
          expiryDate: data.expiry_date,
          batchNumber: data.batch_number,
          purchasePrice: data.purchase_price
        }, tx);
      }

      // Return product with the correct stock value (for response consistency)
      return { ...product, stock: data.stock || 0 };
    });
  }
}
