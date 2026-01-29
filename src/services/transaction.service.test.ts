import { TransactionService } from "./transaction.service";
import { BatchService } from "./batch.service";
import prisma from "@/lib/prisma";
import { NotificationService } from "@/services/notification.service";

// Mock dependencies
jest.mock("@/lib/prisma", () => ({
  $transaction: jest.fn((callback) => callback(prisma)),
  transaction: {
    count: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  transactionItem: {
    create: jest.fn(),
  },
  debtPayment: {
    create: jest.fn(),
  },
  product: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
}));

jest.mock("@/services/notification.service", () => ({
  NotificationService: {
    checkLowStockProducts: jest.fn(),
    checkDebtDue: jest.fn(),
  },
}));

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

    it("should correctly handle manual discount in total calculation and persistence", async () => {
      // Setup
      (prisma.transaction.count as jest.Mock).mockResolvedValue(0);
      (prisma.transaction.create as jest.Mock).mockResolvedValue({
         id: "trans-discount",
         total: 25000,
         discount: 1000,
         paymentStatus: "PAID",
         amountPaid: 25000
      });
      (prisma.product.findFirst as jest.Mock).mockResolvedValue(mockProduct);
      (prisma.product.update as jest.Mock).mockResolvedValue(mockProduct);
      (BatchService.deductStock as jest.Mock).mockResolvedValue([]);

      const payload = {
        items: [
           { productId: "prod-1", quantity: 2, price: 13000 } // Total Item Price 26k
        ],
        paymentMethod: "CASH",
        discount: 1000, // Manual Discount
        amountPaid: 25000 // Net Payment
      };

      await TransactionService.createTransaction(mockStoreId, payload);

      expect(prisma.transaction.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          total: 25000,   // Net Total (26k - 1k)
          discount: 1000, // Persisted Discount
          amountPaid: 25000,
          remainingAmount: 0
        })
      }));
    });

  describe("Debt Logic", () => {
    it("should set status to PAID if amountPaid >= total", async () => {
      // Setup
      (prisma.transaction.count as jest.Mock).mockResolvedValue(0);
      (prisma.transaction.create as jest.Mock).mockResolvedValue({ id: "trans-full", total: 10000 });
      (prisma.product.findFirst as jest.Mock).mockResolvedValue(mockProduct);
      (BatchService.deductStock as jest.Mock).mockResolvedValue([]);
      (prisma.product.update as jest.Mock).mockResolvedValue(mockProduct);

      const payload = {
        items: [{ productId: "prod-1", quantity: 1, price: 10000 }],
        paymentMethod: "CASH",
        amountPaid: 10000
      };

      await TransactionService.createTransaction(mockStoreId, payload);

      expect(prisma.transaction.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          paymentStatus: "PAID",
          amountPaid: 10000,
          remainingAmount: 0
        })
      }));
    });

    it("should persist dueDate when creating a debt transaction", async () => {
       // Setup
       (prisma.transaction.count as jest.Mock).mockResolvedValue(0);
       (prisma.transaction.create as jest.Mock).mockResolvedValue({ id: "trans-due", total: 10000 });
       (prisma.product.findFirst as jest.Mock).mockResolvedValue(mockProduct);
       (prisma.product.update as jest.Mock).mockResolvedValue(mockProduct);
       (BatchService.deductStock as jest.Mock).mockResolvedValue([]);
 
       const dueDate = new Date("2026-02-01");
       const payload = {
         items: [{ productId: "prod-1", quantity: 1, price: 10000 }],
         paymentMethod: "DEBT",
         amountPaid: 0,
         customerId: "cust-1",
         dueDate: dueDate
       };
 
       await TransactionService.createTransaction(mockStoreId, payload);
 
       expect(prisma.transaction.create).toHaveBeenCalledWith(expect.objectContaining({
         data: expect.objectContaining({
           paymentStatus: "UNPAID",
           dueDate: dueDate,   // Expect dueDate to be passed
           remainingAmount: 10000
         })
       }));

       expect(NotificationService.checkDebtDue).toHaveBeenCalledWith(mockStoreId);
    });

    it("should set status to PARTIAL if amountPaid < total and customer is present", async () => {
      // Setup
      (prisma.transaction.count as jest.Mock).mockResolvedValue(0);
      (prisma.transaction.create as jest.Mock).mockResolvedValue({ id: "trans-partial", total: 10000 });
      (prisma.product.findFirst as jest.Mock).mockResolvedValue(mockProduct);
      (BatchService.deductStock as jest.Mock).mockResolvedValue([]);
      (prisma.product.update as jest.Mock).mockResolvedValue(mockProduct);

      const payload = {
        items: [{ productId: "prod-1", quantity: 1, price: 10000 }],
        paymentMethod: "DEBT",
        amountPaid: 2000,
        customerId: "cust-123"
      };

      await TransactionService.createTransaction(mockStoreId, payload);

      expect(prisma.transaction.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          paymentStatus: "PARTIAL",
          amountPaid: 2000,
          remainingAmount: 8000,
          customerId: "cust-123"
        })
      }));
    });

    it("should throw error if debt amount exists but no customer is selected", async () => {
      // Setup
      (prisma.product.findFirst as jest.Mock).mockResolvedValue(mockProduct);
      (BatchService.deductStock as jest.Mock).mockResolvedValue([]);
      
      const payload = {
        items: [{ productId: "prod-1", quantity: 1, price: 10000 }],
        paymentMethod: "DEBT",
        amountPaid: 2000,
        customerId: undefined // Missing Customer
      };

      await expect(TransactionService.createTransaction(mockStoreId, payload))
        .rejects
        .toThrow("Customer is required for debt transactions");
    });
  });

  describe("payDebt", () => {
    const mockTransaction = {
      id: "trans-debt",
      total: 10000,
      amountPaid: 2000,
      remainingAmount: 8000,
      paymentStatus: "PARTIAL",
      storeId: mockStoreId,
    };

    it("should process payment and update transaction status to PAID if full remaining is paid", async () => {
      // Setup
      (prisma.transaction.findUnique as jest.Mock).mockResolvedValue(mockTransaction);
      (prisma.transaction.update as jest.Mock).mockResolvedValue({
        ...mockTransaction,
        remainingAmount: 0,
        paymentStatus: "PAID",
        amountPaid: 10000
      });
      (prisma.debtPayment.create as jest.Mock).mockResolvedValue({});

      // Execute
      await TransactionService.payDebt(mockStoreId, "trans-debt", 8000, "CASH");

      // Verify
      expect(prisma.debtPayment.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          transactionId: "trans-debt",
          amount: 8000,
          paymentMethod: "CASH"
        })
      }));

      expect(prisma.transaction.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: "trans-debt" },
        data: expect.objectContaining({
          remainingAmount: 0,
          paymentStatus: "PAID",
          amountPaid: 10000
        })
      }));
    });

    it("should process partial payment and keep status PARTIAL", async () => {
      // Setup
      (prisma.transaction.findUnique as jest.Mock).mockResolvedValue(mockTransaction);
      (prisma.transaction.update as jest.Mock).mockResolvedValue({
        ...mockTransaction,
        remainingAmount: 3000,
        paymentStatus: "PARTIAL",
        amountPaid: 7000
      });

      // Execute: Pay 5000 of 8000 remaining
      await TransactionService.payDebt(mockStoreId, "trans-debt", 5000, "CASH");

      // Verify
      expect(prisma.transaction.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          remainingAmount: 3000, // 8000 - 5000
          paymentStatus: "PARTIAL",
          amountPaid: 7000 // 2000 + 5000
        })
      }));
    });

    it("should throw error if payment exceeds remaining debt", async () => {
      (prisma.transaction.findUnique as jest.Mock).mockResolvedValue(mockTransaction);

      // Pay 9000 (remaining is 8000)
      await expect(TransactionService.payDebt(mockStoreId, "trans-debt", 9000, "CASH"))
        .rejects
        .toThrow("Payment amount exceeds remaining debt");
    });
  });

  describe("writeOffDebt", () => {
    const mockDebtTransaction = {
      id: "trans-wo",
      total: 10000,
      amountPaid: 2000,
      remainingAmount: 8000,
      paymentStatus: "PARTIAL",
      storeId: mockStoreId,
      writtenOffAt: null,
      writtenOffAmount: null,
    };

    it("should write off remaining debt and update transaction status", async () => {
      // Setup
      (prisma.transaction.findUnique as jest.Mock).mockResolvedValue(mockDebtTransaction);
      (prisma.transaction.update as jest.Mock).mockResolvedValue({
        ...mockDebtTransaction,
        paymentStatus: "WRITTEN_OFF",
        remainingAmount: 0,
        writtenOffAmount: 8000,
        writtenOffAt: expect.any(Date),
        writtenOffReason: "Pelanggan tidak dapat dihubungi",
      });

      // Execute
      const result = await TransactionService.writeOffDebt(
        mockStoreId, 
        "trans-wo", 
        "Pelanggan tidak dapat dihubungi"
      );

      // Verify
      expect(prisma.transaction.update).toHaveBeenCalledWith({
        where: { id: "trans-wo" },
        data: {
          paymentStatus: "WRITTEN_OFF",
          remainingAmount: 0,
          writtenOffAmount: 8000,
          writtenOffAt: expect.any(Date),
          writtenOffReason: "Pelanggan tidak dapat dihubungi",
        },
      });
      expect(result.paymentStatus).toBe("WRITTEN_OFF");
    });

    it("should throw error if transaction not found", async () => {
      (prisma.transaction.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(TransactionService.writeOffDebt(mockStoreId, "invalid-id"))
        .rejects
        .toThrow("Transaction invalid-id not found in this store");
    });

    it("should throw error if transaction has no remaining debt", async () => {
      (prisma.transaction.findUnique as jest.Mock).mockResolvedValue({
        ...mockDebtTransaction,
        remainingAmount: 0,
        paymentStatus: "PAID",
      });

      await expect(TransactionService.writeOffDebt(mockStoreId, "trans-wo"))
        .rejects
        .toThrow("Transaction has no remaining debt to write off");
    });

    it("should throw error if transaction is already written off", async () => {
      (prisma.transaction.findUnique as jest.Mock).mockResolvedValue({
        ...mockDebtTransaction,
        paymentStatus: "WRITTEN_OFF",
      });

      await expect(TransactionService.writeOffDebt(mockStoreId, "trans-wo"))
        .rejects
        .toThrow("Transaction is already written off");
    });
  });
});
});
