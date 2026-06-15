import prisma from "@/lib/prisma";

interface CreatePurchaseReturnInput {
  purchaseOrderId: string;
  supplierId: string;
  storeId: string;
  reason?: string;
  notes?: string;
  createdById?: string;
  items: Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
  }>;
}

async function createPurchaseReturn(input: CreatePurchaseReturnInput) {
  const { items, ...returnData } = input;

  const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

  return prisma.$transaction(async (tx) => {
    const originalPo = await tx.purchaseOrder.findUnique({
      where: { id: input.purchaseOrderId },
      include: { 
        items: true,
        returns: {
          include: { items: true }
        }
      }
    });

    if (!originalPo) {
      throw new Error("Purchase Order not found");
    }

    const secureSupplierId = originalPo.supplierId;
    const secureStoreId = originalPo.storeId;

    const previouslyReturnedMap = new Map<string, number>();
    for (const ret of originalPo.returns) {
      for (const retItem of ret.items) {
        const currentQty = previouslyReturnedMap.get(retItem.productId) || 0;
        previouslyReturnedMap.set(retItem.productId, currentQty + retItem.quantity);
      }
    }

    for (const item of items) {
      if (item.quantity <= 0) {
        throw new Error(`Return quantity for product ${item.productId} must be greater than zero`);
      }

      let remainingQty = item.quantity;

      const originalItem = originalPo.items.find(i => i.productId === item.productId);
      if (!originalItem) {
        throw new Error(`Product ${item.productId} was not part of the original Purchase Order`);
      }
      
      const previouslyReturned = previouslyReturnedMap.get(item.productId) || 0;
      if (item.quantity + previouslyReturned > originalItem.quantity) {
        throw new Error(`Return quantity for product ${item.productId} exceeds original purchase quantity. Already returned: ${previouslyReturned}`);
      }
      
      // Update map to prevent bypass from duplicate items in the payload
      previouslyReturnedMap.set(item.productId, previouslyReturned + item.quantity);

      if (item.unitPrice !== originalItem.price) {
        throw new Error(`Return unit price for product ${item.productId} does not match original purchase price`);
      }

      const batches = await tx.productBatch.findMany({
        where: { 
          productId: item.productId, 
          supplierId: secureSupplierId,
          stock: { gt: 0 } 
        },
        orderBy: { inDate: 'asc' },
      });

      const totalBatchStock = batches.reduce((sum, b) => sum + b.stock, 0);
      if (item.quantity > totalBatchStock) {
        throw new Error(`Insufficient stock for product ${item.productId}. Trying to return ${item.quantity}, but only ${totalBatchStock} available in batches from this supplier.`);
      }

      for (const batch of batches) {
        if (remainingQty <= 0) break;

        const deductFromBatch = Math.min(batch.stock, remainingQty);
        await tx.productBatch.update({
          where: { id: batch.id },
          data: { stock: { decrement: deductFromBatch } },
        });
        remainingQty -= deductFromBatch;
      }

      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } },
      });
    }

    const directDeduction = Math.min(originalPo.remainingAmount, totalAmount);
    const newRemainingAmount = originalPo.remainingAmount - directDeduction;
    const newTotalAmount = originalPo.totalAmount - totalAmount;
    let excessCredit = totalAmount - directDeduction;
    const newAmountPaid = originalPo.amountPaid - excessCredit;
    
    await tx.purchaseOrder.update({
      where: { id: input.purchaseOrderId },
      data: {
        remainingAmount: newRemainingAmount,
        totalAmount: newTotalAmount,
        amountPaid: newAmountPaid >= 0 ? newAmountPaid : 0,
        paymentStatus: newRemainingAmount <= 0 ? 'PAID' : 'PARTIAL',
      },
    });

    let finalNotes = returnData.notes || "";

    if (excessCredit > 0) {
      const unpaidPOs = await tx.purchaseOrder.findMany({
        where: {
          supplierId: secureSupplierId,
          storeId: secureStoreId,
          id: { not: input.purchaseOrderId },
          remainingAmount: { gt: 0 }
        },
        orderBy: { createdAt: 'asc' }
      });

      for (const activePo of unpaidPOs) {
        if (excessCredit <= 0) break;
        
        const cascadeDeduction = Math.min(activePo.remainingAmount, excessCredit);
        const activeNewRemaining = activePo.remainingAmount - cascadeDeduction;
        
        await tx.purchaseOrder.update({
          where: { id: activePo.id },
          data: {
            remainingAmount: activeNewRemaining,
            amountPaid: activePo.amountPaid + cascadeDeduction,
            paymentStatus: activeNewRemaining <= 0 ? 'PAID' : 'PARTIAL'
          }
        });
        
        excessCredit -= cascadeDeduction;
      }
      
      if (excessCredit > 0) {
        const systemNote = `(System Note: Supplier owes Rp ${excessCredit} cash refund)`;
        finalNotes = finalNotes ? `${finalNotes}\n${systemNote}` : systemNote;
      }
    }

    const purchaseReturn = await tx.purchaseReturn.create({
      data: {
        reason: returnData.reason,
        createdById: returnData.createdById,
        notes: finalNotes,
        storeId: secureStoreId,
        supplierId: secureSupplierId,
        purchaseOrderId: input.purchaseOrderId,
        totalAmount,
        items: {
          create: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.quantity * item.unitPrice,
          })),
        },
      },
      include: {
        items: true,
        purchaseOrder: true,
        supplier: true,
      },
    });

    return purchaseReturn;
  });
}

async function getPurchaseReturnsBySupplier(supplierId: string, storeId: string) {
  return prisma.purchaseReturn.findMany({
    where: { supplierId, storeId },
    include: {
      items: {
        include: { product: true },
      },
      purchaseOrder: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

async function getPurchaseReturnsByPO(purchaseOrderId: string) {
  return prisma.purchaseReturn.findMany({
    where: { purchaseOrderId },
    include: {
      items: {
        include: { product: true },
      },
      supplier: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

async function getAllPurchaseReturns(storeId: string) {
  return prisma.purchaseReturn.findMany({
    where: { storeId },
    include: {
      items: {
        include: { product: true },
      },
      purchaseOrder: true,
      supplier: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

export {
  createPurchaseReturn,
  getPurchaseReturnsBySupplier,
  getPurchaseReturnsByPO,
  getAllPurchaseReturns,
};