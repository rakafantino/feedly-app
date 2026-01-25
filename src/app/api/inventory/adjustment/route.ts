
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { NotificationService } from '@/services/notification.service';

/**
 * POST /api/inventory/adjustment
 * Record a stock adjustment (Waste, Damaged, Correction)
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { 
      storeId, 
      productId, 
      batchId, 
      quantity, // Negative for removal, positive for addition
      type,     // WASTE, DAMAGED, EXPIRED, CORRECTION
      reason 
    } = await req.json();

    if (!storeId || !productId || !type || quantity === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify product ownership
    const product = await prisma.product.findFirst({
      where: { id: productId, storeId }
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // If batch specified, verify batch
    let batch = null;
    if (batchId) {
      batch = await prisma.productBatch.findFirst({
        where: { id: batchId, productId }
      });
      if (!batch) {
        return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
      }
      
      // Prevent reducing below 0 ? Or allow negative?
      // Strict inventory: usually prevent.
      if (quantity < 0 && batch.stock + quantity < 0) {
         return NextResponse.json({ error: 'Insufficient batch stock' }, { status: 400 }); 
      }
    } else {
       // Check total stock if no batch
       if (quantity < 0 && product.stock + quantity < 0) {
          return NextResponse.json({ error: 'Insufficient product stock' }, { status: 400 });
       }
    }

    // Determine Cost Price (HPP)
    // Use batch purchase price if available, else product purchase price, else 0
    let costPrice = 0;
    if (batch && batch.purchasePrice) {
      costPrice = batch.purchasePrice;
    } else if (product.purchase_price) {
      costPrice = product.purchase_price;
    }

    // Perform Transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Adjustment Record
      const adjustment = await tx.stockAdjustment.create({
        data: {
          storeId,
          productId,
          batchId,
          quantity,
          type,
          reason,
          costPerUnit: costPrice,
          totalValue: quantity * costPrice, // Negative value for loss
          createdById: session.user.id
        }
      });

      // 2. Update Batch Stock (if applicable)
      if (batchId) {
        await tx.productBatch.update({
          where: { id: batchId },
          data: { stock: { increment: quantity } }
        });
      }

      // 3. Update Product Total Stock
      await tx.product.update({
        where: { id: productId },
        data: { stock: { increment: quantity } }
      });

      return adjustment;
    });

    // 4. Trigger Notification Update (Async)
    // If stock changes or runs out, we might need to clear notifications
    // Calling the check will refresh status
    // Delay slightly to ensure DB consistency if read replica lag (rare here)
    setTimeout(async () => {
        try {
            // Re-run checks for this store. 
            // This will auto-clear expired notifications for this product if stock is now 0.
            await NotificationService.checkExpiredProducts(storeId);
            await NotificationService.checkLowStockProducts(storeId);
        } catch(e) { 
            console.error("Post-adjustment check failed", e);
        }
    }, 100);

    return NextResponse.json({ success: true, data: result });

  } catch (error) {
    console.error('[API] Stock Adjustment Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
