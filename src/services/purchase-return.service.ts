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
    const purchaseReturn = await tx.purchaseReturn.create({
      data: {
        ...returnData,
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

    for (const item of items) {
      let remainingQty = item.quantity;

      const batches = await tx.productBatch.findMany({
        where: { productId: item.productId, stock: { gt: 0 } },
        orderBy: { createdAt: 'asc' },
      });

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

    const po = purchaseReturn.purchaseOrder;
    // Retur mengurangi sisa hutang, tapi TIDAK menambah amountPaid (karena bukan pembayaran tunai)
    const newRemainingAmount = Math.max(0, po.remainingAmount - totalAmount);
    
    await tx.purchaseOrder.update({
      where: { id: input.purchaseOrderId },
      data: {
        remainingAmount: newRemainingAmount,
        // amountPaid tetap sama, tidak berubah
        paymentStatus: newRemainingAmount <= 0 ? 'PAID' : 'PARTIAL',
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