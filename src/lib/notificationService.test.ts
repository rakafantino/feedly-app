/**
 * @jest-environment node
 */
import { 
  checkLowStockProducts, 
  checkDebtDue,
  getStoreNotifications, 
  initializeNotificationService,
  AppNotification
} from './notificationService';

// Mock dependencies
jest.mock('./prisma', () => ({
  __esModule: true,
  default: {
    store: {
      findMany: jest.fn(),
    },
    product: {
      findMany: jest.fn(),
      fields: {
        threshold: 'threshold'
      }
    },
    transaction: {
      findMany: jest.fn(),
    },
  },
  getPrisma: jest.fn().mockImplementation(async () => require('./prisma').default),
}));

// Access mocked prisma
import prisma from './prisma';

describe('Notification Service', () => {
  const mockStoreId = 'store-123';
  const mockDate = new Date('2026-01-25T12:00:00Z');

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(mockDate);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('checkLowStockProducts', () => {
    it('should identify low stock products', async () => {
      (prisma.product.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'prod-1',
          name: 'Low Item',
          stock: 5,
          threshold: 10,
          unit: 'pcs',
          storeId: mockStoreId,
          price: 1000,
        }
      ]);
      // Mock debt check to be empty to isolate stock check
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue([]);

      const result = await checkLowStockProducts(mockStoreId, true);
      expect(result.count).toBe(1);

      const notifications = await getStoreNotifications(mockStoreId);
      expect(notifications).toHaveLength(1);
      
      const notif = notifications[0];
      if (notif.type === 'STOCK') {
        expect(notif.productId).toBe('prod-1');
      } else {
        fail('Expected STOCK notification');
      }
    });
  });

  describe('Debt Notifications', () => {
    it('should identify unpaid transactions past due date', async () => {
      const pastDue = new Date(mockDate);
      pastDue.setDate(pastDue.getDate() - 1); // Yesterday

      (prisma.transaction.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'trans-debt-1',
          invoiceNumber: 'INV/001',
          remainingAmount: 50000,
          amountPaid: 0,
          dueDate: pastDue,
          customer: { name: 'Pak Budi' },
          storeId: mockStoreId,
          createdAt: pastDue
        }
      ]);

      await checkDebtDue(mockStoreId);

      const notifications = await getStoreNotifications(mockStoreId);
      
      const debtNotif = notifications.find((n) => n.type === 'DEBT');
      
      expect(debtNotif).toBeDefined();
      if (debtNotif && debtNotif.type === 'DEBT') {
        expect(debtNotif.transactionId).toBe('trans-debt-1');
        expect(debtNotif.remainingAmount).toBe(50000);
      }
    });

    it('should ignore paid transactions or future due dates', async () => {
      // Mock findMany to return nothing (simulating proper query filtering)
      // In a real integration test, the DB would filter. Here we allow the service code to run.
      // If we want to test logic, we should return items that SHOULD be filtered if logic was in JS,
      // but logic is in Prisma query args usually.
      // Since `checkDebtDue` logic relies on Prisma query `where` clause completely for filtering,
      // unit testing the service mainly tests that it constructs the notification correctly from results.
      // To simulate "ignore", we ensure if Prisma returns empty, no notification is created.
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue([]);

      await checkDebtDue(mockStoreId);

      const notifications = await getStoreNotifications(mockStoreId);
      const debtNotif = notifications.find((n) => n.type === 'DEBT');
      expect(debtNotif).toBeUndefined();
    });
    
    it('should integrate with checkLowStockProducts flow', async () => {
       // When calling checkLowStockProducts, it should also trigger checkDebtDue
       const pastDue = new Date(mockDate);
       pastDue.setDate(pastDue.getDate() - 1);
       
       (prisma.transaction.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'trans-debt-integrated',
          invoiceNumber: 'INV/002',
          remainingAmount: 25000,
          amountPaid: 0,
          dueDate: pastDue,
          customer: { name: 'Bu Ani' },
          storeId: mockStoreId
        }
       ]);
       (prisma.product.findMany as jest.Mock).mockResolvedValue([]); // No stock issues

       await checkLowStockProducts(mockStoreId, true);
       
       const notifications = await getStoreNotifications(mockStoreId);
       const debtNotif = notifications.find((n) => n.type === 'DEBT' && n.id === 'debt-trans-debt-integrated');
       expect(debtNotif).toBeDefined();
    });
  });
});

