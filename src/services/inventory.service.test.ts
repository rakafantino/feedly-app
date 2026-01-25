
import { inventoryService } from "./inventory.service";
import prisma from "@/lib/prisma";

// Mock Prisma
jest.mock("@/lib/prisma", () => ({
  product: {
    findMany: jest.fn(),
  },
}));

describe("InventoryService", () => {
  const mockStoreId = "store-123";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should calculate correct valuation for products with price", async () => {
    // Arrange
    const mockProducts = [
      {
        id: "p1",
        name: "Product A",
        product_code: "A001",
        stock: 10,
        purchase_price: 10000,
        unit: "pcs",
      },
      {
        id: "p2",
        name: "Product B",
        product_code: "B002",
        stock: 5,
        purchase_price: 20000,
        unit: "pcs",
      },
    ];

    (prisma.product.findMany as jest.Mock).mockResolvedValue(mockProducts);

    // Act
    const result = await inventoryService.getInventoryValuation(mockStoreId);

    // Assert
    // Total = (10 * 10000) + (5 * 20000) = 100000 + 100000 = 200000
    expect(result.summary.totalValuation).toBe(200000);
    expect(result.summary.totalItems).toBe(2);
    expect(result.items[0].totalValue).toBe(100000);
    expect(result.items[1].totalValue).toBe(100000);
  });

  it("should handle products with missing purchase price (treat as 0)", async () => {
    // Arrange
    const mockProducts = [
      {
        id: "p1",
        name: "Product A",
        stock: 10,
        purchase_price: null, // No price
        unit: "pcs",
      },
    ];

    (prisma.product.findMany as jest.Mock).mockResolvedValue(mockProducts);

    // Act
    const result = await inventoryService.getInventoryValuation(mockStoreId);

    // Assert
    expect(result.summary.totalValuation).toBe(0);
    expect(result.items[0].avgBuyPrice).toBe(0);
    expect(result.items[0].totalValue).toBe(0);
  });

  it("should handle empty product list", async () => {
    // Arrange
    (prisma.product.findMany as jest.Mock).mockResolvedValue([]);

    // Act
    const result = await inventoryService.getInventoryValuation(mockStoreId);

    // Assert
    expect(result.summary.totalValuation).toBe(0);
    expect(result.summary.totalItems).toBe(0);
    expect(result.items).toHaveLength(0);
  });
  
  it("should return sorted items by highest value", async () => {
     // Arrange
     const mockProducts = [
        { id: "p1", name: "Low Value", stock: 1, purchase_price: 100, unit: "pcs" },   // 100
        { id: "p2", name: "High Value", stock: 10, purchase_price: 1000, unit: "pcs" }, // 10000
    ];

    (prisma.product.findMany as jest.Mock).mockResolvedValue(mockProducts);

    // Act
    const result = await inventoryService.getInventoryValuation(mockStoreId);

    // Assert
    expect(result.items[0].name).toBe("High Value");
    expect(result.items[1].name).toBe("Low Value");
  });
});
