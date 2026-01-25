
import prisma from "@/lib/prisma";

export interface PurchaseReportSummary {
  totalSpend: number;
  totalTransactions: number;
  averageSpend: number;
}

export interface PurchaseReportItem {
  id: string;
  poNumber: string;
  date: Date;
  supplierName: string;
  status: string;
  itemCount: number;
  total: number;
}

export class PurchaseReportService {
  /**
   * Retrieves purchase report data for a given date range and store.
   * Only includes POs with status 'completed' or 'ordered'.
   */
  async getPurchaseReport(storeId: string, startDate: Date, endDate: Date) {
    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where: {
        storeId,
        status: { in: ["completed", "ordered", "received", "partially_received"] }, // Only committed spending
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        items: true,
        supplier: {
          select: { name: true },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    let totalSpend = 0;

    const items: PurchaseReportItem[] = purchaseOrders.map((po) => {
      // Calculate total for this PO since it's not stored in the DB (yet)
      const poTotal = po.items.reduce((sum, item) => {
        return sum + item.quantity * item.price;
      }, 0);

      const itemCount = po.items.reduce((sum, item) => sum + (item.receivedQuantity ?? item.quantity), 0);

      totalSpend += poTotal;

      return {
        id: po.id,
        poNumber: po.poNumber,
        date: po.createdAt,
        supplierName: po.supplier.name,
        status: po.status,
        itemCount,
        total: poTotal,
      };
    });

    const summary: PurchaseReportSummary = {
      totalSpend,
      totalTransactions: purchaseOrders.length,
      averageSpend: purchaseOrders.length > 0 ? totalSpend / purchaseOrders.length : 0,
    };

    return {
      summary,
      items,
    };
  }
}

export const purchaseReportService = new PurchaseReportService();
