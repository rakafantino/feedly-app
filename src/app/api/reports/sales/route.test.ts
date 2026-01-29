import { GET } from './route';
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';

// Mock dependencies
jest.mock('@/lib/prisma', () => ({
  transaction: {
    findMany: jest.fn(),
  },
}));

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}));

describe('GET /api/reports/sales', () => {
  const mockStoreId = 'store-123';

  beforeEach(() => {
    jest.clearAllMocks();
    (auth as jest.Mock).mockResolvedValue({ user: { storeId: mockStoreId } });
  });

  it('should calculate profit and margin correctly', async () => {
    // Setup Mock Data
    const mockTransactions = [
      {
        id: 'tx-1',
        total: 100000,
        discount: 5000, // Add discount
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
