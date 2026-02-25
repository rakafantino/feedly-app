import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-middleware";
import { NotificationService } from "@/services/notification.service";
import { productUpdateSchema } from "@/lib/validations/product";
import { BatchService } from "@/services/batch.service";
import { calculateCleanHpp } from "@/lib/hpp-calculator";

// GET /api/products/[id]
export const GET = withAuth(
  async (request: NextRequest, session, storeId) => {
    try {
      // Dapatkan ID dari URL
      const pathname = request.nextUrl.pathname;
      const id = pathname.split("/").pop();

      if (!id) {
        return NextResponse.json({ error: "ID produk tidak valid" }, { status: 400 });
      }

      // Periksa parameter query untuk pengecekan stok
      const url = new URL(request.url);
      const checkStock = url.searchParams.get("checkStock") === "true";

      // Gunakan findFirst dengan multiple conditions
      const product = await prisma.product.findFirst({
        where: {
          id,
          isDeleted: false,
          ...(storeId ? { storeId } : {}),
        },
        include: {
          supplier: true, // Tambahkan include supplier untuk mendapatkan data supplier lengkap
          convertedFrom: { select: { id: true, name: true, stock: true, unit: true, conversionRate: true } }, // Cek apakah produk ini adalah hasil konversi (barang eceran)
          batches: {
            where: { stock: { gt: 0 } }, // Only show active batches
            orderBy: { expiryDate: "asc" },
          },
        } as any, // Cast to any because Prisma types might be lagging behind schema push
      });

      // Force refresh batches if needed? No, standard query is fine as long as not cached aggressively.
      // Ensure we are not returning cached response.
      // Next.js App Router might cache GET requests.
      // But since we are using request.url and dynamic params, it should be dynamic.
      // Let's add headers to be safe.

      if (!product) {
        return NextResponse.json({ error: "Produk tidak ditemukan" }, { status: 404 });
      }

      // Jika parameter checkStock=true, periksa notifikasi stok
      if (checkStock) {
        try {
          // Direct service call instead of internal HTTP fetch
          await NotificationService.checkLowStockProducts(storeId || undefined);
          console.log("Stock alerts updated during product view");
        } catch (error) {
          console.error("Error handling stock notification during product view:", error);
          // Jangan gagalkan seluruh request jika notifikasi gagal
        }
      }

      return NextResponse.json(
        { product },
        {
          headers: {
            "Cache-Control": "no-store, max-age=0",
          },
        },
      );
    } catch (error) {
      console.error("GET /api/products error:", error);
      return NextResponse.json({ error: "Terjadi kesalahan saat mengambil data produk" }, { status: 500 });
    }
  },
  { requireStore: true },
);

// PATCH /api/products/[id] - untuk pembaruan parsial produk (seperti threshold)
export const PATCH = withAuth(
  async (request: NextRequest, session, storeId) => {
    try {
      // Dapatkan ID dari URL
      const pathname = request.nextUrl.pathname;
      const id = pathname.split("/").pop();

      if (!id) {
        return NextResponse.json({ error: "ID produk tidak valid" }, { status: 400 });
      }

      const data = await request.json();

      // Check if product exists and belongs to the store
      const existingProduct = await prisma.product.findFirst({
        where: {
          id,
          isDeleted: false,
          ...(storeId ? { storeId } : {}),
        },
      });

      if (!existingProduct) {
        return NextResponse.json({ error: "Produk tidak ditemukan" }, { status: 404 });
      }

      // Separate stock from other updates to handle via BatchService
      const { stock, ...otherData } = data;

      // Update product with non-stock fields
      const updatedProduct = await prisma.product.update({
        where: { id },
        data: otherData,
      });

      // Handle Stock Changes via BatchService
      if (stock !== undefined && existingProduct.stock !== stock) {
        const diff = stock - existingProduct.stock;

        try {
          if (diff > 0) {
            // For PATCH, we assume generic batch since we don't usually get expiry info here
            // If we wanted to support expiry in PATCH, we'd need to check data.expiry_date
            await BatchService.addGenericBatch(id, diff);
          } else if (diff < 0) {
            await BatchService.deductStock(id, Math.abs(diff));
          }
        } catch (err) {
          console.error("Error updating stock via batch service in PATCH:", err);
        }
      }

      // Jika stok atau threshold diperbarui, periksa notifikasi stok
      if ("stock" in data || "threshold" in data) {
        try {
          // Direct service call instead of internal HTTP fetch
          await NotificationService.checkLowStockProducts(storeId || undefined);
          console.log("Stock alerts updated after product edit via PATCH");

          // Jika stok sekarang di atas threshold, eksplisit hapus notifikasi
          const threshold = updatedProduct.threshold ?? 5;
          if (updatedProduct.stock > threshold) {
            try {
              // Direct service call: find notification by productId and delete
              const notifications = await NotificationService.getNotifications(storeId!);
              const removing = notifications.find((n) => n.productId === id);
              if (removing) {
                await NotificationService.deleteNotification(removing.id, storeId!);
                console.log("Stock alert explicitly deleted for non-low stock product");
              }
            } catch (deleteError) {
              console.error("Failed to explicitly delete stock alert:", deleteError);
            }
          }
        } catch (error) {
          console.error("Error handling stock notification after product edit:", error);
          // Jangan gagalkan seluruh request jika notifikasi gagal
        }
      }

      return NextResponse.json({ product: updatedProduct });
    } catch (error) {
      console.error("PATCH /api/products error:", error);
      return NextResponse.json({ error: "Terjadi kesalahan saat memperbarui produk" }, { status: 500 });
    }
  },
  { requireStore: true },
);

// PUT /api/products/[id]
// PUT /api/products/[id]
export const PUT = withAuth(
  async (request: NextRequest, session, storeId) => {
    try {
      // Dapatkan ID dari URL
      const pathname = request.nextUrl.pathname;
      const id = pathname.split("/").pop();

      if (!id) {
        return NextResponse.json({ error: "ID produk tidak valid" }, { status: 400 });
      }

      const body = await request.json();
      const retailUnit: string | undefined = body.retailUnit;
      delete body.retailUnit;

      // Check if product exists and belongs to the store
      const existingProduct = await prisma.product.findFirst({
        where: {
          id,
          ...(storeId ? { storeId } : {}),
        },
      });

      if (!existingProduct) {
        return NextResponse.json({ error: "Produk tidak ditemukan" }, { status: 404 });
      }

      // Validate input using Zod
      const validationResult = productUpdateSchema.safeParse(body);

      if (!validationResult.success) {
        return NextResponse.json(
          {
            error: "Validation failed",
            details: validationResult.error.flatten().fieldErrors,
          },
          { status: 400 },
        );
      }

      const mb = validationResult.data;

      // Check for duplicate barcode if barcode is provided and not null
      if (mb.barcode && typeof mb.barcode === "string") {
        const existingProductWithBarcode = await prisma.product.findFirst({
          where: {
            barcode: mb.barcode,
            storeId: storeId ?? undefined,
            isDeleted: false,
            NOT: {
              id: id,
            },
          },
        });

        if (existingProductWithBarcode) {
          return NextResponse.json({ error: "Barcode sudah digunakan oleh produk lain di toko Anda" }, { status: 400 });
        }
      }

      // Check for duplicate product_code (SKU) if provided
      if (mb.product_code && typeof mb.product_code === "string") {
        const existingProductWithCode = await prisma.product.findFirst({
          where: {
            product_code: mb.product_code,
            NOT: {
              id: id,
            },
          },
        });

        if (existingProductWithCode) {
          return NextResponse.json({ error: "Kode Produk (SKU) sudah digunakan oleh produk lain" }, { status: 400 });
        }
      }

      // Validasi jika supplier diubah
      if (mb.supplierId && typeof mb.supplierId === "string") {
        const supplier = await prisma.supplier.findFirst({
          where: {
            id: mb.supplierId,
            ...(storeId ? { storeId } : {}),
          },
        });

        if (!supplier) {
          return NextResponse.json({ error: "Supplier tidak ditemukan atau tidak termasuk dalam toko Anda" }, { status: 400 });
        }
      }

      // Prepare update data handling relations explicitly
      const { supplierId, conversionTargetId, stock, hpp_calculation_details, ...productData } = mb;

      const updatePayload: any = {
        ...productData,
      };

      if (hpp_calculation_details !== undefined) {
        updatePayload.hppCalculationDetails = hpp_calculation_details;
        // Recalculate HPP if details change
        updatePayload.hpp_price = calculateCleanHpp(mb.purchase_price !== undefined ? mb.purchase_price : existingProduct.purchase_price, hpp_calculation_details);
      } else if (mb.purchase_price !== undefined) {
        // Recalculate HPP if price changes but details don't (use existing details)
        updatePayload.hpp_price = calculateCleanHpp(mb.purchase_price, existingProduct.hppCalculationDetails);
      }

      // Handle Stock Changes via BatchService
      // Only if stock is explicitly provided and different from current
      if (stock !== undefined && existingProduct.stock !== stock) {
        const diff = stock - existingProduct.stock;

        try {
          if (diff > 0) {
            await BatchService.addBatch({
              productId: id,
              stock: diff,
              expiryDate: mb.expiry_date ? new Date(mb.expiry_date) : undefined,
              batchNumber: mb.batch_number || undefined,
              purchasePrice: mb.purchase_price || undefined,
            });
          } else if (diff < 0) {
            await BatchService.deductStock(id, Math.abs(diff));
          }
        } catch (err) {
          console.error("Error updating stock via batch service in PUT:", err);
          // Fallback or re-throw?
          // Failing here means stock update failed. usage should probably know.
          return NextResponse.json({ error: "Gagal memperbarui stok (validasi batch gagal)" }, { status: 400 });
        }
      }

      // Handle Supplier Relation
      if (supplierId !== undefined) {
        if (supplierId) {
          updatePayload.supplier = { connect: { id: supplierId } };
        } else {
          updatePayload.supplier = { disconnect: true };
        }
      }

      // Handle Conversion Target Relation
      if (conversionTargetId !== undefined) {
        if (conversionTargetId) {
          updatePayload.conversionTarget = { connect: { id: conversionTargetId } };
        } else {
          updatePayload.conversionTarget = { disconnect: true };
        }
      }

      const updatedProduct = await prisma.product.update({
        where: {
          id: id,
          storeId: storeId ?? undefined,
        },
        data: updatePayload,
      });

      // --- CASCADING UPDATE LOGIC START ---
      // If this product has a conversion target (retail variant) & conversion rate
      // We should cascade price & batch updates to ensure consistency
      if (updatedProduct.conversionTargetId && updatedProduct.conversionRate) {
        // Prepare child update payload
        const childUpdates: any = {};
        let hasUpdates = false;

        // 1. Sync Purchase Price (HPP)
        if (updatedProduct.purchase_price) {
          const newChildPurchasePrice = Math.round(updatedProduct.purchase_price / updatedProduct.conversionRate);
          childUpdates.purchase_price = newChildPurchasePrice;

          // Also update hpp_price for the child product to keep it in sync with the new purchase_price
          // Assuming child has no extra costs for now, or we preserve existing extra costs (harder without querying child)
          // For simplicity and to fix the immediate issue: set hpp_price = purchase_price (Clean HPP)
          // Ideally, we should fetch child, check its costs, and recalc. But bulk update doesn't support that easily.
          // Let's stick to syncing purchase_price which drives clean HPP in simple cases.
          // BETTER: Explicitly set hpp_price to the same value if we assume no extra costs for bulk sync
          childUpdates.hpp_price = newChildPurchasePrice;

          hasUpdates = true;
        }

        // 2. Sync Minimum Selling Price
        if (updatedProduct.min_selling_price) {
          childUpdates.min_selling_price = Math.round(updatedProduct.min_selling_price / updatedProduct.conversionRate);
          hasUpdates = true;
        }

        // 3. Sync Supplier
        // If parent supplier is updated or exists, sync it to child
        if (updatedProduct.supplierId !== null) {
          childUpdates.supplierId = updatedProduct.supplierId;
          hasUpdates = true;
        }

        // 3b. Sync Retail Unit (if provided from parent form)
        if (retailUnit) {
          childUpdates.unit = retailUnit;
          hasUpdates = true;
        }

        // 4. Sync Meta Data (Batch, Expiry, Purchase Date)
        // Only if they exist on parent (updates handle nulls too, but assume valid sync)
        if (updatedProduct.batch_number !== null) {
          childUpdates.batch_number = updatedProduct.batch_number;
          hasUpdates = true;
        }
        if (updatedProduct.expiry_date !== null) {
          childUpdates.expiry_date = updatedProduct.expiry_date;
          hasUpdates = true;
        }
        if (updatedProduct.purchase_date !== null) {
          childUpdates.purchase_date = updatedProduct.purchase_date;
          hasUpdates = true;
        }

        if (hasUpdates) {
          await prisma.product.updateMany({
            where: {
              id: updatedProduct.conversionTargetId,
              storeId: storeId!,
            },
            data: childUpdates,
          });
        }
      }
      // --- CASCADING UPDATE LOGIC END ---

      // Check stock alerts directly
      await NotificationService.checkLowStockProducts(storeId || undefined);

      return NextResponse.json({ product: updatedProduct });
    } catch (error) {
      console.error("PUT /api/products error:", error);
      return NextResponse.json({ error: "Terjadi kesalahan saat memperbarui produk" }, { status: 500 });
    }
  },
  { requireStore: true },
);

// DELETE /api/products/[id]
export const DELETE = withAuth(
  async (request: NextRequest, session, storeId) => {
    try {
      // Dapatkan ID dari URL
      const pathname = request.nextUrl.pathname;
      const id = pathname.split("/").pop();

      if (!id) {
        return NextResponse.json({ error: "ID produk tidak valid" }, { status: 400 });
      }

      // Check if product exists and belongs to the store
      const existingProduct = await prisma.product.findFirst({
        where: {
          id,
          ...(storeId ? { storeId } : {}),
        },
      });

      if (!existingProduct) {
        return NextResponse.json({ error: "Produk tidak ditemukan" }, { status: 404 });
      }

      // Gunakan soft delete dengan mengupdate isDeleted ke true
      await prisma.product.update({
        where: { id },
        data: { isDeleted: true },
      });

      // Cleanup: Unlink any products that use this deleted product as a conversion target
      await prisma.product.updateMany({
        where: {
          conversionTargetId: id,
        } as any,
        data: {
          conversionTargetId: null,
          conversionRate: null,
        } as any,
      });

      // Hapus semua notifikasi stok rendah untuk produk ini
      try {
        // Direct service call: find notification by productId and delete
        const notifications = await NotificationService.getNotifications(storeId!);
        const removing = notifications.find((n) => n.productId === id);
        if (removing) {
          await NotificationService.deleteNotification(removing.id, storeId!);
          console.log("Stock alert deleted for removed product");
        }
      } catch (error) {
        console.error("Error deleting stock notification for removed product:", error);
      }

      return NextResponse.json({
        success: true,
        message: "Produk berhasil dihapus",
      });
    } catch (error) {
      console.error("DELETE /api/products error:", error);
      return NextResponse.json({ error: "Terjadi kesalahan saat menghapus produk" }, { status: 500 });
    }
  },
  { requireStore: true },
);
