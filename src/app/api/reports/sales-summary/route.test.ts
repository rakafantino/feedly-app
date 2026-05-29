import { GET } from './route';
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';

jest.mock('@/lib/prisma', () => ({
  transaction: {
    findMany: jest.fn(),
  },
}));

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}));

describe('GET /api/reports/sales-summary', () => {
  const mockStoreId = 'store-123';
  const prismaMock = prisma as unknown as {
    transaction: {
      findMany: jest.Mock;
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (auth as jest.Mock).mockResolvedValue({ user: { storeId: mockStoreId } });
  });

  it('should only fetch completed transactions for POS daily summary', async () => {
    prismaMock.transaction.findMany.mockResolvedValue([
      {
        id: 'tx-1',
        invoiceNumber: 'INV/20260529/0001',
        total: 100000,
        amountPaid: 100000,
        paymentMethod: 'CASH',
        createdAt: new Date('2026-05-29T08:00:00.000Z'),
        items: [
          {
            id: 'item-1',
            quantity: 2,
            price: 50000,
            product: { id: 'product-1', name: 'Pakan A' },
          },
        ],
      },
    ]);

    const req = new NextRequest('http://localhost:3000/api/reports/sales-summary?startDate=2026-05-29&endDate=2026-05-29');
    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.totalRevenue).toBe(100000);
    expect(data.transactionCount).toBe(1);
    expect(prismaMock.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          storeId: mockStoreId,
          status: 'COMPLETED',
        }),
      }),
    );
  });
});
