import prisma from '@/lib/prisma';
import { Product } from '@prisma/client';
import { BatchService } from './batch.service';

export interface GetProductsParams {
  storeId: string;
  search?: string;
  page: number;
  limit: number;
  category?: string;
}

export type CreateProductData = Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted'>;

export class ProductService {
  static async getProducts({ storeId, search, page, limit, category }: GetProductsParams) {
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
      const supplier = await prisma.supplier.findUnique({
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
          product_code: data.product_code
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
          hppCalculationDetails: (data as any).hpp_calculation_details ?? null
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
