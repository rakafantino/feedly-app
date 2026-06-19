import { BatchService } from "./batch.service";
import prisma from "@/lib/prisma";
import { StockMutationService } from "@/services/stock-mutation.service";

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

jest.mock("@/services/stock-mutation.service", () => ({
  StockMutationService: {
    createBatch: jest.fn().mockResolvedValue({
      batch: { id: "batch-1", stock: 10, batchNumber: "BATCH-001" },
      product: { id: "prod-1", stock: 60 },
    }),
    deduct: jest.fn().mockResolvedValue([{ batchId: "batch-1", deducted: 5, cost: 10000 }]),
    increment: jest.fn().mockResolvedValue({ product: { id: "prod-1", stock: 60 }, batch: { id: "batch-1" } }),
    reconcileToBatches: jest.fn().mockResolvedValue({ id: "prod-1", stock: 30 }),
  },
}));

describe("BatchService", () => {
  const mockProductId = "prod-1";
  // const mockStoreId = "store-1"; // Unused

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("addBatch", () => {
    it("should create a new batch and calculate moving average price (MAP)", async () => {
      // Setup
      const batchData = {
        productId: mockProductId,
        stock: 10,
        expiryDate: new Date("2026-12-31"),
        batchNumber: "BATCH-001",
        purchasePrice: 10000,
      };

      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        stock: 50,
        purchase_price: 8000,
        hpp_price: 8000
      });

      // Execute
      await BatchService.addBatch(batchData);

      // Verify stock mutation delegated to StockMutationService
      expect(StockMutationService.createBatch).toHaveBeenCalledWith(
        mockProductId,
        10,
        {
          expiryDate: batchData.expiryDate,
          batchNumber: batchData.batchNumber,
          purchasePrice: batchData.purchasePrice,
        },
        expect.anything(),
      );

      // Calculate expected MAP: ((50 * 8000) + (10 * 10000)) / 60
      const expectedMAP = 500000 / 60;

      // Product prices updated separately (stock handled by createBatch)
      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: mockProductId },
        data: {
          purchase_price: expectedMAP,
          hpp_price: expectedMAP,
        },
      });
    });
  });

  describe("deductStock (FEFO)", () => {
    it("should delegate deduction to StockMutationService", async () => {
      await BatchService.deductStock(mockProductId, 5);

      expect(StockMutationService.deduct).toHaveBeenCalledWith(
        mockProductId,
        5,
        expect.anything(),
        { preloadedStock: undefined },
      );
    });

    it("should pass preloadedStock when provided", async () => {
      await BatchService.deductStock(mockProductId, 15, undefined, 30);

      expect(StockMutationService.deduct).toHaveBeenCalledWith(
        mockProductId,
        15,
        expect.anything(),
        { preloadedStock: 30 },
      );
    });

    it("should return the deducted batch entries", async () => {
      const result = await BatchService.deductStock(mockProductId, 5);

      expect(result).toEqual([{ batchId: "batch-1", deducted: 5, cost: 10000 }]);
    });
  });
});
