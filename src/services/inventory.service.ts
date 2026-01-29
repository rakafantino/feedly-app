
import prisma from "@/lib/prisma";

export class InventoryService {
  /**
   * Calculates the total inventory valuation for a store.
   * Based on current stock * purchase_price (fallback to 0).
   */
  async getInventoryValuation(storeId: string) {
    const products = await prisma.product.findMany({
      where: {
        storeId,
        isDeleted: false,
      },
      select: {
        id: true,
        name: true,
        stock: true,
        purchase_price: true,
        unit: true,
        product_code: true
      },
    });

    let totalValuation = 0;
    let totalItems = 0;

    const items = products.map((product) => {
      // Logic: Valuation = Stock * Purchase Price.
      // If purchase_price is null, we can't calculate value, so 0.
      const cost = product.purchase_price ?? 0;
      const value = product.stock * cost;

      if (value > 0) {
        totalValuation += value;
      }
      totalItems += 1;

      return {
        id: product.id,
        code: product.product_code,
        name: product.name,
        stock: product.stock,
        unit: product.unit,
        avgBuyPrice: cost,
        totalValue: value,
      };
    });

    // Sort by highest value first
    items.sort((a, b) => b.totalValue - a.totalValue);

    return {
      summary: {
        totalValuation,
        totalItems,
      },
      items,
    };
  }

  /**
   * Identifies dead stock: Products with no sales in the last X days.
   * Also returns the last time it was sold (if ever).
   */
  async getDeadStock(storeId: string, daysThreshold: number = 30) {
    // 1. Calculate the cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysThreshold);

    // 2. Fetch all products with their LATEST transaction date
    // We can't easily filter by relation aggregation in a single simple query in Prisma without raw queries or tricky where clauses for "every".
    // Efficient strategy: Fetch all products + their most recent transaction item.
    const products = await prisma.product.findMany({
      where: {
        storeId,
        isDeleted: false,
        stock: { gt: 0 } // Only care about items currently in stock
      },
      select: {
        id: true,
        name: true,
        stock: true,
        unit: true,
        purchase_price: true,
        product_code: true,
        category: true,
        items: { // Correct relation name from schema (TransactionItem[])
          orderBy: {
            createdAt: 'desc'
          },
          take: 1,
          select: {
            createdAt: true
          }
        }
      }
    });

    const deadStockItems: any[] = [];
    let potentialLostRevenue = 0;

    for (const product of products) {
      const lastSoldDate = product.items[0]?.createdAt ?? null;

      // Criteria for Dead Stock:
      // 1. Never sold (lastSoldDate is null) OR
      // 2. Last sold date is OLDER than cutoffDate
      const isDeadStock = !lastSoldDate || new Date(lastSoldDate) < cutoffDate;

      if (isDeadStock) {
        const cost = product.purchase_price ?? 0;
        const value = product.stock * cost;
        potentialLostRevenue += value;

        deadStockItems.push({
          id: product.id,
          code: product.product_code,
          name: product.name,
          category: product.category,
          stock: product.stock,
          unit: product.unit,
          avgBuyPrice: cost,
          totalValue: value,
          lastSoldAt: lastSoldDate,
          daysInactive: lastSoldDate 
            ? Math.floor((new Date().getTime() - new Date(lastSoldDate).getTime()) / (1000 * 3600 * 24))
            : -1 // Never sold
        });
      }
    }

    // Sort: "Never sold" (-1) first, then by longest inactivity ??
    // Actually, usually users want to see highest value stuck first.
    deadStockItems.sort((a, b) => b.totalValue - a.totalValue);

    return {
      summary: {
        totalItems: deadStockItems.length,
        totalValuation: potentialLostRevenue
      },
      items: deadStockItems
    };
  }
}

export const inventoryService = new InventoryService();
