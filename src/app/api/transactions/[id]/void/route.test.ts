/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { POST } from './route';
import prisma from '@/lib/prisma';

jest.mock('@/lib/prisma', () => {
  const mockPrisma = {
    transaction: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    product: {
      update: jest.fn(),
    },
    productBatch: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  mockPrisma.$transaction.mockImplementation((callback: any) => callback(mockPrisma));

  return {
    __esModule: true,
    default: mockPrisma,
  };
});

jest.mock('@/lib/api-middleware', () => ({
  withAuth: (handler: any) => async (req: NextRequest) => {
    const session = { user: { id: 'user-1', storeId: 'store-1' } };
    return handler(req, session, 'store-1');
  },
}));

describe('POST /api/transactions/[id]/void', () => {
  const prismaMock = prisma as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function createRequest(transactionId = 'tx-1') {
    return new NextRequest(`http://localhost:3000/api/transactions/${transactionId}/void`, {
      method: 'POST',
    });
  }

  it('restores product stock and creates a void batch for each transaction item', async () => {
    prismaMock.transaction.findFirst.mockResolvedValue({
      id: 'tx-1',
      invoiceNumber: 'INV/20260529/0008',
      status: 'COMPLETED',
      items: [
        {
          productId: 'prod-1234',
          quantity: 1,
          cost_price: 17200,
          product: {
            id: 'prod-1234',
            supplierId: 'supplier-1',
            expiry_date: new Date('2027-05-19T00:00:00.000Z'),
            purchase_price: 17000,
            hpp_price: 17100,
          },
        },
      ],
    });

    const res = await POST(createRequest());

    expect(res.status).toBe(200);
    expect(prismaMock.transaction.update).toHaveBeenCalledWith({
      where: { id: 'tx-1' },
      data: { status: 'VOIDED' },
    });
    expect(prismaMock.productBatch.create).toHaveBeenCalledWith({
      data: {
        productId: 'prod-1234',
        stock: 1,
        batchNumber: 'VOID-INV-20260529-0008-1234',
        purchasePrice: 17200,
        expiryDate: new Date('2027-05-19T00:00:00.000Z'),
        supplierId: 'supplier-1',
        inDate: expect.any(Date),
      },
    });
    expect(prismaMock.product.update).toHaveBeenCalledWith({
      where: { id: 'prod-1234' },
      data: { stock: { increment: 1 } },
    });
  });

  it('rejects already voided transactions before restoring stock', async () => {
    prismaMock.transaction.findFirst.mockResolvedValue({
      id: 'tx-1',
      status: 'VOIDED',
      items: [],
    });

    const res = await POST(createRequest());
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe('Transaction is already voided');
    expect(prismaMock.productBatch.create).not.toHaveBeenCalled();
    expect(prismaMock.product.update).not.toHaveBeenCalled();
  });
});
