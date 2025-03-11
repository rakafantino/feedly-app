import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { PrismaClient } from '@prisma/client';

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
        
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: newStock }
        });
      }
      
      return newTransaction;
    });
    
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