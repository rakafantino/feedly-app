import prisma from '@/lib/prisma';
import { BatchService } from './batch.service';
import { Product } from '@prisma/client';
import { checkLowStockProducts } from '@/lib/notificationService';

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
    // 1. Hitung Total
    let total = 0;
    for (const item of data.items) {
      total += item.price * item.quantity;
    }

    // 2. Validasi Pembayaran
    let paymentDetailsJson = null;
    if (data.paymentDetails && Array.isArray(data.paymentDetails)) {
      const paymentTotal = data.paymentDetails.reduce(
        (sum, payment) => sum + payment.amount,
        0
      );

      if (paymentTotal < total) {
        throw new Error('Total pembayaran kurang dari total transaksi');
      }
      paymentDetailsJson = JSON.stringify(data.paymentDetails);
    }

    // 3. Eksekusi Transaksi Atomik
    const updatedProducts: Product[] = [];

    const transaction = await prisma.$transaction(async (tx) => {
      // Generate Invoice Number
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD

      const startOfDay = new Date(now.setHours(0, 0, 0, 0));
      const endOfDay = new Date(now.setHours(23, 59, 59, 999));

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
          total,
          paymentMethod: data.paymentMethod,
          paymentDetails: paymentDetailsJson,
          storeId,
          customerId: data.customerId || null,
          invoiceNumber,
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

        // Calculate Weighted Average Cost
        let totalCost = 0;
        let totalQty = 0;
        for (const batch of batchDetails) {
          const cost = batch.cost || product.purchase_price || 0;
          totalCost += cost * batch.deducted;
          totalQty += batch.deducted;
        }
        
        const weightedCost = totalQty > 0 ? totalCost / totalQty : (product.purchase_price || 0);

        // Create item
        await tx.transactionItem.create({
          data: {
            transactionId: newTransaction.id,
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
            original_price: product.price,
            cost_price: weightedCost 
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

    // 4. Post-Process: Stock Alerts (Async, non-blocking logic wrapper)
    // Kita jalankan dan log errornya, tapi tidak throw error agar transaksi tetap sukses
    this.handleStockAlerts(storeId, updatedProducts).catch(err => {
      console.error('[TransactionService] Stock alert error:', err);
    });

    return transaction;
  }

  private static async handleStockAlerts(storeId: string, updatedProducts: Product[]) {
    try {
      const lowStockProducts = updatedProducts
        .map(adaptPrismaProductForStockCheck)
        .filter(checkLowStock);

      // Selalu refresh alert cache
      await checkLowStockProducts(storeId, true);

      if (lowStockProducts.length > 0) {
        console.log(`[TransactionService] Found ${lowStockProducts.length} low stock products.`);
      }
    } catch (error) {
      throw error;
    }
  }
}
