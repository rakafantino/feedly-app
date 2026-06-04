
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

import { BatchService } from '@/services/batch.service';

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(() => Promise.resolve({
    user: { id: 'user-123', email: 'test@example.com' },
    expires: new Date().toISOString()
  })),
}));

// Re-add store access mock
jest.mock('@/lib/store-access', () => ({
  validateStoreAccess: jest.fn().mockResolvedValue({ valid: true, role: 'OWNER' }),
}));
jest.mock('@/services/batch.service', () => ({
  BatchService: {
    addBatch: jest.fn(),
  }
}));

import { POST } from './route';
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;



import { GET } from './route';

// Helper to create mocked requests with store-id
const createMockReq = (url: string, method: string = 'GET', body?: any) => {
  return {
    url,
    method,
    json: body ? jest.fn().mockResolvedValue(body) : undefined,
    cookies: {
      get: jest.fn().mockReturnValue({ value: "store-123" })
    }
  } as unknown as NextRequest;
};

describe('GET /api/products', () => {
  beforeEach(() => {
    // Setup default mock returns for GET specifically
    (prismaMock.product.findMany as jest.Mock).mockResolvedValue([
      { id: 'prod-1', name: 'Product 1', storeId: 'store-123' }
    ]);
    (prismaMock.product.count as jest.Mock).mockResolvedValue(1);
  });
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should filter out retail products when excludeRetail is true', async () => {
    // We are mocking the route handler which calls ProductService.
    // However, ProductService is NOT mocked in this test file, so it calls the real ProductService (or we need to mock it).
    // The current test file mocks 'prisma' but imports 'GET' from route.
    // The route imports 'ProductService'.
    // Since 'ProductService' is not mocked at the top, it uses the real class which uses the mocked prisma.
    // So we just need to expect the correct prisma call.

    const req = createMockReq('http://localhost:3000/api/products?excludeRetail=true');
    await GET(req);

    // Verify Prisma was called with correct filter
    expect(prismaMock.product.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        convertedFrom: { none: {} } // This is how we filter retail items (items that are NOT converted from anything? No wait.)
        // Retail items ARE converted from others.
        // If 'convertedFrom' relation exists, it means this product IS a parent of others.
        // Wait, let's check schema.
        // Product:
        // conversionTargetId String? @map("conversion_target_id")
        // conversionTarget Product? @relation(...)
        // convertedFrom Product[] @relation(...)
        //
        // If I am a retail product (child), I am the target of a conversion.
        // So 'convertedFrom' (the reverse relation) would be non-empty?
        // No.
        // Parent (Sack) -> acts as source -> 'conversionTargetId' points to Child (Retail).
        // Child (Retail) -> acts as target -> 'convertedFrom' points back to Parent.
        //
        // So a Retail Product has 'convertedFrom' referencing the Parent.
        // A Parent Product has 'conversionTargetId' referencing the Child.
        //
        // So to exclude retail products, we want products where `convertedFrom` is EMPTY.
        // Wait, if I am a child, I am "converted from" the parent.
        // So `convertedFrom` (the array of products that convert INTO me?)
        // Let's re-read schema.
        // conversionTarget Product? @relation("ProductConversion", fields: [conversionTargetId], references: [id])
        // convertedFrom Product[] @relation("ProductConversion")
        //
        // If Product A has conversionTargetId = Product B.
        // Product A converts INTO Product B.
        // Product A is the Parent (Sack). Product B is the Child (Retail).
        //
        // Product B.convertedFrom includes Product A.
        // So if I want to exclude Retail Products (like Product B),
        // I want products that do NOT have any 'convertedFrom' relations?
        // Actually, if Product B is the retail unit, it is the RESULT of opening a sack.
        // So Product A (Sack) -> opens into -> Product B (Ecer).
        //
        // If I want to list products for PO, I want to buy Sacks (Product A).
        // I do NOT want to buy Ecer (Product B) directly (usually).
        // Product B has `convertedFrom` pointing to Product A.
        // So if `excludeRetail` is true, we want to exclude products that allow `convertedFrom` to be non-empty.
        //
        // Prisma: `convertedFrom: { none: {} }` means "No products convert TO this product."
        // If I am Product B (Retail), Product A (Sack) converts TO me. So `convertedFrom` is NOT empty.
        // So `convertedFrom: { none: {} }` will select products that are NOT targets of conversion.
        // i.e. It will select Parent products (Sacks) and independent products.
        // It will EXCLUDE Retail products. Correct.
      })
    }));
  });
});

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
    (prismaMock.product.findFirst as jest.Mock).mockResolvedValue(null); // No duplicates
    (prismaMock.product.create as jest.Mock).mockResolvedValue({
      id: 'prod-1',
      ...validProductData,
      storeId: 'store-123',
      createdAt: new Date(),
      updatedAt: new Date(),
      isDeleted: false
    } as any);

    // Mock for batch and price history in product.service.ts
    (BatchService.addBatch as jest.Mock).mockResolvedValue({ id: 'batch-1' });
    (prismaMock.priceHistory.create as jest.Mock).mockResolvedValue({ id: 'ph-1' });

    const req = createMockReq('http://localhost:3000/api/products', 'POST', validProductData);

    const res = await POST(req, { params: {} }, 'store-123');
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

    (prismaMock.product.findFirst as jest.Mock).mockResolvedValue(null);
    (prismaMock.product.create as jest.Mock).mockResolvedValue({
      id: 'prod-2',
      ...validProductData,
      hppCalculationDetails: { component: 100 },
      storeId: 'store-123',
      createdAt: new Date(),
      updatedAt: new Date(),
      isDeleted: false
    } as any);

    // Mock for batch and price history in product.service.ts
    (BatchService.addBatch as jest.Mock).mockResolvedValue({ id: 'batch-2' });
    (prismaMock.priceHistory.create as jest.Mock).mockResolvedValue({ id: 'ph-2' });

    const req = createMockReq('http://localhost:3000/api/products', 'POST', productWithHpp);

    const res = await POST(req, { params: {} }, 'store-123');
    // Note: This test expects success ONLY if validation schema is updated. 
    // If schema is not updated, this might return 400 or strip the field. 
    // Since we are mocking the service, we are mostly testing the route handler passing data.
    // However, Zod validation happens BEFORE service call. So this WILL FAIL if Zod schema is not updated.
    
    expect(res.status).toBe(201);
  });

  it('should return 400 if validation fails', async () => {
    const invalidData = {
      name: '', // Empty name should fail validation
      price: -500 // Negative price
    };

    const req = createMockReq('http://localhost:3000/api/products', 'POST', invalidData);

    const res = await POST(req, { params: {} }, 'store-123');
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

    const req = createMockReq('http://localhost:3000/api/products', 'POST', dataWithBarcode);

    const res = await POST(req, { params: {} }, 'store-123');
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toMatch(/Barcode sudah digunakan/);
  });

  it('should return 500 on database error', async () => {
    prismaMock.product.create.mockRejectedValue(new Error('DB Error'));

    const req = createMockReq('http://localhost:3000/api/products', 'POST', validProductData);

    const res = await POST(req, { params: {} }, 'store-123');
    
    expect(res.status).toBe(500);
  });
});
