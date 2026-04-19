import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

import { withAuth } from "@/lib/api-middleware";
import { purchaseOrderUpdateSchema, receiveGoodsSchema } from "@/lib/validations/purchase-order";
import { BatchService } from "@/services/batch.service";
import { calculatePriceChange } from "@/lib/price-history";
import { calculateCleanHpp, calculateMinSellingPrice } from "@/lib/hpp-calculator";

// GET /api/purchase-orders/[id]
// Mengambil detail purchase order berdasarkan ID
export const GET = withAuth(
  async (request: NextRequest, session, storeId) => {
    try {
      const pathname = request.nextUrl.pathname;
      const purchaseOrderId = pathname.split("/").pop();

      if (!purchaseOrderId) {
        return NextResponse.json({ error: "ID Purchase order tidak valid" }, { status: 400 });
      }

      try {
        // Ambil data dari database
        const purchaseOrder = await prisma.purchaseOrder.findFirst({
          where: {
            id: purchaseOrderId,
            storeId: storeId!,
          },
          include: {
            supplier: true,
            payments: {
              orderBy: {
                paidAt: "desc",
              },
            },
            items: {
              include: {
                product: true,
              },
            },
          },
        });

        if (!purchaseOrder) {
          return NextResponse.json({ error: "Purchase order tidak ditemukan" }, { status: 404 });
        }

        // Format data untuk frontend
        const formattedPO = {
          id: purchaseOrder.id,
          poNumber: purchaseOrder.poNumber,
          supplierId: purchaseOrder.supplierId,
          supplier: {
            id: purchaseOrder.supplier.id,
            name: purchaseOrder.supplier.name,
            phone: purchaseOrder.supplier.phone || "",
            address: purchaseOrder.supplier.address || "",
            email: purchaseOrder.supplier.email || null,
            code: purchaseOrder.supplier.code || null,
          },
          supplierName: purchaseOrder.supplier.name,
          supplierPhone: purchaseOrder.supplier.phone || null,
          status: purchaseOrder.status,
          paymentStatus: (purchaseOrder as any).paymentStatus,
          amountPaid: (purchaseOrder as any).amountPaid,
          remainingAmount: (purchaseOrder as any).remainingAmount,
          totalAmount: (purchaseOrder as any).totalAmount,
          dueDate: (purchaseOrder as any).dueDate ? (purchaseOrder as any).dueDate.toISOString() : null,
          createdAt: purchaseOrder.createdAt.toISOString(),
          estimatedDelivery: purchaseOrder.estimatedDelivery ? purchaseOrder.estimatedDelivery.toISOString() : null,
          notes: purchaseOrder.notes,
          payments: purchaseOrder.payments.map((payment: any) => ({
            id: payment.id,
            amount: payment.amount,
            paymentMethod: payment.paymentMethod,
            notes: payment.notes,
            paidAt: payment.paidAt.toISOString(),
          })),
          items: purchaseOrder.items.map((item: any) => ({
            id: item.id,
            productId: item.productId,
            productName: item.product.name,
            quantity: item.quantity,
            receivedQuantity: item.receivedQuantity || 0,
            unit: item.unit,
            price: item.price,
          })),
        };

        return NextResponse.json({ purchaseOrder: formattedPO });
      } catch (dbError) {
        console.error("Database error:", dbError);
        return NextResponse.json({ error: "Terjadi kesalahan database" }, { status: 500 });
      }
    } catch (error) {
      console.error(`GET /api/purchase-orders/[id] error:`, error);
      return NextResponse.json({ error: "Terjadi kesalahan saat mengambil data purchase order" }, { status: 500 });
    }
  },
  { requireStore: true },
);

// PUT /api/purchase-orders/[id]
// Mengupdate purchase order berdasarkan ID
export const PUT = withAuth(
  async (request: NextRequest, session, storeId) => {
    try {
      const pathname = request.nextUrl.pathname;
      const purchaseOrderId = pathname.split("/").pop();

      if (!purchaseOrderId) {
        return NextResponse.json({ error: "ID Purchase order tidak valid" }, { status: 400 });
      }

      const body = await request.json();

      // 1. Cek apakah ini operasi Penerimaan Barang (Partial/Full)
      const receiveResult = receiveGoodsSchema.safeParse(body);

      const existingPO = await prisma.purchaseOrder.findFirst({
        where: {
          id: purchaseOrderId,
          storeId: storeId!,
        },
        include: { items: true },
      });

      if (!existingPO) {
        return NextResponse.json({ error: "Purchase order tidak ditemukan" }, { status: 404 });
      }

      if (receiveResult.success) {
        // --- LOGIC PENERIMAAN BARANG ---
        const receiveData = receiveResult.data;

        await prisma.$transaction(
          async (tx: any) => {
            let allItemsComplete = true;

            // Proses setiap item yang diterima
            for (const receivedItem of receiveData.items) {
              const currentItem = existingPO.items.find((i: any) => i.id === receivedItem.id);
              if (!currentItem) continue;

              if (receivedItem.receivedQuantity > 0) {
                // Check if specific batches are provided
                if (receivedItem.batches && receivedItem.batches.length > 0) {
                  for (const batch of receivedItem.batches) {
                    if (batch.quantity > 0) {
                      await BatchService.addBatch(
                        {
                          productId: currentItem.productId,
                          stock: batch.quantity,
                          expiryDate: batch.expiryDate ? new Date(batch.expiryDate) : undefined,
                          batchNumber: batch.batchNumber,
                          purchasePrice: typeof currentItem.price === "string" ? parseFloat(currentItem.price) : currentItem.price, // Use PO item price
                        },
                        tx,
                      );
                    }
                  }
                } else {
                  // Fallback to Generic Batch if no details provided
                  await BatchService.addGenericBatch(currentItem.productId, receivedItem.receivedQuantity, tx);
                }

                // Update the master product's purchase_price to reflect the latest PO price
                // Note: BatchService.addBatch already increments the stock, so we only update the price here
                const existingProd = await tx.product.findUnique({ where: { id: currentItem.productId } });
                const newPurchasePrice = typeof currentItem.price === "string" ? parseFloat(currentItem.price) : currentItem.price;

                const updatedProduct = await tx.product.update({
                  where: { id: currentItem.productId },
                  data: {
                    purchase_price: newPurchasePrice,
                    hpp_price: calculateCleanHpp(newPurchasePrice, existingProd?.hppCalculationDetails),
                    min_selling_price: calculateMinSellingPrice(newPurchasePrice, existingProd?.hppCalculationDetails),
                  },
                });

                // Create Price History if purchase_price changed
                if (existingProd && existingProd.purchase_price !== newPurchasePrice) {
                  const change = calculatePriceChange(existingProd.purchase_price, newPurchasePrice);
                  await tx.priceHistory.create({
                    data: {
                      productId: currentItem.productId,
                      storeId: storeId!,
                      priceType: 'PURCHASE',
                      oldPrice: existingProd.purchase_price || 0,
                      newPrice: newPurchasePrice,
                      changeAmount: change.changeAmount,
                      changePercentage: change.changePercentage,
                      source: 'PURCHASE_ORDER',
                      referenceId: purchaseOrderId,
                    }
                  });
                }

                // Cascade update to retail (child) product if it exists
                if (updatedProduct.conversionTargetId && updatedProduct.conversionRate && updatedProduct.purchase_price) {
                  const newChildPurchasePrice = Math.round(updatedProduct.purchase_price / updatedProduct.conversionRate);
                  
                  // Get child to check old price
                  const existingChild = await tx.product.findUnique({
                    where: { id: updatedProduct.conversionTargetId }
                  });

                  await tx.product.updateMany({
                    where: {
                      id: updatedProduct.conversionTargetId,
                      storeId: storeId!,
                    },
                    data: {
                      purchase_price: newChildPurchasePrice,
                      hpp_price: calculateCleanHpp(newChildPurchasePrice, existingChild?.hppCalculationDetails),
                      min_selling_price: calculateMinSellingPrice(newChildPurchasePrice, existingChild?.hppCalculationDetails),
                    },
                  });

                  // Create Price History for Child if changed
                  if (existingChild && existingChild.purchase_price !== newChildPurchasePrice) {
                     const childChange = calculatePriceChange(existingChild.purchase_price, newChildPurchasePrice);
                     await tx.priceHistory.create({
                      data: {
                        productId: updatedProduct.conversionTargetId,
                        storeId: storeId!,
                        priceType: 'PURCHASE',
                        oldPrice: existingChild.purchase_price || 0,
                        newPrice: newChildPurchasePrice,
                        changeAmount: childChange.changeAmount,
                        changePercentage: childChange.changePercentage,
                        source: 'SYSTEM_CASCADE',
                        referenceId: purchaseOrderId,
                      }
                    });
                  }
                }

                await tx.purchaseOrderItem.update({
                  where: { id: receivedItem.id },
                  data: { receivedQuantity: { increment: receivedItem.receivedQuantity } },
                });
              }

              const totalReceived = (currentItem.receivedQuantity || 0) + receivedItem.receivedQuantity;
              if (totalReceived < currentItem.quantity) {
                allItemsComplete = false;
              }
            }

            let newStatus = "partially_received";
            if (receiveData.closePo || allItemsComplete) {
              newStatus = "received";
            }

            await tx.purchaseOrder.update({
              where: { id: purchaseOrderId },
              data: { status: newStatus },
            });
          },
          {
            maxWait: 10000, // 10 seconds
            timeout: 30000, // 30 seconds
          },
        );
      } else if (body.action === "update_prices" && Array.isArray(body.items)) {
        // --- LOGIC RETROACTIVE PRICE UPDATE ---
        await prisma.$transaction(
          async (tx: any) => {
            let newTotalAmount = 0;
            let pricesChanged = false;

            for (const itemToUpdate of body.items) {
              const currentItem = existingPO.items.find((i: any) => i.id === itemToUpdate.id);
              if (!currentItem) continue;

              const newPrice = typeof itemToUpdate.price === "string" ? parseFloat(itemToUpdate.price) : itemToUpdate.price;
              
              // Only update if price actually changed
              if (currentItem.price !== newPrice) {
                pricesChanged = true;
                
                await tx.purchaseOrderItem.update({
                  where: { id: currentItem.id },
                  data: { price: newPrice },
                });

                // Check if we need to update master product price
                const masterProduct = await tx.product.findUnique({ where: { id: currentItem.productId } });
                
                // If master product's current purchase price matches the old PO price,
                // it implies this PO was the latest setter, so we update the master product.
                if (masterProduct && masterProduct.purchase_price === currentItem.price) {
                  const updatedProduct = await tx.product.update({
                    where: { id: currentItem.productId },
                    data: { 
                      purchase_price: newPrice,
                      hpp_price: calculateCleanHpp(newPrice, masterProduct.hppCalculationDetails),
                      min_selling_price: calculateMinSellingPrice(newPrice, masterProduct.hppCalculationDetails)
                    },
                  });

                  const change = calculatePriceChange(currentItem.price, newPrice);
                  await tx.priceHistory.create({
                    data: {
                      productId: currentItem.productId,
                      storeId: storeId!,
                      priceType: 'PURCHASE',
                      oldPrice: currentItem.price,
                      newPrice: newPrice,
                      changeAmount: change.changeAmount,
                      changePercentage: change.changePercentage,
                      source: 'RETROACTIVE_PO_EDIT',
                      referenceId: purchaseOrderId,
                    }
                  });

                  // Cascade to child
                  if (updatedProduct.conversionTargetId && updatedProduct.conversionRate) {
                    const newChildPurchasePrice = Math.round(newPrice / updatedProduct.conversionRate);
                    
                    const existingChild = await tx.product.findUnique({
                      where: { id: updatedProduct.conversionTargetId }
                    });

                    if (existingChild && existingChild.purchase_price !== newChildPurchasePrice) {
                      await tx.product.updateMany({
                        where: { id: updatedProduct.conversionTargetId, storeId: storeId! },
                        data: { 
                          purchase_price: newChildPurchasePrice, 
                          hpp_price: calculateCleanHpp(newChildPurchasePrice, existingChild.hppCalculationDetails),
                          min_selling_price: calculateMinSellingPrice(newChildPurchasePrice, existingChild.hppCalculationDetails)
                        },
                      });

                      const childChange = calculatePriceChange(existingChild.purchase_price, newChildPurchasePrice);
                      await tx.priceHistory.create({
                        data: {
                          productId: updatedProduct.conversionTargetId,
                          storeId: storeId!,
                          priceType: 'PURCHASE',
                          oldPrice: existingChild.purchase_price || 0,
                          newPrice: newChildPurchasePrice,
                          changeAmount: childChange.changeAmount,
                          changePercentage: childChange.changePercentage,
                          source: 'SYSTEM_CASCADE',
                          referenceId: purchaseOrderId,
                        }
                      });
                    }
                  }
                }
              }

              // Add to new total regardless of if it changed, using the correct price
              newTotalAmount += currentItem.quantity * (currentItem.price !== newPrice ? newPrice : currentItem.price);
            }

            if (pricesChanged) {
              // Recalculate remaining amount and payment status
              const remainingAmount = newTotalAmount - (existingPO.amountPaid || 0);
              let newPaymentStatus = "UNPAID";
              if (remainingAmount <= 0) {
                newPaymentStatus = "PAID";
              } else if ((existingPO.amountPaid || 0) > 0) {
                newPaymentStatus = "PARTIAL";
              }

              await tx.purchaseOrder.update({
                where: { id: purchaseOrderId },
                data: {
                  totalAmount: newTotalAmount,
                  remainingAmount: Math.max(0, remainingAmount),
                  paymentStatus: newPaymentStatus,
                },
              });
            }
          }
        );
      } else {
        // --- LOGIC UPDATE BIASA ---
        const result = purchaseOrderUpdateSchema.safeParse(body);
        if (!result.success) {
          return NextResponse.json({ error: "Validasi gagal", details: result.error.flatten() }, { status: 400 });
        }
        const data = result.data;

        const isCompletingLegacy = data.status === "received" && existingPO.status !== "received";

        if (isCompletingLegacy) {
          await prisma.$transaction(
            async (tx: any) => {
              await tx.purchaseOrder.update({
                where: { id: purchaseOrderId },
                data: {
                  status: "received",
                  ...(data.notes !== undefined && { notes: data.notes }),
                  ...(data.estimatedDelivery !== undefined && {
                    estimatedDelivery: data.estimatedDelivery ? new Date(data.estimatedDelivery) : null,
                  }),
                },
              });

              for (const item of existingPO.items) {
                const remaining = item.quantity - (item.receivedQuantity || 0);
                if (remaining > 0) {
                  await tx.product.update({
                    where: { id: item.productId },
                    data: { stock: { increment: remaining } },
                  });
                  await tx.purchaseOrderItem.update({
                    where: { id: item.id },
                    data: { receivedQuantity: item.quantity },
                  });
                }
              }
            },
            {
              maxWait: 10000, // 10 seconds
              timeout: 30000, // 30 seconds
            },
          );
        } else {
          await prisma.purchaseOrder.update({
            where: { id: purchaseOrderId },
            data: {
              ...(data.status && { status: data.status }),
              ...(data.notes !== undefined && { notes: data.notes }),
              ...(data.estimatedDelivery !== undefined && {
                estimatedDelivery: data.estimatedDelivery ? new Date(data.estimatedDelivery) : null,
              }),
            },
          });
        }
      }

      // Refetch final state for response consistency
      const refetchedPO = await prisma.purchaseOrder.findFirst({
        where: {
          id: purchaseOrderId,
          storeId: storeId!,
        },
        include: {
          supplier: true,
          payments: {
            orderBy: {
              paidAt: "desc",
            },
          },
          items: { include: { product: true } },
        },
      });

      if (!refetchedPO) throw new Error("Gagal mengambil data update PO");
      const updatedPO = refetchedPO;

      // Format data untuk frontend
      const formattedPO = {
        id: updatedPO.id,
        poNumber: updatedPO.poNumber,
        supplierId: updatedPO.supplierId,
        supplier: {
          id: updatedPO.supplier.id,
          name: updatedPO.supplier.name,
          phone: updatedPO.supplier.phone || "",
          address: updatedPO.supplier.address || "",
          email: updatedPO.supplier.email || null,
          code: updatedPO.supplier.code || null,
        },
        supplierName: updatedPO.supplier.name,
        supplierPhone: updatedPO.supplier.phone || null,
        status: updatedPO.status,
        createdAt: updatedPO.createdAt.toISOString(),
        estimatedDelivery: updatedPO.estimatedDelivery ? updatedPO.estimatedDelivery.toISOString() : null,
        notes: updatedPO.notes,
        payments: updatedPO.payments.map((payment: any) => ({
          id: payment.id,
          amount: payment.amount,
          paymentMethod: payment.paymentMethod,
          notes: payment.notes,
          paidAt: payment.paidAt.toISOString(),
        })),
        items: updatedPO.items.map((item: any) => ({
          id: item.id,
          productId: item.productId,
          productName: item.product.name,
          quantity: item.quantity,
          receivedQuantity: item.receivedQuantity || 0,
          unit: item.unit,
          price: item.price,
        })),
      };

      return NextResponse.json({ purchaseOrder: formattedPO });
    } catch (error) {
      console.error(`PUT /api/purchase-orders/[id] error:`, error);
      return NextResponse.json({ error: "Terjadi kesalahan saat memperbarui purchase order" }, { status: 500 });
    }
  },
  { requireStore: true },
);

// DELETE /api/purchase-orders/[id]
// Menghapus purchase order berdasarkan ID
export const DELETE = withAuth(
  async (request: NextRequest, session, storeId) => {
    try {
      const pathname = request.nextUrl.pathname;
      const purchaseOrderId = pathname.split("/").pop();

      if (!purchaseOrderId) {
        return NextResponse.json({ error: "ID Purchase order tidak valid" }, { status: 400 });
      }

      try {
        // Cek apakah PO ada dan milik toko
        const existingPO = await prisma.purchaseOrder.findFirst({
          where: {
            id: purchaseOrderId,
            storeId: storeId!,
          },
        });

        if (!existingPO) {
          return NextResponse.json({ error: "Purchase order tidak ditemukan" }, { status: 404 });
        }

        // Hapus PO
        await prisma.purchaseOrder.delete({
          where: { id: purchaseOrderId },
        });

        return NextResponse.json({ message: "Purchase order berhasil dihapus" }, { status: 200 });
      } catch (dbError) {
        console.error("Database error:", dbError);
        return NextResponse.json({ error: "Terjadi kesalahan saat menghapus purchase order" }, { status: 500 });
      }
    } catch (error) {
      console.error(`DELETE /api/purchase-orders/[id] error:`, error);
      return NextResponse.json({ error: "Terjadi kesalahan saat menghapus purchase order" }, { status: 500 });
    }
  },
  { requireStore: true },
);
