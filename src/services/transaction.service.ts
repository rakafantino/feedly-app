import prisma from "@/lib/prisma";
import { Product } from "@prisma/client";
import { NotificationService } from "@/services/notification.service";
import { formatStockMismatchMessage, hasStockBatchMismatch } from "@/lib/stock-integrity";

export interface CreateTransactionData {
  items: {
    productId: string;
    quantity: number;
    price: number;
  }[];
  paymentMethod: string;
  paymentDetails?: {
    amount: number;
    method?: string;
  }[];
  customerId?: string;
  amountPaid?: number; // Added for flexibility/testing
  dueDate?: Date;
  discount?: number; // Manual Discount
}

// Helper untuk memeriksa stok rendah
function checkLowStock(product: any): boolean {
  if (!product.threshold || product.threshold <= 0) {
    return false;
  }
  return product.stock <= product.threshold;
}

// Adapter tipe product
function adaptPrismaProductForStockCheck(prismaProduct: Product): any {
  return {
    ...prismaProduct,
    supplier_id: prismaProduct.supplierId,
    category: prismaProduct.category || "",
    unit: prismaProduct.unit || "pcs",
  };
}

export class TransactionService {
  static async getTransactions(storeId: string) {
    return prisma.transaction.findMany({
      where: { storeId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        customer: true, // Include customer details
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  static async createTransaction(storeId: string, data: CreateTransactionData) {
    // 1. Hitung Total Gross (Sum of Items)
    let grossTotal = 0;
    for (const item of data.items) {
      grossTotal += item.price * item.quantity;
    }
    grossTotal = Math.round(grossTotal);

    // Apply Discount
    const discount = data.discount || 0;
    const netTotal = Math.max(0, grossTotal - discount); // Prevent negative total

    // 2. Validasi Pembayaran & Hutang
    let paymentDetailsJson = null;
    let paymentStatus = "PAID";
    let amountPaid = netTotal;
    let remainingAmount = 0;

    // Cek apakah ada pembayaran parsial (dari input FE)
    if (data.paymentDetails && data.paymentDetails.length > 0) {
      // Ambil total yang dibayarkan oleh user
      const totalInputPayment = data.paymentDetails.reduce((sum, p) => sum + p.amount, 0);

      amountPaid = totalInputPayment;
      remainingAmount = netTotal - amountPaid;

      // Serialize untuk legacy compatibility
      paymentDetailsJson = JSON.stringify(data.paymentDetails);
    } else if ((data as any).amountPaid !== undefined) {
      // Support direct amountPaid property from test/FE
      amountPaid = (data as any).amountPaid;
      remainingAmount = netTotal - amountPaid;
    }

    // Tentukan Status
    if (remainingAmount > 0) {
      paymentStatus = "PARTIAL"; // Atau bisa 'UNPAID' jika amountPaid == 0, tapi simplifikasi jadi PARTIAL/PAID saja
      if (amountPaid === 0)
        paymentStatus = "UNPAID"; // Optional: distinguish fully unpaid
      else paymentStatus = "PARTIAL";

      // Validasi: Hutang wajib ada Customer
      if (!data.customerId) {
        throw new Error("Customer is required for debt transactions");
      }
    } else {
      paymentStatus = "PAID";
      remainingAmount = 0; // Prevent negative remaining
    }

    // 3. Eksekusi Transaksi Atomik
    // 3. Eksekusi Transaksi Atomik dengan Retry Mechanism
    let retries = 0;
    const MAX_RETRIES = 3;

    while (retries < MAX_RETRIES) {
      try {
        // Define updatedProducts inside the retry loop so it starts fresh on each attempt
        const updatedProducts: Product[] = [];

        const result = await prisma.$transaction(
          async (tx) => {
            // Generate Invoice Number
            const now = new Date();

            // Use Local Time for YYYYMMDD
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, "0");
            const day = String(now.getDate()).padStart(2, "0");
            const dateStr = `${year}${month}${day}`;

            // Find the last transaction FOR THIS STORE for this day to determine sequence
            // We use per-store sequencing now (Store A #1, Store B #1)
            const lastTransaction = await tx.transaction.findFirst({
              where: {
                storeId,
                invoiceNumber: {
                  startsWith: `INV/${dateStr}/`,
                },
              },
              orderBy: {
                invoiceNumber: "desc",
              },
            });

            let sequenceNumber = 1;
            if (lastTransaction && lastTransaction.invoiceNumber) {
              const parts = lastTransaction.invoiceNumber.split("/");
              const lastSeq = parseInt(parts[2]);
              if (!isNaN(lastSeq)) {
                sequenceNumber = lastSeq + 1;
              }
            }

            const sequence = sequenceNumber.toString().padStart(4, "0");
            const invoiceNumber = `INV/${dateStr}/${sequence}`;

            // Create Transaction Record
            const newTransaction = await tx.transaction.create({
              data: {
                total: netTotal, // Save NET Total
                discount: discount, // Save Discount
                paymentMethod: data.paymentMethod,
                paymentDetails: paymentDetailsJson,
                storeId,
                customerId: data.customerId || null,
                invoiceNumber,
                // New Debt Fields
                paymentStatus,
                amountPaid,
                remainingAmount,
                dueDate: data.dueDate, // Persist Due Date
              },
            });

            // Pre-fetch ALL products for this transaction in ONE query
            const productIds = data.items.map((item) => item.productId);
            const allProducts = await tx.product.findMany({
              where: {
                id: { in: productIds },
                storeId,
              },
            });

            // Build a map for O(1) lookups
            const productMap = new Map(allProducts.map((p) => [p.id, p]));

            // Validate all products exist
            for (const item of data.items) {
              if (!productMap.has(item.productId)) {
                throw new Error(`Product with ID ${item.productId} not found in this store`);
              }
            }

            // Process batch deductions & collect item data concurrently
            // To overcome Prisma serialization on tx, we fetch ALL required batches at once
            const allBatches = await tx.productBatch.findMany({
              where: {
                productId: { in: productIds },
                stock: { gt: 0 },
              },
              orderBy: { expiryDate: "asc" },
            });

            // Group batches by product ID
            const batchesByProduct = new Map<string, any[]>();
            for (const batch of allBatches) {
              if (!batchesByProduct.has(batch.productId)) {
                batchesByProduct.set(batch.productId, []);
              }
              batchesByProduct.get(batch.productId)!.push(batch);
            }

            for (const item of data.items) {
              const product = productMap.get(item.productId)!;
              const productBatches = batchesByProduct.get(item.productId) || [];
              const activeBatchStock = productBatches.reduce((sum, batch) => sum + batch.stock, 0);
              const snapshot = {
                productId: product.id,
                productName: product.name,
                productStock: product.stock,
                activeBatchStock,
                totalBatchStock: activeBatchStock,
                batchCount: productBatches.length,
                activeBatchCount: productBatches.length,
                gap: product.stock - activeBatchStock,
              };

              if (hasStockBatchMismatch(snapshot)) {
                throw new Error(formatStockMismatchMessage(snapshot));
              }
            }

            const batchUpdatePromises: Promise<any>[] = [];

            const itemPromises = data.items.map(async (item) => {
              const product = productMap.get(item.productId)!;

              if (product.stock < item.quantity) {
                throw new Error(`Not enough stock for product ${product.name}`);
              }

              // In-memory FEFO deduction to save database roundtrips
              let remainingToDeduct = item.quantity;
              const batchDetails = [];
              const productBatches = batchesByProduct.get(item.productId) || [];

              for (const batch of productBatches) {
                if (remainingToDeduct <= 0) break;
                const deduction = Math.min(batch.stock, remainingToDeduct);

                // Queue the batch update
                batchUpdatePromises.push(
                  tx.productBatch.update({
                    where: { id: batch.id },
                    data: { stock: { decrement: deduction } },
                  }),
                );

                batchDetails.push({
                  batchId: batch.id,
                  deducted: deduction,
                  cost: batch.purchasePrice,
                });

                remainingToDeduct -= deduction;
              }

              if (remainingToDeduct > 0) {
                // We fallback to standard error but theoretically it shouldn't happen if product.stock matched
                throw new Error(`Data integrity error: Product ${product.name} stock suggests availability but batches are empty.`);
              }

              // Calculate Cost
              let costPriceToUse = 0;

              if (product.hpp_price && product.hpp_price > 0) {
                costPriceToUse = product.hpp_price;
              } else {
                let totalCost = 0;
                let totalQty = 0;
                for (const batch of batchDetails) {
                  const batchCost = batch.cost || product.purchase_price || 0;
                  totalCost += batchCost * batch.deducted;
                  totalQty += batch.deducted;
                }
                costPriceToUse = totalQty > 0 ? totalCost / totalQty : product.purchase_price || 0;
              }

              // Queue the product stock update
              batchUpdatePromises.push(
                tx.product.update({
                  where: { id: item.productId },
                  data: { stock: { decrement: item.quantity } },
                }),
              );

              return {
                transactionId: newTransaction.id,
                productId: item.productId,
                quantity: item.quantity,
                price: item.price,
                original_price: product.price,
                cost_price: costPriceToUse,
                updatedProduct: {
                  ...product,
                  stock: product.stock - item.quantity,
                },
              };
            });

            const resolvedItems = await Promise.all(itemPromises);

            // Execute all batch and product stock decrements concurrently
            await Promise.all(batchUpdatePromises);

            const itemsToCreate = resolvedItems.map((r) => ({
              transactionId: r.transactionId,
              productId: r.productId,
              quantity: r.quantity,
              price: r.price,
              original_price: r.original_price,
              cost_price: r.cost_price,
            }));

            updatedProducts.push(...resolvedItems.map((r) => r.updatedProduct));

            // Batch-insert all transaction items in ONE query
            await tx.transactionItem.createMany({
              data: itemsToCreate,
            });

            return { transaction: newTransaction, updatedProducts };
          },
          {
            timeout: 15000, // 15 seconds (default was 5s, too short for remote DB with multiple products)
            maxWait: 10000, // Max 10s to acquire a connection from the pool
          },
        );

        // 4. Post-Process: Alerts (Async, non-blocking logic wrapper)
        // Kita jalankan dan log errornya, tapi tidak throw error agar transaksi tetap sukses
        this.handlePostTransactionAlerts(storeId, result.updatedProducts).catch((err) => {
          console.error("[TransactionService] Alert check error:", err);
        });

        return result.transaction;
      } catch (error: any) {
        // Retry only on unique constraint violation for invoice_number
        if (error.code === "P2002" && error.meta?.target?.includes("invoice_number")) {
          retries++;
          console.warn(`[TransactionService] Invoice number collision. Retrying ${retries}/${MAX_RETRIES}...`);
          if (retries >= MAX_RETRIES) {
            throw new Error("Failed to generate unique invoice number after multiple attempts");
          }
          // Small delay before retry to reduce contention
          await new Promise((resolve) => setTimeout(resolve, 50));
          continue;
        }
        throw error; // Re-throw other errors
      }
    }

    throw new Error("Transaction failed unexpectedly");
  }

  private static async handlePostTransactionAlerts(storeId: string, updatedProducts: Product[]) {
    try {
      const lowStockProducts = updatedProducts.map(adaptPrismaProductForStockCheck).filter(checkLowStock);

      // 1. Refresh Stock Alerts
      await NotificationService.checkLowStockProducts(storeId);

      if (lowStockProducts.length > 0) {
        console.log(`[TransactionService] Found ${lowStockProducts.length} low stock products.`);
      }

      // 2. Refresh Debt Alerts (checks for due dates including today)
      await NotificationService.checkDebtDue(storeId);
    } catch (error) {
      throw error;
    }
  }
  static async payDebt(storeId: string, transactionId: string, amount: number, paymentMethod: string, notes?: string) {
    // 1. Validasi Transaksi
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction || transaction.storeId !== storeId) {
      throw new Error(`Transaction ${transactionId} not found in this store`);
    }

    if (transaction.remainingAmount <= 0) {
      throw new Error("Transaction is already paid off");
    }

    if (amount > transaction.remainingAmount) {
      throw new Error("Payment amount exceeds remaining debt");
    }

    // 2. Update Transaksi & Catat Log
    return prisma.$transaction(async (tx) => {
      // Create Debt Payment Record
      const debtPayment = await tx.debtPayment.create({
        data: {
          transactionId,
          amount,
          paymentMethod,
          notes,
        },
      });

      // Kalkulasi sisa
      const newAmountPaid = transaction.amountPaid + amount;
      const newRemaining = transaction.total - newAmountPaid;

      // Tentukan status
      let newStatus = "PARTIAL";
      if (newRemaining <= 0) {
        // Should be 0 based on validation
        newStatus = "PAID";
      }

      // Update Transaction
      const updatedTransaction = await tx.transaction.update({
        where: { id: transactionId },
        data: {
          amountPaid: newAmountPaid,
          remainingAmount: newRemaining,
          paymentStatus: newStatus,
        },
      });

      return {
        payment: debtPayment,
        transaction: updatedTransaction,
      };
    });
  }
  static async getDebtReport(storeId: string) {
    return prisma.transaction.findMany({
      where: {
        storeId,
        remainingAmount: { gt: 0 },
        paymentStatus: { not: "WRITTEN_OFF" }, // Exclude written-off debts
      },
      include: {
        customer: true,
      },
      orderBy: {
        customer: {
          name: "asc",
        },
      },
    });
  }
  static async updateTransaction(storeId: string, transactionId: string, data: { dueDate?: Date }) {
    // 1. Validasi Transaksi
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction || transaction.storeId !== storeId) {
      throw new Error(`Transaction ${transactionId} not found in this store`);
    }

    // 2. Update
    return prisma.transaction.update({
      where: { id: transactionId },
      data: {
        dueDate: data.dueDate,
      },
    });
  }

  /**
   * Write off an uncollectable debt.
   * This marks the remaining debt as a loss and updates the transaction status.
   */
  static async writeOffDebt(storeId: string, transactionId: string, reason?: string) {
    // 1. Validate Transaction
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction || transaction.storeId !== storeId) {
      throw new Error(`Transaction ${transactionId} not found in this store`);
    }

    if (transaction.paymentStatus === "WRITTEN_OFF") {
      throw new Error("Transaction is already written off");
    }

    if (transaction.remainingAmount <= 0) {
      throw new Error("Transaction has no remaining debt to write off");
    }

    // 2. Update Transaction
    return prisma.transaction.update({
      where: { id: transactionId },
      data: {
        paymentStatus: "WRITTEN_OFF",
        writtenOffAmount: transaction.remainingAmount,
        writtenOffAt: new Date(),
        writtenOffReason: reason || null,
        remainingAmount: 0,
      },
    });
  }
}
