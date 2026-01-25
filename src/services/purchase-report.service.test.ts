
import { purchaseReportService } from "./purchase-report.service";
import prisma from "@/lib/prisma";

// Mock Prisma
jest.mock("@/lib/prisma", () => ({
  purchaseOrder: {
    findMany: jest.fn(),
  },
}));

describe("PurchaseReportService", () => {
  const mockStoreId = "store-123";
  const mockStartDate = new Date("2024-01-01");
  const mockEndDate = new Date("2024-01-31");

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should calculate total spend correctly from PO items", async () => {
    // Arrange
    const mockPOs = [
      {
        id: "po-1",
        poNumber: "PO/001",
        createdAt: new Date("2024-01-10"),
        status: "completed",
        supplier: { name: "Supplier A" },
        items: [
          { quantity: 10, price: 5000 }, // 50,000
          { quantity: 2, price: 25000 }, // 50,000
        ], // Total: 100,000
      },
      {
        id: "po-2",
        poNumber: "PO/002",
        createdAt: new Date("2024-01-15"),
        status: "ordered",
        supplier: { name: "Supplier B" },
        items: [
          { quantity: 5, price: 10000 }, // 50,000
        ], // Total: 50,000
      },
    ];

    (prisma.purchaseOrder.findMany as jest.Mock).mockResolvedValue(mockPOs);

    // Act
    const result = await purchaseReportService.getPurchaseReport(
      mockStoreId,
      mockStartDate,
      mockEndDate
    );

    // Assert
    expect(result.summary.totalSpend).toBe(150000); // 100k + 50k
    expect(result.summary.totalTransactions).toBe(2);
    expect(result.summary.averageSpend).toBe(75000);
    
    // Check Status Filtering (Implied by current implementation, but good to verify call args)
    expect(prisma.purchaseOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
            where: expect.objectContaining({
                status: { in: ["completed", "ordered", "received", "partially_received"] }
            })
        })
    );
  });

  it("should handle empty results", async () => {
    // Arrange
    (prisma.purchaseOrder.findMany as jest.Mock).mockResolvedValue([]);

    // Act
    const result = await purchaseReportService.getPurchaseReport(
      mockStoreId,
      mockStartDate,
      mockEndDate
    );

    // Assert
    expect(result.summary.totalSpend).toBe(0);
    expect(result.summary.totalTransactions).toBe(0);
    expect(result.summary.averageSpend).toBe(0);
    expect(result.items).toHaveLength(0);
  });
});
