import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

import { withAuth } from "@/lib/api-middleware";
import { purchaseOrderUpdateSchema, receiveGoodsSchema } from "@/lib/validations/purchase-order";
import { BatchService } from "@/services/batch.service";
import { calculatePriceChange } from "@/lib/price-history";
import { calculateCleanHpp, calculateMinSellingPrice } from "@/lib/hpp-calculator";
import { extractNumericPrice } from "@/core/purchase-orders/receive-goods.core";
import { calculatePurchaseOrderPaymentStatus } from "@/core/purchase-orders/payment-calculator.core";
import { computeReceivePlan } from "@/core/purchase-orders/receive-goods-prefetch.core";

/**
 * Safety net timeout for receive goods transaction.
 * Target after prefetch + parallel optimization: < 8 seconds for 13-item PO.
 * 60s timeout covers worst-case (Neon pooler latency spike, larger POs).
 * Original was 30s which caused P2028 expired transaction errors in production
 * when PO item count was high (each item triggered ~10-14 serial queries).
 */
const RECEIVE_GOODS_TX_TIMEOUT_MS = 60_000;
const RECEIVE_GOODS_TX_MAX_WAIT_MS = 20_000;

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
  // ============ PHASE 1: PREFETCH (outside transaction) ============
  // Kumpulkan productIds dari items yang akan diterima (>0 qty).
  // Prefetch 4 aggregate queries secara paralel (Promise.all) menggantikan
  // loop 13× N serial queries di dalam transaction lama.
  const itemsToReceive = receiveData.items.filter(
    (r: any) =>
      r.receivedQuantity > 0 &&
      existingPO.items.some((i: any) => i.id === r.id),
  );

  const productIds = itemsToReceive.map((r: any) => {
    const poItem = existingPO.items.find((i: any) => i.id === r.id);
    return poItem.productId;
  });

  // Early exit: tidak ada item yang diterima. Hanya update status PO.
  // Tetap buka transaction kecil untuk atomicity update status saja.
  if (productIds.length === 0) {
    await prisma.$transaction(
      async (tx) => {
        let allItemsComplete = true;
        for (const currentItem of existingPO.items) {
          const receivedItem = receiveData.items.find(
            (i: { id: string }) => i.id === currentItem.id,
          );
          const additionalReceived = receivedItem?.receivedQuantity || 0;
          const totalReceived = (currentItem.receivedQuantity || 0) + additionalReceived;
          if (totalReceived < currentItem.quantity) {
            allItemsComplete = false;
            break;
          }
        }
        const newStatus =
          receiveData.closePo || allItemsComplete ? "received" : "partially_received";
        await tx.purchaseOrder.update({
          where: { id: purchaseOrderId },
          data: { status: newStatus },
        });
      },
      {
        maxWait: RECEIVE_GOODS_TX_MAX_WAIT_MS,
        timeout: RECEIVE_GOODS_TX_TIMEOUT_MS,
      },
    );
    return;
  }

  // 4 aggregate prefetch queries via Promise.all (paralel).
  // Sebelumnya: ~13× N query serial di dalam transaction.
  const [prefetchedProducts, prefetchedBatches, prefetchedDefaultSuppliers, prefetchedPreviousPrices] =
    await Promise.all([
      prisma.product.findMany({
        where: { id: { in: productIds } },
        select: {
          id: true,
          stock: true,
          purchase_price: true,
          hpp_price: true,
          hppCalculationDetails: true,
          conversionTargetId: true,
          conversionRate: true,
        },
      }),
      prisma.productBatch.findMany({
        where: { productId: { in: productIds }, stock: { gt: 0 } },
        select: { productId: true, stock: true },
      }),
      prisma.productSupplier.findMany({
        where: { productId: { in: productIds }, isDefault: true },
        select: { productId: true },
      }),
      prisma.purchaseOrderItem.findMany({
        where: {
          productId: { in: productIds },
          purchaseOrderId: { not: purchaseOrderId },
        },
        orderBy: { createdAt: "desc" },
        select: { productId: true, price: true },
      }),
    ]);

  // ============ PHASE 2: PLAN COMPUTATION (pure core) ============
  // computeReceivePlan adalah pure function — tidak ada I/O, tidak ada side effects.
  // Output deterministik: input sama → output sama.
  const plan = computeReceivePlan({
    poId: purchaseOrderId,
    storeId: storeId!,
    supplierId: existingPO.supplierId,
    existingPoItems: existingPO.items,
    receiveItems: receiveData.items,
    prefetched: {
      products: prefetchedProducts,
      batches: prefetchedBatches,
      defaultSuppliers: prefetchedDefaultSuppliers,
      previousPoPrices: prefetchedPreviousPrices,
    },
  });

  // ============ PHASE 3: PLAN EXECUTION (in transaction) ============
  await prisma.$transaction(
    async (tx) => {
      for (const itemPlan of plan.items) {
        // Step A: Batch creation (sequential — menambah stock dulu sebelum
        // product.update weighted average di bawah, sesuai original flow).
        const batchOp = itemPlan.operations.find((o) => o.kind === "createBatch");
        if (batchOp && batchOp.kind === "createBatch") {
          if (batchOp.batch === null) {
            // Fallback ke generic batch jika tidak ada batch detail.
            await BatchService.addGenericBatch(batchOp.productId, batchOp.receivedQuantity, tx);
          } else {
            await BatchService.addBatch(
              {
                productId: batchOp.productId,
                stock: batchOp.batch.stock,
                expiryDate: batchOp.batch.expiryDate,
                batchNumber: batchOp.batch.batchNumber,
                purchasePrice: batchOp.batch.purchasePrice,
              },
              tx,
            );
          }
        }

        // Step B: Parallel writes via Promise.all.
        // product.update (weighted avg), productSupplier.upsert, priceHistory.create
        // — semua independent satu sama lain, bisa paralel.
        const parallelOps: Promise<unknown>[] = [];

        const updateOp = itemPlan.operations.find((o) => o.kind === "updateProductWeightedAvg");
        if (updateOp && updateOp.kind === "updateProductWeightedAvg") {
          parallelOps.push(
            tx.product.update({
              where: { id: updateOp.productId },
              data: {
                purchase_price: updateOp.newPurchasePrice,
                hpp_price: calculateCleanHpp(
                  updateOp.newPurchasePrice,
                  updateOp.hppCalculationDetails,
                ),
                min_selling_price: calculateMinSellingPrice(
                  updateOp.newPurchasePrice,
                  updateOp.hppCalculationDetails,
                ),
              },
            }),
          );
        }

        const supplierOp = itemPlan.operations.find((o) => o.kind === "upsertProductSupplier");
        if (supplierOp && supplierOp.kind === "upsertProductSupplier") {
          parallelOps.push(
            tx.productSupplier.upsert({
              where: {
                productId_supplierId: {
                  productId: supplierOp.productId,
                  supplierId: supplierOp.supplierId,
                },
              },
              create: {
                productId: supplierOp.productId,
                supplierId: supplierOp.supplierId,
                price: supplierOp.price,
                isDefault: supplierOp.isDefault,
              },
              update: { price: supplierOp.price },
            }),
          );
        }

        const priceHistoryOp = itemPlan.operations.find((o) => o.kind === "createPriceHistory");
        if (priceHistoryOp && priceHistoryOp.kind === "createPriceHistory") {
          parallelOps.push(
            tx.priceHistory.create({
              data: {
                productId: priceHistoryOp.productId,
                storeId: priceHistoryOp.storeId,
                priceType: "PURCHASE",
                oldPrice: priceHistoryOp.oldPrice,
                newPrice: priceHistoryOp.newPrice,
                changeAmount: priceHistoryOp.changeAmount,
                changePercentage: priceHistoryOp.changePercentage,
                source: priceHistoryOp.source,
                referenceId: priceHistoryOp.referenceId,
              },
            }),
          );
        }

        // Child cascade (paralel dengan parent writes).
        const childCascadeOp = itemPlan.operations.find((o) => o.kind === "cascadeToChild");
        if (childCascadeOp && childCascadeOp.kind === "cascadeToChild") {
          parallelOps.push(
            tx.product.updateMany({
              where: {
                id: childCascadeOp.childProductId,
                storeId: childCascadeOp.storeId,
              },
              data: {
                purchase_price: childCascadeOp.newPurchasePrice,
                hpp_price: calculateCleanHpp(
                  childCascadeOp.newPurchasePrice,
                  childCascadeOp.childHppCalculationDetails,
                ),
                min_selling_price: calculateMinSellingPrice(
                  childCascadeOp.newPurchasePrice,
                  childCascadeOp.childHppCalculationDetails,
                ),
              },
            }),
          );
        }

        const childPriceHistoryOp = itemPlan.operations.find(
          (o) => o.kind === "createPriceHistoryChild",
        );
        if (childPriceHistoryOp && childPriceHistoryOp.kind === "createPriceHistoryChild") {
          parallelOps.push(
            tx.priceHistory.create({
              data: {
                productId: childPriceHistoryOp.productId,
                storeId: childPriceHistoryOp.storeId,
                priceType: "PURCHASE",
                oldPrice: childPriceHistoryOp.oldPrice,
                newPrice: childPriceHistoryOp.newPrice,
                changeAmount: childPriceHistoryOp.changeAmount,
                changePercentage: childPriceHistoryOp.changePercentage,
                source: childPriceHistoryOp.source,
                referenceId: childPriceHistoryOp.referenceId,
              },
            }),
          );
        }

        await Promise.all(parallelOps);

        // Step C: purchaseOrderItem.update (sequential setelah parallel di atas).
        const receivedQtyOp = itemPlan.operations.find(
          (o) => o.kind === "incrementReceivedQuantity",
        );
        if (receivedQtyOp && receivedQtyOp.kind === "incrementReceivedQuantity") {
          await tx.purchaseOrderItem.update({
            where: { id: receivedQtyOp.poItemId },
            data: { receivedQuantity: { increment: receivedQtyOp.quantity } },
          });
        }
      }

      // ============ PO Status determination (UNCHANGED — regression risk tinggi) ============
      // Logic ini COPY-PASTE PERSIS dari code lama. Item yang sengaja di-omit dari
      // receive request tetap dihitung sebagai "belum selesai" — lihat test
      // "should keep status as partially_received when one item is fully received
      // but another item has not been received yet (multi-item PO)".
      let allItemsComplete = true;
      for (const currentItem of existingPO.items) {
        const receivedItem = receiveData.items.find(
          (i: { id: string }) => i.id === currentItem.id,
        );
        const additionalReceived = receivedItem ? receivedItem.receivedQuantity || 0 : 0;
        const totalReceived = (currentItem.receivedQuantity || 0) + additionalReceived;
        if (totalReceived < currentItem.quantity) {
          allItemsComplete = false;
          break;
        }
      }

      const newStatus =
        receiveData.closePo || allItemsComplete ? "received" : "partially_received";

      await tx.purchaseOrder.update({
        where: { id: purchaseOrderId },
        data: { status: newStatus },
      });
    },
    {
      maxWait: RECEIVE_GOODS_TX_MAX_WAIT_MS,
      timeout: RECEIVE_GOODS_TX_TIMEOUT_MS,
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
