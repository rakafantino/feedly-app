
// 1. Mock Prisma
jest.mock('@/lib/prisma', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { mockDeep } = require('jest-mock-extended');
  return {
    __esModule: true,
    default: mockDeep(),
  };
});

// 2. Mock Auth
const mockSession = {
  user: {
    name: 'Test User',
    email: 'test@example.com',
    role: 'OWNER',
    storeId: 'store-123'
  }
};

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(() => Promise.resolve(mockSession)),
}));

import { POST } from './route';
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

describe('POST /api/products', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.$transaction.mockImplementation((callback: any) => callback(prismaMock));
  });

  const validProductData = {
    name: 'Test Product',
    price: 10000,
    stock: 10,
    category: 'General',
    unit: 'pcs'
  };

  it('should create a product successfully', async () => {
    prismaMock.product.findFirst.mockResolvedValue(null); // No duplicates
    prismaMock.product.create.mockResolvedValue({
      id: 'prod-1',
      ...validProductData,
      storeId: 'store-123',
      createdAt: new Date(),
      updatedAt: new Date(),
      isDeleted: false
    } as any);

    const req = new NextRequest('http://localhost:3000/api/products', {
      method: 'POST',
      body: JSON.stringify(validProductData)
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.product).toBeDefined();
    expect(prismaMock.product.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        name: 'Test Product',
        storeId: 'store-123'
      })
    }));
  });

  it('should accept and save hpp_calculation_details', async () => {
    const hppData = [
       { id: '1', name: 'Box', amount: 1000 }
    ];
    const productWithHpp = {
      ...validProductData,
      hpp_calculation_details: hppData
    };

    prismaMock.product.findFirst.mockResolvedValue(null);
    prismaMock.product.create.mockResolvedValue({
      id: 'prod-2',
      ...productWithHpp,
      storeId: 'store-123',
      createdAt: new Date(),
      updatedAt: new Date(),
      isDeleted: false,
      hppCalculationDetails: hppData
    } as any);

    const req = new NextRequest('http://localhost:3000/api/products', {
      method: 'POST',
      body: JSON.stringify(productWithHpp)
    });

    const res = await POST(req);
    // Note: This test expects success ONLY if validation schema is updated. 
    // If schema is not updated, this might return 400 or strip the field. 
    // Since we are mocking the service, we are mostly testing the route handler passing data.
    // However, Zod validation happens BEFORE service call. So this WILL FAIL if Zod schema is not updated.
    
    expect(res.status).toBe(201);
  });

  it('should return 400 if validation fails', async () => {
    const invalidData = {
      name: '', // Empty name
      price: -500 // Negative price
    };

    const req = new NextRequest('http://localhost:3000/api/products', {
      method: 'POST',
      body: JSON.stringify(invalidData)
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe('Validation failed');
  });

  it('should return 400 if barcode is duplicate in same store', async () => {
    const dataWithBarcode = {
      ...validProductData,
      barcode: '123456'
    };

    // Simulate existing product
    prismaMock.product.findFirst.mockResolvedValue({
      id: 'existing-prod',
      barcode: '123456',
      storeId: 'store-123'
    } as any);

    const req = new NextRequest('http://localhost:3000/api/products', {
      method: 'POST',
      body: JSON.stringify(dataWithBarcode)
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toMatch(/Barcode sudah digunakan/);
  });

  it('should return 500 on database error', async () => {
    prismaMock.product.create.mockRejectedValue(new Error('DB Error'));

    const req = new NextRequest('http://localhost:3000/api/products', {
      method: 'POST',
      body: JSON.stringify(validProductData)
    });

    const res = await POST(req);
    
    expect(res.status).toBe(500);
  });
});
