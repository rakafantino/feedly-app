import prisma from '@/lib/prisma';
import { BatchService } from './batch.service';
import { Product } from '@prisma/client';
import { NotificationService } from '@/services/notification.service';

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
    category: prismaProduct.category || '',
    unit: prismaProduct.unit || 'pcs',
  };
}

export class TransactionService {
  static async getTransactions(storeId: string) {
    return prisma.transaction.findMany({
      where: { storeId },
      include: {
        items: {
          include: {
            product: true
          }
        },
        customer: true, // Include customer details
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  static async createTransaction(storeId: string, data: CreateTransactionData) {
    // 1. Hitung Total Gross (Sum of Items)
    let grossTotal = 0;
    for (const item of data.items) {
      grossTotal += item.price * item.quantity;
    }

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
       const totalInputPayment = data.paymentDetails.reduce(
          (sum, p) => sum + p.amount, 0
       );
       
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
      if (amountPaid === 0) paymentStatus = "UNPAID"; // Optional: distinguish fully unpaid
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
    const updatedProducts: Product[] = [];

    const transaction = await prisma.$transaction(async (tx) => {
      // Generate Invoice Number
      const now = new Date();
      
      // Use Local Time for YYYYMMDD
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const dateStr = `${year}${month}${day}`;
      
      const startOfDay = new Date(year, now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const endOfDay = new Date(year, now.getMonth(), now.getDate(), 23, 59, 59, 999);

      const countToday = await tx.transaction.count({
        where: {
          storeId,
          createdAt: {
            gte: startOfDay,
            lte: endOfDay
          }
        }
      });

      const sequence = (countToday + 1).toString().padStart(4, '0');
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
        }
      });

      // Create Items & Update Stock
      for (const item of data.items) {
        // Find product
        const product = await tx.product.findFirst({
          where: {
            id: item.productId,
            storeId
          }
        });

        if (!product) {
          throw new Error(`Product with ID ${item.productId} not found in this store`);
        }

        // Use BatchService to deduct stock (FEFO)
        const batchDetails = await BatchService.deductStock(item.productId, item.quantity, tx);

        // Calculate Cost
        // USER REQUIREMENT: Prioritize 'hpp_price' (Standard Cost) if available.
        // This ensures financial reports reflect the 'Modal' (includes overheads) defined by the user,
        // rather than just the raw purchase price from batches.
        let costPriceToUse = 0;
        
        if (product.hpp_price && product.hpp_price > 0) {
           costPriceToUse = product.hpp_price;
        } else {
           // Fallback to Weighted Average of Batches or raw Purchase Price
           let totalCost = 0;
           let totalQty = 0;
           for (const batch of batchDetails) {
             const batchCost = batch.cost || product.purchase_price || 0;
             totalCost += batchCost * batch.deducted;
             totalQty += batch.deducted;
           }
           costPriceToUse = totalQty > 0 
             ? totalCost / totalQty 
             : (product.purchase_price || 0);
        }

        const weightedCost = costPriceToUse;

        // Create item
        await tx.transactionItem.create({
          data: {
            transactionId: newTransaction.id,
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
            original_price: product.price,
            cost_price: weightedCost  // Now stores min_selling_price as HPP
          }
        });

        // Update local object for alerts
        updatedProducts.push({
          ...product,
          stock: product.stock - item.quantity
        });
      }

      return newTransaction;
    });

    // 4. Post-Process: Alerts (Async, non-blocking logic wrapper)
    // Kita jalankan dan log errornya, tapi tidak throw error agar transaksi tetap sukses
    this.handlePostTransactionAlerts(storeId, updatedProducts).catch(err => {
      console.error('[TransactionService] Alert check error:', err);
    });

    return transaction;
  }

  private static async handlePostTransactionAlerts(storeId: string, updatedProducts: Product[]) {
    try {
      const lowStockProducts = updatedProducts
        .map(adaptPrismaProductForStockCheck)
        .filter(checkLowStock);

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
      where: { id: transactionId }
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
          notes
        }
      });

      // Kalkulasi sisa
      const newAmountPaid = transaction.amountPaid + amount;
      const newRemaining = transaction.total - newAmountPaid;
      
      // Tentukan status
      let newStatus = "PARTIAL";
      if (newRemaining <= 0) { // Should be 0 based on validation
        newStatus = "PAID";
      }

      // Update Transaction
      const updatedTransaction = await tx.transaction.update({
        where: { id: transactionId },
        data: {
          amountPaid: newAmountPaid,
          remainingAmount: newRemaining,
          paymentStatus: newStatus
        }
      });

      return {
        payment: debtPayment,
        transaction: updatedTransaction
      };
    });
  }
  static async getDebtReport(storeId: string) {
    return prisma.transaction.findMany({
      where: {
        storeId,
        remainingAmount: { gt: 0 }
      },
      include: {
        customer: true
      },
      orderBy: {
        customer: {
          name: 'asc'
        }
      }
    });
  }
  static async updateTransaction(storeId: string, transactionId: string, data: { dueDate?: Date }) {
    // 1. Validasi Transaksi
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId }
    });

    if (!transaction || transaction.storeId !== storeId) {
      throw new Error(`Transaction ${transactionId} not found in this store`);
    }

    // 2. Update
    return prisma.transaction.update({
      where: { id: transactionId },
      data: {
        dueDate: data.dueDate
      }
    });
  }
}
