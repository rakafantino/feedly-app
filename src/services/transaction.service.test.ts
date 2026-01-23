import { TransactionService } from "./transaction.service";
import { BatchService } from "./batch.service";
import prisma from "@/lib/prisma";
// import { checkLowStockProducts } from "@/lib/notificationService"; // Unused

// Mock dependencies
jest.mock("@/lib/prisma", () => ({
  $transaction: jest.fn((callback) => callback(prisma)),
  transaction: {
    count: jest.fn(),
    create: jest.fn(),
  },
  transactionItem: {
    create: jest.fn(),
  },
  product: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
}));

// checkLowStockProducts removed
// jest.mock("@/lib/notificationService", () => ({
//   checkLowStockProducts: jest.fn(),
// }));

jest.mock("./batch.service", () => ({
  BatchService: {
    deductStock: jest.fn(),
  },
}));

describe("TransactionService", () => {
  const mockStoreId = "store-123";
  const mockProduct = {
    id: "prod-1",
    name: "Test Product",
    price: 15000,
    purchase_price: 10000,
    stock: 50,
    storeId: mockStoreId,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createTransaction", () => {
    it("should persist cost_price and original_price when creating a transaction", async () => {
      // Setup Mocks
      (prisma.transaction.count as jest.Mock).mockResolvedValue(0);
      (prisma.transaction.create as jest.Mock).mockResolvedValue({
        id: "trans-1",
        total: 13500,
        invoiceNumber: "INV/20260123/0001",
      });

      (prisma.product.findFirst as jest.Mock).mockResolvedValue(mockProduct);
      
      // Mock BatchService.deductStock
      (BatchService.deductStock as jest.Mock).mockResolvedValue([
        {
          batchId: "batch-1",
          deducted: 1,
          cost: 10000,
        }
      ]);

      (prisma.product.update as jest.Mock).mockResolvedValue({
        ...mockProduct,
        stock: 49,
      });

      const transactionData = {
        items: [
          {
            productId: "prod-1",
            quantity: 1,
            price: 13500, // Discounted price (Sold Price)
          },
        ],
        paymentMethod: "CASH",
        paymentDetails: [{ amount: 13500 }],
      };

      // Execute
      await TransactionService.createTransaction(mockStoreId, transactionData);

      // Verify
      expect(prisma.transactionItem.create).toHaveBeenCalledWith({
        data: {
          transactionId: "trans-1",
          productId: "prod-1",
          quantity: 1,
          price: 13500, // Sold Price
          original_price: 15000, // Should come from product.price
          cost_price: 10000, // Should come from product.purchase_price
        },
      });
    });
  });
});
