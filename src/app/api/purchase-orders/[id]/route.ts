import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

import { withAuth } from "@/lib/api-middleware";
import { purchaseOrderUpdateSchema, receiveGoodsSchema } from "@/lib/validations/purchase-order";
import { BatchService } from "@/services/batch.service";
import { calculatePriceChange } from "@/lib/price-history";
import { calculateCleanHpp, calculateMinSellingPrice } from "@/lib/hpp-calculator";
import { extractNumericPrice, calculateWeightedAverage } from "@/core/purchase-orders/receive-goods.core";
import { calculatePurchaseOrderPaymentStatus } from "@/core/purchase-orders/payment-calculator.core";

const purchaseOrderDetailInclude = {
  supplier: true,
  payments: {
    orderBy: {
      paidAt: "desc" as const,
    },
  },
  items: {
    include: {
      product: true,
    },
  },
};

function serializePurchaseOrderDetail(purchaseOrder: any) {
  return {
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
    paymentStatus: purchaseOrder.paymentStatus,
    amountPaid: purchaseOrder.amountPaid,
    remainingAmount: purchaseOrder.remainingAmount,
    totalAmount: purchaseOrder.totalAmount,
    dueDate: purchaseOrder.dueDate ? purchaseOrder.dueDate.toISOString() : null,
    createdAt: purchaseOrder.createdAt.toISOString(),
    estimatedDelivery: purchaseOrder.estimatedDelivery ? purchaseOrder.estimatedDelivery.toISOString() : null,
    notes: purchaseOrder.notes,
    payments: purchaseOrder.payments.map((payment: any) => ({
      id: payment.id,
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      notes: payment.notes,
      remainingDebtBefore: payment.remainingDebtBefore,
      remainingDebtAfter: payment.remainingDebtAfter,
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
}

async function handleReceiveGoods(purchaseOrderId: string, storeId: string | null, existingPO: any, receiveData: any) {
  await prisma.$transaction(
    async (tx) => {
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
                    purchasePrice: extractNumericPrice(currentItem.price), // Use PO item price
                  },
                  tx,
                );
              }
            }
          } else {
            // Fallback to Generic Batch if no details provided
            await BatchService.addGenericBatch(currentItem.productId, receivedItem.receivedQuantity, tx);
          }

          // Update the master product's purchase_price using weighted average
          // Note: BatchService.addBatch already increments the stock, so we only update the price here
          const existingProd = await tx.product.findUnique({ where: { id: currentItem.productId } });
          const newPurchasePrice = extractNumericPrice(currentItem.price);

          // Get existing stock from batches
          const existingBatches = await tx.productBatch.findMany({
            where: { productId: currentItem.productId, stock: { gt: 0 } },
          });
          const existingStock = existingBatches.reduce((sum, b) => sum + Number(b.stock), 0);

          // Calculate weighted average
          const newWeightedAvg = calculateWeightedAverage({
            existingStock,
            existingPrice: existingProd?.purchase_price ?? null,
            newStock: receivedItem.receivedQuantity,
            newPrice: newPurchasePrice,
          });

          console.log(`[Weighted Avg] Product ${currentItem.productId}: stock=${existingStock}, oldPrice=${existingProd?.purchase_price}, newStock=${receivedItem.receivedQuantity}, newPrice=${newPurchasePrice}, result=${newWeightedAvg}`);

          // Ensure `updatedProduct` gets populated in update to appease old logic, though we can use `existingProd`
          const updatedProduct = await tx.product.update({
            where: { id: currentItem.productId },
            data: {
              purchase_price: newWeightedAvg,
              hpp_price: calculateCleanHpp(newWeightedAvg, existingProd?.hppCalculationDetails),
              min_selling_price: calculateMinSellingPrice(newWeightedAvg, existingProd?.hppCalculationDetails),
            },
          });

          // Auto-sync ProductSupplier price
          // Check if this product already has a default supplier
          const existingDefaultSupplier = await tx.productSupplier.findFirst({
            where: {
              productId: currentItem.productId,
              isDefault: true,
            },
          });
          const shouldSetAsDefault = !existingDefaultSupplier;

          await tx.productSupplier.upsert({
            where: {
              productId_supplierId: {
                productId: currentItem.productId,
                supplierId: existingPO.supplierId,
              },
            },
            create: {
              productId: currentItem.productId,
              supplierId: existingPO.supplierId,
              price: newPurchasePrice,
              isDefault: shouldSetAsDefault,
            },
            update: {
              price: newPurchasePrice,
            },
          });
          console.log(`[handleReceiveGoods] ProductSupplier upserted for product ${currentItem.productId}, supplier ${existingPO.supplierId}, price ${newPurchasePrice}, isDefault=${shouldSetAsDefault}`);

          // Create Price History using the actual PO item price (harga rill beli),
          // not the weighted average. This aligns with the design spec: the
          // Riwayat Perubahan Harga should reflect what was actually paid on the PO,
          // while product.purchase_price (modal) keeps the weighted average for HPP.
          // Only log when the PO price actually changes from the most recent prior PO.
          const previousPOItems = await tx.purchaseOrderItem.findMany({
            where: {
              productId: currentItem.productId,
              purchaseOrderId: { not: purchaseOrderId },
            },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { price: true },
          });
          const previousPOPrice: number = previousPOItems[0]?.price ?? 0;

          if (existingProd && previousPOPrice !== newPurchasePrice) {
            const change = calculatePriceChange(previousPOPrice, newPurchasePrice);
            await tx.priceHistory.create({
              data: {
                productId: currentItem.productId,
                storeId: storeId!,
                priceType: "PURCHASE",
                oldPrice: previousPOPrice,
                newPrice: newPurchasePrice,
                changeAmount: change.changeAmount,
                changePercentage: change.changePercentage,
                source: "SYSTEM_RECEIVE",
                referenceId: purchaseOrderId,
              },
            });
          }
          // Cascade to child
          if (updatedProduct?.conversionTargetId && updatedProduct?.conversionRate) {
            const newChildPurchasePrice = Math.round(newWeightedAvg / updatedProduct.conversionRate);

            // Get child to check old price
            const existingChild = await tx.product.findUnique({
              where: { id: updatedProduct.conversionTargetId },
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
                  priceType: "PURCHASE",
                  oldPrice: existingChild.purchase_price || 0,
                  newPrice: newChildPurchasePrice,
                  changeAmount: childChange.changeAmount,
                  changePercentage: childChange.changePercentage,
                  source: "SYSTEM_CASCADE",
                  referenceId: purchaseOrderId,
                },
              });
            }
          }

          await tx.purchaseOrderItem.update({
            where: { id: receivedItem.id },
            data: { receivedQuantity: { increment: receivedItem.receivedQuantity } },
          });
        }
      }

      // Determine completion by checking ALL items in the PO (not just the ones
      // included in the receive request). Items that were intentionally left
      // out (e.g. still waiting for next shipment) must still count toward the
      // "complete" check, otherwise the PO would prematurely flip to "received"
      // and hide the receive button.
      let allItemsComplete = true;
      for (const currentItem of existingPO.items) {
        const receivedItem = receiveData.items.find((i: { id: string }) => i.id === currentItem.id);
        const additionalReceived = receivedItem ? receivedItem.receivedQuantity || 0 : 0;
        const totalReceived = (currentItem.receivedQuantity || 0) + additionalReceived;
        if (totalReceived < currentItem.quantity) {
          allItemsComplete = false;
          break;
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
}

async function handleRetroactivePriceUpdate(purchaseOrderId: string, storeId: string | null, existingPO: any, body: any) {
  await prisma.$transaction(async (tx) => {
    let newTotalAmount = 0;
    let pricesChanged = false;

    for (const itemToUpdate of body.items) {
      const currentItem = existingPO.items.find((i: any) => i.id === itemToUpdate.id);
      if (!currentItem) continue;

      const newPrice = extractNumericPrice(itemToUpdate.price);

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
          // For retroactive price changes: new average = newPrice applied to all existing stock
          // Formula: (existingStock * newPrice + 0 * newPrice) / existingStock = newPrice
          // This correctly updates the purchase_price when retroactively changing existing stock cost
          const newWeightedAvg = newPrice;

          console.log(`[Retroactive Price Update] Product ${currentItem.productId}: retroactive update to newPrice=${newPrice}`);

          // Ensure `updatedProduct` gets populated in update to appease old logic, though we can use `existingProd`
          const updatedProduct = await tx.product.update({
            where: { id: currentItem.productId },
            data: {
              purchase_price: newWeightedAvg,
              hpp_price: calculateCleanHpp(newWeightedAvg, masterProduct.hppCalculationDetails),
              min_selling_price: calculateMinSellingPrice(newWeightedAvg, masterProduct.hppCalculationDetails),
            },
          });

          // Auto-sync ProductSupplier price
          // Check if this product already has a default supplier
          const existingDefaultSupplier = await tx.productSupplier.findFirst({
            where: {
              productId: currentItem.productId,
              isDefault: true,
            },
          });
          const shouldSetAsDefault = !existingDefaultSupplier;

          await tx.productSupplier.upsert({
            where: {
              productId_supplierId: {
                productId: currentItem.productId,
                supplierId: existingPO.supplierId,
              },
            },
            create: {
              productId: currentItem.productId,
              supplierId: existingPO.supplierId,
              price: newPrice,
              isDefault: shouldSetAsDefault,
            },
            update: {
              price: newPrice,
            },
          });
          console.log(`[handleRetroactivePriceUpdate] ProductSupplier upserted for product ${currentItem.productId}, supplier ${existingPO.supplierId}, price ${newPrice}, isDefault=${shouldSetAsDefault}`);

          const change = calculatePriceChange(currentItem.price, newPrice);
          await tx.priceHistory.create({
            data: {
              productId: currentItem.productId,
              storeId: storeId!,
              priceType: "PURCHASE",
              oldPrice: currentItem.price,
              newPrice: newPrice,
              changeAmount: change.changeAmount,
              changePercentage: change.changePercentage,
              source: "RETROACTIVE_PO_EDIT",
              referenceId: purchaseOrderId,
            },
          });
          // Cascade to child
          if (updatedProduct?.conversionTargetId && updatedProduct?.conversionRate) {
            const newChildPurchasePrice = Math.round(newWeightedAvg / updatedProduct.conversionRate);

            const existingChild = await tx.product.findUnique({
              where: { id: updatedProduct.conversionTargetId },
            });

            if (existingChild && existingChild.purchase_price !== newChildPurchasePrice) {
              await tx.product.updateMany({
                where: { id: updatedProduct.conversionTargetId, storeId: storeId! },
                data: {
                  purchase_price: newChildPurchasePrice,
                  hpp_price: calculateCleanHpp(newChildPurchasePrice, existingChild.hppCalculationDetails),
                  min_selling_price: calculateMinSellingPrice(newChildPurchasePrice, existingChild.hppCalculationDetails),
                },
              });

              const childChange = calculatePriceChange(existingChild.purchase_price, newChildPurchasePrice);
              await tx.priceHistory.create({
                data: {
                  productId: updatedProduct.conversionTargetId,
                  storeId: storeId!,
                  priceType: "PURCHASE",
                  oldPrice: existingChild.purchase_price || 0,
                  newPrice: newChildPurchasePrice,
                  changeAmount: childChange.changeAmount,
                  changePercentage: childChange.changePercentage,
                  source: "SYSTEM_CASCADE",
                  referenceId: purchaseOrderId,
                },
              });
            }
          }
        }

        // FIX: Update all batches with matching product_id AND supplier_id to new price
        const updatedBatches = await tx.productBatch.updateMany({
          where: {
            productId: currentItem.productId,
            supplierId: existingPO.supplierId,
          },
          data: {
            purchasePrice: newPrice,
          },
        });

        console.log(`[PO Edit] Updated ${updatedBatches.count} batches for product ${currentItem.productId} to price ${newPrice}`);

        // FIX: Update transaction_items cost_price for all transactions with this product using batch update
        const updatedTxItems = await tx.transactionItem.updateMany({
          where: {
            productId: currentItem.productId,
          },
          data: {
            cost_price: newPrice,
          },
        });

        console.log(`[PO Edit] Updated ${updatedTxItems.count} transaction_items cost_price for product ${currentItem.productId} to ${newPrice}`);
      }
    }

    if (pricesChanged) {
      // Recalculate total amount across all items
      newTotalAmount = existingPO.items.reduce((sum: number, item: any) => {
        const updatedItem = body.items.find((i: { id: string; price: string | number }) => i.id === item.id);
        const newPrice = updatedItem ? extractNumericPrice(updatedItem.price) : item.price;
        return sum + item.quantity * newPrice;
      }, 0);

      const { remainingDebt, paymentStatus } = calculatePurchaseOrderPaymentStatus({
        newTotalAmount,
        previousAmountPaid: existingPO.amountPaid || 0,
      });

      await tx.purchaseOrder.update({
        where: { id: purchaseOrderId },
        data: {
          totalAmount: newTotalAmount,
          remainingAmount: remainingDebt,
          paymentStatus: paymentStatus.toUpperCase(),
        },
      });
    }
  });
}

async function handlePurchaseOrderEdit(purchaseOrderId: string, existingPO: any, data: any) {
  const isCompletingLegacy = data.status === "received" && existingPO.status !== "received";

  if (isCompletingLegacy) {
    await prisma.$transaction(
      async (tx) => {
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
            await BatchService.addGenericBatch(item.productId, remaining, tx);
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
    return;
  }

  // UPDATED: Handle full item update if data.items is provided
  const updatePayload = {
    ...(data.status && { status: data.status }),
    ...(data.notes !== undefined && { notes: data.notes }),
    ...(data.estimatedDelivery !== undefined && {
      estimatedDelivery: data.estimatedDelivery ? new Date(data.estimatedDelivery) : null,
    }),
  };

  await prisma.$transaction(async (tx) => {
    if (data.items) {
      // 1. Process items

      // Validate NO reduction below receivedQuantity
      for (const existingItem of existingPO.items) {
        const incomingMatch = data.items.find((i: any) => i.productId === existingItem.productId);
        if (incomingMatch) {
          if (incomingMatch.quantity < (existingItem.receivedQuantity || 0)) {
            throw new Error(`Kuantitas produk tidak boleh kurang dari yang sudah diterima (${existingItem.receivedQuantity})`);
          }
        } else {
          // Trying to delete
          if ((existingItem.receivedQuantity || 0) > 0) {
            throw new Error(`Tidak dapat menghapus item yang sudah diterima sebagian`);
          }
          // Delete item
          await tx.purchaseOrderItem.delete({ where: { id: existingItem.id } });
        }
      }

      // Update or Create items
      for (const item of data.items) {
        const existingItem = existingPO.items.find((i: any) => i.productId === item.productId);
        if (existingItem) {
          await tx.purchaseOrderItem.update({
            where: { id: existingItem.id },
            data: { quantity: item.quantity, price: item.price },
          });

          // FIX: If price changed, sync to batches and transaction_items
          const newPrice = extractNumericPrice(item.price);
          if (existingItem.price !== newPrice) {
            console.log(`[PO Edit] Price changed for product ${item.productId}: ${existingItem.price} -> ${newPrice}`);

            // Update all batches with matching product_id AND supplier_id
            const updatedBatches = await tx.productBatch.updateMany({
              where: {
                productId: item.productId,
                supplierId: existingPO.supplierId,
              },
              data: {
                purchasePrice: newPrice,
              },
            });
            console.log(`[PO Edit] Updated ${updatedBatches.count} batches for product ${item.productId} to price ${newPrice}`);

            // Update master product price using weighted average
            const masterProduct = await tx.product.findUnique({ where: { id: item.productId } });
            if (masterProduct) {
              // Get existing stock from batches for weighted average calculation
              // For retroactive price changes: new average = newPrice applied to all existing stock
              // Formula: (existingStock * newPrice + 0 * newPrice) / existingStock = newPrice
              const newWeightedAvg = newPrice;

              console.log(`[PO Edit Price Update] Product ${item.productId}: retroactive update to newPrice=${newWeightedAvg}`);

              await tx.product.update({
                where: { id: item.productId },
                data: {
                  purchase_price: newWeightedAvg,
                  hpp_price: calculateCleanHpp(newWeightedAvg, masterProduct.hppCalculationDetails),
                  min_selling_price: calculateMinSellingPrice(newWeightedAvg, masterProduct.hppCalculationDetails),
                },
              });

              // Auto-sync ProductSupplier price
              // Check if this product already has a default supplier
              const existingDefaultSupplier = await tx.productSupplier.findFirst({
                where: {
                  productId: item.productId,
                  isDefault: true,
                },
              });
              const shouldSetAsDefault = !existingDefaultSupplier;

              await tx.productSupplier.upsert({
                where: {
                  productId_supplierId: {
                    productId: item.productId,
                    supplierId: existingPO.supplierId,
                  },
                },
                create: {
                  productId: item.productId,
                  supplierId: existingPO.supplierId,
                  price: newPrice,
                  isDefault: shouldSetAsDefault,
                },
                update: {
                  price: newPrice,
                },
              });
              console.log(`[handlePurchaseOrderEdit] ProductSupplier upserted for product ${item.productId}, supplier ${existingPO.supplierId}, price ${newPrice}`);

              // Create price history
              const change = calculatePriceChange(existingItem.price, newPrice);
              await tx.priceHistory.create({
                data: {
                  productId: item.productId,
                  storeId: existingPO.storeId,
                  priceType: "PURCHASE",
                  oldPrice: existingItem.price,
                  newPrice: newPrice,
                  changeAmount: change.changeAmount,
                  changePercentage: change.changePercentage,
                  source: "PO_EDIT",
                  referenceId: purchaseOrderId,
                },
              });
            }

            // Update transaction_items cost_price using batch update
            const updatedTxItems = await tx.transactionItem.updateMany({
              where: { productId: item.productId },
              data: { cost_price: newPrice },
            });
            console.log(`[PO Edit] Updated ${updatedTxItems.count} transaction_items cost_price for product ${item.productId} to ${newPrice}`);
          }
        } else {
          await tx.purchaseOrderItem.create({
            data: {
              purchaseOrderId: purchaseOrderId,
              productId: item.productId,
              quantity: item.quantity,
              price: item.price,
              unit: item.unit || "pcs",
            },
          });
        }
      }

      // 2. Recalculate totals
      const newTotalAmount = data.items.reduce((sum: number, item: { quantity: number; price: number }) => sum + item.quantity * item.price, 0);
      
      const { remainingDebt: remainingAmount, paymentStatus } = calculatePurchaseOrderPaymentStatus({
        newTotalAmount,
        previousAmountPaid: existingPO.amountPaid || 0,
      });
      const newPaymentStatus = paymentStatus.toUpperCase();

      let newPoStatus = updatePayload.status || existingPO.status;
      if (newPoStatus === "received" || newPoStatus === "completed") {
        let allItemsReceived = true;
        for (const item of data.items) {
          const existingItem = existingPO.items.find((i: any) => i.productId === item.productId);
          const receivedQty = existingItem ? existingItem.receivedQuantity || 0 : 0;
          if (item.quantity > receivedQty) {
            allItemsReceived = false;
            break;
          }
        }
        if (!allItemsReceived) {
          newPoStatus = "partially_received";
        }
      }

      await tx.purchaseOrder.update({
        where: { id: purchaseOrderId },
        data: {
          ...updatePayload,
          status: newPoStatus,
          totalAmount: newTotalAmount,
          remainingAmount,
          paymentStatus: newPaymentStatus,
        },
      });
    } else {
      // Standard PO update without items
      await tx.purchaseOrder.update({
        where: { id: purchaseOrderId },
        data: updatePayload,
      });
    }
  });
}

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
          include: purchaseOrderDetailInclude,
        });

        if (!purchaseOrder) {
          return NextResponse.json({ error: "Purchase order tidak ditemukan" }, { status: 404 });
        }

        const formattedPO = serializePurchaseOrderDetail(purchaseOrder);

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
        await handleReceiveGoods(purchaseOrderId, storeId, existingPO, receiveResult.data);
      } else if (body.action === "update_prices" && Array.isArray(body.items)) {
        await handleRetroactivePriceUpdate(purchaseOrderId, storeId, existingPO, body);
      } else {
        const result = purchaseOrderUpdateSchema.safeParse(body);
        if (!result.success) {
          return NextResponse.json({ error: "Validasi gagal", details: result.error.flatten() }, { status: 400 });
        }
        await handlePurchaseOrderEdit(purchaseOrderId, existingPO, result.data);
      }

      // Refetch final state for response consistency
      const refetchedPO = await prisma.purchaseOrder.findFirst({
        where: {
          id: purchaseOrderId,
          storeId: storeId!,
        },
        include: purchaseOrderDetailInclude,
      });

      if (!refetchedPO) throw new Error("Gagal mengambil data update PO");
      const updatedPO = refetchedPO;

      const formattedPO = serializePurchaseOrderDetail(updatedPO);

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
