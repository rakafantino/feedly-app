
import { NotificationService } from "./notification.service";
import prisma from "@/lib/prisma";
import { broadcastStockAlerts } from "@/lib/notificationEvents";

// Mock dependencies
jest.mock("@/lib/prisma", () => ({
  notification: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    findFirst: jest.fn(),
  },
  product: {
    findMany: jest.fn(),
    fields: {
      threshold: "threshold" // Mocking prisma fields access
    }
  },
  transaction: {
    findMany: jest.fn(),
  },
  purchaseOrder: {
    findMany: jest.fn(),
  },
  store: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
  }
}));

jest.mock("@/lib/notificationEvents", () => ({
  broadcastStockAlerts: jest.fn(),
}));

jest.mock("@/lib/stock-utils", () => ({
  calculateExpiringItems: jest.fn(),
}));

import { calculateExpiringItems } from "@/lib/stock-utils";

describe("NotificationService", () => {
  const mockStoreId = "store-123";
  const mockDate = new Date("2026-01-25T12:00:00Z");

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(mockDate);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("createNotification", () => {
    it("should create a notification and broadcast it", async () => {
      const payload = {
        type: "STOCK",
        title: "Low Stock Alert",
        message: "Product X is low",
        storeId: mockStoreId,
        productId: "prod-1",
        metadata: { currentStock: 2 },
      };

      const createdNotification = { id: "notif-1", ...payload, isRead: false, createdAt: mockDate };
      (prisma.notification.create as jest.Mock).mockResolvedValue(createdNotification);
      (prisma.notification.findMany as jest.Mock).mockResolvedValue([createdNotification]); // for broadcast fetch
      (prisma.notification.count as jest.Mock).mockResolvedValue(1); // for unread count

      const result = await NotificationService.createNotification(payload);

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: payload,
      });
      expect(broadcastStockAlerts).toHaveBeenCalledWith(mockStoreId, expect.objectContaining({
        type: 'update',
        notifications: expect.any(Array),
        unreadCount: 1
      }));
      expect(result).toEqual(createdNotification);
    });
  });

  describe("getNotifications", () => {
    it("should fetch notifications for a store", async () => {
      const mockDbNotification = {
        id: "1",
        type: "STOCK",
        title: "Test",
        message: "Test Message",
        isRead: false,
        storeId: mockStoreId,
        createdAt: new Date(),
        updatedAt: new Date(),
        productId: "p1",
        transactionId: null,
        metadata: {},
        product: { name: "Product 1" }, // Mock relation
        transaction: null
      };

      (prisma.notification.findMany as jest.Mock).mockResolvedValue([mockDbNotification]);

      const result = await NotificationService.getNotifications(mockStoreId);

      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: { storeId: mockStoreId },
        orderBy: { createdAt: "desc" },
        take: 50, // Default limit
        include: {
          product: true,
          transaction: { include: { customer: true } },
          purchaseOrder: true
        }
      });
      
      // Verify transformation
      expect(result[0]).toMatchObject({
        id: "1",
        type: "STOCK",
        title: "Test",
        read: false,
        productName: "Product 1"
      });
    });

    it("should filter by unread status", async () => {
       await NotificationService.getNotifications(mockStoreId, { isRead: false });
       expect(prisma.notification.findMany).toHaveBeenCalledWith(expect.objectContaining({
         where: { storeId: mockStoreId, isRead: false }
       }));
    });
  });

  describe("markAsRead", () => {
    it("should update notification status and broadcast", async () => {
      const mockNotif = { id: "notif-1", storeId: mockStoreId, isRead: true };
      (prisma.notification.update as jest.Mock).mockResolvedValue(mockNotif);
      (prisma.notification.findMany as jest.Mock).mockResolvedValue([]); 
      (prisma.notification.count as jest.Mock).mockResolvedValue(0);

      await NotificationService.markAsRead("notif-1", mockStoreId);

      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: "notif-1" },
        data: { isRead: true },
      });
      expect(broadcastStockAlerts).toHaveBeenCalled();
    });
  });

  describe("markAllAsRead", () => {
    it("should update all notifications for a store", async () => {
      (prisma.notification.updateMany as jest.Mock).mockResolvedValue({ count: 5 });
      (prisma.notification.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.notification.count as jest.Mock).mockResolvedValue(0);

      await NotificationService.markAllAsRead(mockStoreId);

      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { storeId: mockStoreId, isRead: false },
        data: { isRead: true },
      });
      expect(broadcastStockAlerts).toHaveBeenCalled();
    });
  });

  describe("checkLowStockProducts", () => {
    it("should create notifications for low stock products if not exists", async () => {
      const mockProducts = [
        { id: "p1", name: "Prod 1", stock: 5, threshold: 10, storeId: mockStoreId, unit: "pcs" }
      ];
      (prisma.store.findMany as jest.Mock).mockResolvedValue([{ id: mockStoreId }]);
      (prisma.product.findMany as jest.Mock).mockResolvedValue(mockProducts);
      
      // Mock existing notification search returns null (no existing unread alert)
      (prisma.notification.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.notification.create as jest.Mock).mockResolvedValue({});
      (prisma.notification.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.notification.count as jest.Mock).mockResolvedValue(1);

      await NotificationService.checkLowStockProducts(mockStoreId);

      expect(prisma.product.findMany).toHaveBeenCalled();
      
      // Should check if notification exists
      expect(prisma.notification.findFirst).toHaveBeenCalledWith({
        where: {
          productId: "p1",
          type: "STOCK"
        },
        orderBy: {
            createdAt: 'desc'
        }
      });

      // Should create notification
      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: "STOCK",
          productId: "p1",
          storeId: mockStoreId,
          title: "Stok Menipis: Prod 1",
        })
      });
    });

    it("should update existing unread notification if stock changed", async () => {
       const mockProducts = [
        { id: "p1", name: "Prod 1", stock: 2, threshold: 10, storeId: mockStoreId, unit: "pcs" }
      ];
      (prisma.store.findMany as jest.Mock).mockResolvedValue([{ id: mockStoreId }]);
      (prisma.product.findMany as jest.Mock).mockResolvedValue(mockProducts);
      
      // Mock existing notification found
      const existingNotif = { id: "n1", metadata: { currentStock: 5 } };
      (prisma.notification.findFirst as jest.Mock).mockResolvedValue(existingNotif);

      await NotificationService.checkLowStockProducts(mockStoreId);

      // Should update instead of create
      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: "n1" },
        data: expect.objectContaining({
          metadata: expect.objectContaining({ currentStock: 2 }) // Updated stock
        })
      });
      expect(prisma.notification.create).not.toHaveBeenCalled();
    });
  });

  describe("checkDebtDue", () => {
    it("should create notifications for due debts", async () => {
      const mockTransactions = [
        { 
          id: "t1", 
          invoiceNumber: "INV-1", 
          customer: { name: "John" }, 
          remainingAmount: 50000, 
          dueDate: new Date("2026-01-25"), // Due today
          storeId: mockStoreId 
        }
      ];
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue(mockTransactions);
      (prisma.purchaseOrder.findMany as jest.Mock).mockResolvedValue([]); // No supplier debts
      (prisma.notification.findFirst as jest.Mock).mockResolvedValue(null); // No existing alert

      await NotificationService.checkDebtDue(mockStoreId);

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: "DEBT",
          transactionId: "t1",
          title: "Jatuh Tempo: John",
        })
      });
    });
  });

  describe("checkExpiredProducts", () => {
    it("should create notifications for expiring products", async () => {
       const mockStore = { id: mockStoreId, expiryNotificationDays: 30 };
       (prisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore);
       
       const mockProduct = { id: "p-exp", name: "Milk", storeId: mockStoreId };
       (prisma.product.findMany as jest.Mock).mockResolvedValue([mockProduct]);
       
       // Mock existing notif check (none)
       (prisma.notification.findFirst as jest.Mock).mockResolvedValue(null);

       // Mock calculation result using the imported mock
       (calculateExpiringItems as jest.Mock).mockReturnValue([
           { 
               ...mockProduct, 
               daysLeft: 5, 
               isBatch: true, 
               expiry_date: new Date("2026-02-01"),
               batch_number: "BATCH-1",
               stock: 10,
               unit: "pcs"
           }
       ]);

       await NotificationService.checkExpiredProducts(mockStoreId);
       
       expect(calculateExpiringItems).toHaveBeenCalledWith([mockProduct]);
       
       expect(prisma.notification.create).toHaveBeenCalledWith({
           data: expect.objectContaining({
               type: "EXPIRED",
               productId: "p-exp",
               title: "Hampir Kadaluarsa: Milk",
               message: expect.stringContaining("5 hari"),
           })
       });
    });

    it("should not notify if days left is greater than setting", async () => {
       const mockStore = { id: mockStoreId, expiryNotificationDays: 3 }; // Only warn 3 days before
       (prisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore);
       
       const mockProduct = { id: "p-safe", name: "Honey", storeId: mockStoreId };
       (prisma.product.findMany as jest.Mock).mockResolvedValue([mockProduct]);
       
       // Expiring in 10 days (safe)
       (calculateExpiringItems as jest.Mock).mockReturnValue([
           { ...mockProduct, daysLeft: 10, isBatch: true, stock: 10 }
       ]);

       await NotificationService.checkExpiredProducts(mockStoreId);
       
       expect(prisma.notification.create).not.toHaveBeenCalled();
    });
  });
});
