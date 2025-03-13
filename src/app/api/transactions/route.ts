import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { PrismaClient, Product } from '@prisma/client';
import axios, { AxiosError } from 'axios';
import { checkLowStock } from '@/lib/stockAlertService';

// Adapter function untuk menyesuaikan tipe Product dari Prisma dengan tipe Product dari useProductStore
function adaptPrismaProductForStockCheck(prismaProduct: Product): any {
  return {
    ...prismaProduct,
    supplier_id: prismaProduct.supplierId,
    category: prismaProduct.category || '',
    unit: prismaProduct.unit || 'pcs',
  };
}

// Get all transactions
export async function GET() {
  try {
    const transactions = await prisma.transaction.findMany({
      include: {
        items: {
          include: {
            product: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    return NextResponse.json({ transactions }, { status: 200 });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// Create a new transaction
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        { error: 'Transaction must include at least one item' },
        { status: 400 }
      );
    }
    
    if (!body.paymentMethod) {
      return NextResponse.json(
        { error: 'Payment method is required' },
        { status: 400 }
      );
    }
    
    // Calculate total from items
    let total = 0;
    for (const item of body.items) {
      if (!item.productId || !item.quantity || !item.price) {
        return NextResponse.json(
          { error: 'Each item must include productId, quantity, and price' },
          { status: 400 }
        );
      }
      
      total += parseFloat(item.price) * parseFloat(item.quantity);
    }
    
    // Validate payment details if provided
    let paymentDetailsJson = null;
    if (body.paymentDetails && Array.isArray(body.paymentDetails)) {
      // Validasi total pembayaran
      const paymentTotal = body.paymentDetails.reduce(
        (sum: number, payment: { amount: number }) => sum + payment.amount, 
        0
      );
      
      if (paymentTotal < total) {
        return NextResponse.json(
          { error: 'Total pembayaran kurang dari total transaksi' },
          { status: 400 }
        );
      }
      
      // Simpan detail pembayaran sebagai JSON string
      paymentDetailsJson = JSON.stringify(body.paymentDetails);
    }
    
    // Array untuk menyimpan produk yang perlu dicek threshold-nya
    const updatedProducts: Product[] = [];
    
    // Create transaction and items in a transaction
    const transaction = await prisma.$transaction(async (tx: Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">) => {
      // Create transaction
      const newTransaction = await tx.transaction.create({
        data: {
          total,
          paymentMethod: body.paymentMethod,
          paymentDetails: paymentDetailsJson,
        }
      });
      
      // Create transaction items and update product stock
      for (const item of body.items) {
        // Create transaction item
        await tx.transactionItem.create({
          data: {
            transactionId: newTransaction.id,
            productId: item.productId,
            quantity: parseFloat(item.quantity),
            price: parseFloat(item.price)
          }
        });
        
        // Update product stock
        const product = await tx.product.findUnique({
          where: { id: item.productId }
        });
        
        if (!product) {
          throw new Error(`Product with ID ${item.productId} not found`);
        }
        
        const newStock = product.stock - parseFloat(item.quantity);
        
        if (newStock < 0) {
          throw new Error(`Not enough stock for product ${product.name}`);
        }
        
        const updatedProduct = await tx.product.update({
          where: { id: item.productId },
          data: { stock: newStock }
        });
        
        // Tambahkan produk yang diperbarui ke array
        updatedProducts.push(updatedProduct);
      }
      
      return newTransaction;
    });
    
    // Cek produk yang stoknya di bawah threshold & kirim notifikasi via socket
    try {
      // Gunakan URL absolut untuk server-side API calls
      const origin = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      
      console.log('[transactions] Initializing Socket.io connection via:', `${origin}/api/socketio`);
      
      // Inisialisasi Socket.io connection jika belum ada
      // Tambahkan timeout yang lebih panjang dan gunakan try-catch terpisah 
      try {
        await axios.get(`${origin}/api/socketio`, { 
          timeout: 5000,
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });
        console.log('[transactions] Socket.io connection successful');
      } catch (error) {
        const socketInitError = error as Error | AxiosError;
        const errorMessage = socketInitError instanceof Error ? socketInitError.message : 'Unknown error';
        console.error('[transactions] Error initializing socket:', errorMessage);
        // Lanjutkan meskipun koneksi socket gagal
      }
      
      // Cek dan kirim alert untuk produk yang stok-nya diperbarui
      const lowStockProducts = updatedProducts
        .map(adaptPrismaProductForStockCheck)
        .filter(checkLowStock);
      
      // Jika ada produk dengan stok rendah, kirim ke server socket
      if (lowStockProducts.length > 0) {
        console.log(`[transactions] Found ${lowStockProducts.length} products with low stock after transaction`);
        
        try {
          // Socket.io server akan mengirim notifikasi ke client
          const stockAlertResponse = await axios.post(`${origin}/api/stock-alerts`, {
            products: lowStockProducts
          }, {
            timeout: 5000,
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            }
          });
          
          console.log('[transactions] Stock alert sent successfully:', stockAlertResponse.status);
        } catch (error) {
          const alertError = error as Error | AxiosError;
          const errorMessage = alertError instanceof Error ? alertError.message : 'Unknown error';
          console.error('[transactions] Error sending stock alert:', errorMessage);
        }
      } else {
        console.log('[transactions] No products with low stock found');
      }
    } catch (error) {
      // Log error tapi jangan gagalkan transaksi
      const socketError = error as Error;
      console.error('[transactions] Error in stock alert process:', socketError.message || 'Unknown error');
    }
    
    return NextResponse.json({ transaction }, { status: 201 });
  } catch (error) {
    console.error('Error creating transaction:', error);
    
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
} 