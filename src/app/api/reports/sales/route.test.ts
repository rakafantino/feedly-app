import { GET } from './route';
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';

// Mock dependencies
jest.mock('@/lib/prisma', () => ({
  transaction: {
    findMany: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
  },
  $queryRaw: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}));

type PaymentStatus = 'PAID' | 'UNPAID' | 'PARTIAL' | 'WRITTEN_OFF';

type MockTransactionItem = {
  quantity: number;
  price: number;
  cost_price: number | null;
  product: { purchase_price: number | null };
};

type MockTransaction = {
  id: string;
  total: number;
  discount: number;
  paymentStatus: PaymentStatus;
  amountPaid: number;
  createdAt: Date;
  invoiceNumber: string;
  paymentMethod: string;
  customer: { name: string } | null;
  items: MockTransactionItem[];
};

type LegacySummary = {
  totalRevenue: number;
  totalDiscount: number;
  totalCost: number;
  totalProfit: number;
  grossMargin: number;
  totalCashReceived: number;
  totalUnpaid: number;
};

type PrismaMock = {
  transaction: {
    findMany: jest.Mock;
    count: jest.Mock;
    aggregate: jest.Mock;
  };
  $queryRaw: jest.Mock;
};

// Helper to generate mock transactions
const createMockTransaction = (
  id: string,
  total: number,
  costPrice: number,
  discount = 0,
  paymentStatus: PaymentStatus = 'UNPAID',
  amountPaid = 0,
): MockTransaction => ({
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
    { quantity: 1, price: total, cost_price: costPrice, product: { purchase_price: costPrice } },
  ]
});

const calculateLegacySummary = (transactions: MockTransaction[]): LegacySummary => {
  let totalRevenue = 0;
  let totalDiscount = 0;
  let totalCost = 0;
  let totalCashReceived = 0;
  let totalUnpaid = 0;

  transactions.forEach((tx) => {
    const txCost = tx.items.reduce((sum, item) => {
      const unitCost = item.cost_price ?? item.product.purchase_price ?? item.price * 0.7;
      return sum + unitCost * item.quantity;
    }, 0);

    const cashIn = tx.amountPaid > 0 ? tx.amountPaid : tx.paymentStatus === 'PAID' ? tx.total : 0;
    const unpaid = tx.paymentStatus !== 'WRITTEN_OFF' ? tx.total - tx.amountPaid : 0;

    totalRevenue += tx.total;
    totalDiscount += tx.discount;
    totalCost += txCost;
    totalCashReceived += cashIn;
    totalUnpaid += unpaid;
  });

  const totalProfit = totalRevenue - totalCost;
  const grossMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  return {
    totalRevenue,
    totalDiscount,
    totalCost,
    totalProfit,
    grossMargin,
    totalCashReceived,
    totalUnpaid,
  };
};

describe('GET /api/reports/sales', () => {
  const mockStoreId = 'store-123';
  const prismaMock = prisma as unknown as PrismaMock;

  beforeEach(() => {
    jest.clearAllMocks();
    (auth as jest.Mock).mockResolvedValue({ user: { storeId: mockStoreId } });
  });

  it('should return paginated transactions with default limit and DB-level pagination', async () => {
    const pageRows = Array.from({ length: 10 }, (_, i) =>
      createMockTransaction(`tx-${i + 1}`, 10000, 5000),
    );
    prismaMock.transaction.findMany.mockResolvedValue(pageRows);
    prismaMock.transaction.count.mockResolvedValue(15);
    prismaMock.transaction.aggregate.mockResolvedValue({
      _sum: { total: 150000, discount: 0 },
    });
    prismaMock.$queryRaw
      .mockResolvedValueOnce([{ totalCashReceived: 150000, totalUnpaid: 0 }])
      .mockResolvedValueOnce([{ totalCost: 75000 }]);

    const req = new NextRequest('http://localhost:3000/api/reports/sales');
    const response = await GET(req);
    const data = await response.json();

    expect(data.pagination).toEqual({
      total: 15,
      page: 1,
      limit: 10,
      totalPages: 2,
    });
    expect(data.transactions).toHaveLength(10);
    expect(prismaMock.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 10,
      }),
    );
  });

  it('should return correct page and custom limit values', async () => {
    const pageRows = Array.from({ length: 5 }, (_, i) =>
      createMockTransaction(`tx-${i + 11}`, 10000, 5000),
    );
    prismaMock.transaction.findMany.mockResolvedValue(pageRows);
    prismaMock.transaction.count.mockResolvedValue(15);
    prismaMock.transaction.aggregate.mockResolvedValue({
      _sum: { total: 150000, discount: 0 },
    });
    prismaMock.$queryRaw
      .mockResolvedValueOnce([{ totalCashReceived: 150000, totalUnpaid: 0 }])
      .mockResolvedValueOnce([{ totalCost: 75000 }]);

    const req = new NextRequest('http://localhost:3000/api/reports/sales?page=2&limit=10');
    const response = await GET(req);
    const data = await response.json();

    expect(data.pagination.page).toBe(2);
    expect(data.pagination.limit).toBe(10);
    expect(data.pagination.totalPages).toBe(2);
    expect(data.transactions).toHaveLength(5);
    expect(prismaMock.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
      }),
    );
  });

  it('should preserve legacy summary parity while avoiding fetch-all', async () => {
    const allTransactions: MockTransaction[] = [
      createMockTransaction('tx-1', 100000, 60000, 5000, 'PAID', 0),
      createMockTransaction('tx-2', 200000, 150000, 0, 'PARTIAL', 120000),
      createMockTransaction('tx-3', 75000, 50000, 0, 'UNPAID', 0),
      createMockTransaction('tx-4', 50000, 30000, 0, 'WRITTEN_OFF', 10000),
    ];
    const expected = calculateLegacySummary(allTransactions);
    const pageRows = allTransactions.slice(0, 2);

    prismaMock.transaction.findMany.mockResolvedValue(pageRows);
    prismaMock.transaction.count.mockResolvedValue(allTransactions.length);
    prismaMock.transaction.aggregate.mockResolvedValue({
      _sum: {
        total: expected.totalRevenue,
        discount: expected.totalDiscount,
      },
    });
    prismaMock.$queryRaw
      .mockResolvedValueOnce([
        {
          totalCashReceived: expected.totalCashReceived,
          totalUnpaid: expected.totalUnpaid,
        },
      ])
      .mockResolvedValueOnce([{ totalCost: expected.totalCost }]);

    const req = new NextRequest('http://localhost:3000/api/reports/sales?page=1&limit=2');
    const response = await GET(req);
    const data = await response.json();

    expect(data.summary).toEqual({
      totalTransactions: allTransactions.length,
      totalRevenue: expected.totalRevenue,
      totalDiscount: expected.totalDiscount,
      totalCost: expected.totalCost,
      totalProfit: expected.totalProfit,
      grossMargin: expected.grossMargin,
      totalCashReceived: expected.totalCashReceived,
      totalUnpaid: expected.totalUnpaid,
    });
    expect(data.transactions).toHaveLength(2);
    expect(data.transactions[0]).toMatchObject({
      id: 'tx-1',
      customerName: 'Customer tx-1',
      cost: 60000,
      profit: 40000,
      marginPercent: 40,
    });
    expect(data.transactions[1]).toMatchObject({
      id: 'tx-2',
      customerName: 'Customer tx-2',
      cost: 150000,
      profit: 50000,
      marginPercent: 25,
    });
  });
});
