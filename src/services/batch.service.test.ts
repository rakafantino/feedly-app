import { BatchService } from "./batch.service";
import prisma from "@/lib/prisma";

// Mock dependencies
jest.mock("@/lib/prisma", () => ({
  $transaction: jest.fn((callback) => callback(prisma)),
  productBatch: {
    create: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  product: {
    update: jest.fn(),
    findUnique: jest.fn(),
  },
}));

describe("BatchService", () => {
  const mockProductId = "prod-1";
  // const mockStoreId = "store-1"; // Unused

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("addBatch", () => {
    it("should create a new batch and increment product stock", async () => {
      // Setup
      const batchData = {
        productId: mockProductId,
        stock: 10,
        expiryDate: new Date("2026-12-31"),
        batchNumber: "BATCH-001",
        purchasePrice: 10000,
      };

      (prisma.productBatch.create as jest.Mock).mockResolvedValue({
        id: "batch-1",
        ...batchData,
      });

      // Execute
      await BatchService.addBatch(batchData);

      // Verify
      expect(prisma.productBatch.create).toHaveBeenCalledWith({
        data: expect.objectContaining(batchData),
      });

      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: mockProductId },
        data: {
          stock: { increment: 10 },
          // Also update global fields if this is the only/latest batch?
          // For now just stock increment
        },
      });
    });
  });

  describe("deductStock (FEFO)", () => {
    const mockBatches = [
      {
        id: "batch-early",
        productId: mockProductId,
        stock: 10,
        expiryDate: new Date("2026-01-01"), // Expires sooner
        purchasePrice: 10000,
      },
      {
        id: "batch-late",
        productId: mockProductId,
        stock: 20,
        expiryDate: new Date("2026-12-31"), // Expires later
        purchasePrice: 12000,
      },
    ];

    it("should deduct from the earliest expiring batch first", async () => {
      // Scenario: Request 5 items. Early batch has 10.
      // Expected: Early batch becomes 5. Late batch untouched.
      
      (prisma.product.findUnique as jest.Mock).mockResolvedValue({ stock: 30 });
      (prisma.productBatch.findMany as jest.Mock).mockResolvedValue(mockBatches);

      await BatchService.deductStock(mockProductId, 5);

      expect(prisma.productBatch.update).toHaveBeenCalledTimes(1);
      expect(prisma.productBatch.update).toHaveBeenCalledWith({
        where: { id: "batch-early" },
        data: { stock: { decrement: 5 } },
      });

      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: mockProductId },
        data: { stock: { decrement: 5 } },
      });
    });

    it("should split deduction across multiple batches if necessary", async () => {
      // Scenario: Request 15 items. Early batch has 10. Late has 20.
      // Expected: Early batch becomes 0 (deduct 10). Late batch becomes 15 (deduct 5).
      
      (prisma.product.findUnique as jest.Mock).mockResolvedValue({ stock: 30 });
      (prisma.productBatch.findMany as jest.Mock).mockResolvedValue(mockBatches);

      await BatchService.deductStock(mockProductId, 15);

      expect(prisma.productBatch.update).toHaveBeenCalledTimes(2);
      
      // First update: Drain early batch
      expect(prisma.productBatch.update).toHaveBeenCalledWith({
        where: { id: "batch-early" },
        data: { stock: { decrement: 10 } },
      });

      // Second update: Take remainder from late batch
      expect(prisma.productBatch.update).toHaveBeenCalledWith({
        where: { id: "batch-late" },
        data: { stock: { decrement: 5 } },
      });
    });

    it("should throw error if total stock is insufficient", async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue({ stock: 30 });
      // Logic could check product.stock first for optimization
      
      await expect(BatchService.deductStock(mockProductId, 35))
        .rejects.toThrow("Insufficient stock");
    });
  });
});
