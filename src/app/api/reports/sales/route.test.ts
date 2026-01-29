import { GET } from './route';
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';

// Mock dependencies
jest.mock('@/lib/prisma', () => ({
  transaction: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
}));

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}));

// Helper to generate mock transactions
const createMockTransaction = (id: string, total: number, costPrice: number, discount = 0, paymentStatus = 'UNPAID', amountPaid = 0) => ({
  id,
  total,
  discount,
  paymentStatus,
  amountPaid,
  createdAt: new Date(),
  invoiceNumber: `INV/${id}`,
  paymentMethod: 'CASH',
  customer: { name: `Customer ${id}` },
  items: [
    {
      quantity: 1,
      price: total,
      cost_price: costPrice,
      product: { purchase_price: costPrice }
    }
  ]
});

describe('GET /api/reports/sales', () => {
  const mockStoreId = 'store-123';

  beforeEach(() => {
    jest.clearAllMocks();
    (auth as jest.Mock).mockResolvedValue({ user: { storeId: mockStoreId } });
  });

  describe('Pagination', () => {
    it('should return paginated transactions with default limit of 10', async () => {
      // Create 15 mock transactions
      const allTransactions = Array.from({ length: 15 }, (_, i) => 
        createMockTransaction(`tx-${i + 1}`, 10000, 5000)
      );
      
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue(allTransactions);
      (prisma.transaction.count as jest.Mock).mockResolvedValue(15);

      const req = new NextRequest('http://localhost:3000/api/reports/sales');
      const response = await GET(req);
      const data = await response.json();

      // Should return pagination info
      expect(data.pagination).toBeDefined();
      expect(data.pagination.total).toBe(15);
      expect(data.pagination.page).toBe(1);
      expect(data.pagination.limit).toBe(10);
      expect(data.pagination.totalPages).toBe(2);
      
      // Should return only 10 transactions
      expect(data.transactions).toHaveLength(10);
    });

    it('should return correct page when page param is provided', async () => {
      // Create 15 transactions
      const allTransactions = Array.from({ length: 15 }, (_, i) => 
        createMockTransaction(`tx-${i + 1}`, 10000, 5000)
      );
      
      // API now fetches ALL transactions and slices in code, so mock returns all
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue(allTransactions);
      (prisma.transaction.count as jest.Mock).mockResolvedValue(15);

      const req = new NextRequest('http://localhost:3000/api/reports/sales?page=2');
      const response = await GET(req);
      const data = await response.json();

      expect(data.pagination.page).toBe(2);
      expect(data.pagination.totalPages).toBe(2);
      // Page 2 should have 5 items (items 11-15)
      expect(data.transactions).toHaveLength(5);
    });

    it('should respect custom limit parameter', async () => {
      const allTransactions = Array.from({ length: 30 }, (_, i) => 
        createMockTransaction(`tx-${i + 1}`, 10000, 5000)
      );
      
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue(allTransactions.slice(0, 25));
      (prisma.transaction.count as jest.Mock).mockResolvedValue(30);

      const req = new NextRequest('http://localhost:3000/api/reports/sales?limit=25');
      const response = await GET(req);
      const data = await response.json();

      expect(data.pagination.limit).toBe(25);
      expect(data.pagination.totalPages).toBe(2);
      expect(data.transactions).toHaveLength(25);
    });

    it('should calculate summary from ALL transactions regardless of pagination', async () => {
      // Create 15 transactions with varying totals
      const allTransactions = Array.from({ length: 15 }, (_, i) => 
        createMockTransaction(`tx-${i + 1}`, (i + 1) * 10000, (i + 1) * 5000)
      );
      
      // Total revenue: 10k + 20k + ... + 150k = 1,200,000
      // Total cost: 5k + 10k + ... + 75k = 600,000
      // Total profit: 600,000
      
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue(allTransactions);
      (prisma.transaction.count as jest.Mock).mockResolvedValue(15);

      const req = new NextRequest('http://localhost:3000/api/reports/sales?page=1&limit=5');
      const response = await GET(req);
      const data = await response.json();

      // Summary should be calculated from ALL 15 transactions
      expect(data.summary.totalTransactions).toBe(15);
      expect(data.summary.totalRevenue).toBe(1200000);
      expect(data.summary.totalCost).toBe(600000);
      expect(data.summary.totalProfit).toBe(600000);
      
      // But only 5 transactions returned in the list
      expect(data.transactions).toHaveLength(5);
    });
  });

  it('should calculate profit and margin correctly', async () => {
    // Setup Mock Data
    const mockTransactions = [
      {
        id: 'tx-1',
        total: 100000,
        discount: 5000, // Add discount
        paymentStatus: 'UNPAID',
        amountPaid: 0,
        createdAt: new Date(),
        invoiceNumber: 'INV/001',
        paymentMethod: 'CASH',
        customer: { name: 'Customer A' },
        items: [
          {
            quantity: 2,
            price: 52500, // Gross Price (approx 105k total / 2) - irrelevant for cost calculation
            cost_price: 30000, // Bought at 30k
            product: { purchase_price: 30000 }
          }
        ]
      },
      {
        id: 'tx-2',
        total: 200000,
        discount: 0,
        paymentStatus: 'UNPAID',
        amountPaid: 0,
        createdAt: new Date(),
        invoiceNumber: 'INV/002',
        paymentMethod: 'QRIS',
        customer: { name: 'Customer B' },
        items: [
          {
            quantity: 1,
            price: 200000, // Sold at 200k
            cost_price: null, // Test fallback
            product: { purchase_price: 150000 } // Should use this fallback
          }
        ]
      }
    ];

    (prisma.transaction.findMany as jest.Mock).mockResolvedValue(mockTransactions);
    (prisma.transaction.count as jest.Mock).mockResolvedValue(2);

    // Create Request
    const req = new NextRequest('http://localhost:3000/api/reports/sales');

    // Execute
    const response = await GET(req);
    const data = await response.json();

    // Verify Summary
    // Transaction 1: Rev 100k (Net), Discount 5k. Cost 60k (2*30k). Profit 40k.
    // Transaction 2: Rev 200k (Net), Discount 0. Cost 150k. Profit 50k.
    // Total: Rev 300k, Discount 5k, Cost 210k, Profit 90k.
    // Margin: (90k / 300k) * 100 = 30%

    expect(data.summary).toEqual({
      totalTransactions: 2,
      totalRevenue: 300000,
      totalDiscount: 5000,
      totalCost: 210000,
      totalProfit: 90000,
      grossMargin: 30,
      totalCashReceived: 0,
      totalUnpaid: 300000
    });

    // Verify List
    expect(data.transactions).toHaveLength(2);
    expect(data.transactions[0].profit).toBe(40000); // 100k - 60k
    expect(data.transactions[1].profit).toBe(50000); // 200k - 150k
  });
});
