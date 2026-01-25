
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
}

export const inventoryService = new InventoryService();
