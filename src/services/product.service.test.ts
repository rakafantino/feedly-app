import prisma from '@/lib/prisma';
import { ProductService } from './product.service';
import { DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

// Mock dependencies
jest.mock('@/lib/prisma', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { mockDeep } = require('jest-mock-extended');
  return {
    __esModule: true,
    default: mockDeep(),
  };
});

// Remove unused mock for BatchService if not needed, or keep if intended for future
jest.mock('./batch.service');

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

describe('ProductService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Setup transaction mock
    prismaMock.$transaction.mockImplementation((callback: any) => callback(prismaMock));
  });

  describe('createProduct', () => {
    const validProductData = {
      name: 'Test Product',
      category: 'General',
      price: 10000,
      stock: 10,
      unit: 'pcs'
    };
    const storeId = 'store-123';

    it('should create product with hpp_calculation_details', async () => {
      const hppDetails = [
        { id: '1', name: 'Packaging', amount: 500 },
        { id: '2', name: 'Transport', amount: 200 }
      ];

      const productData = {
        ...validProductData,
        hpp_calculation_details: hppDetails
      };

      prismaMock.product.findFirst.mockResolvedValue(null); // No duplicate barcode
      prismaMock.product.findUnique.mockResolvedValue(null); // No duplicate SKU
      
      prismaMock.product.create.mockResolvedValue({
        id: 'prod-1',
        ...productData,
        storeId,
        createdAt: new Date(),
        updatedAt: new Date(),
        isDeleted: false,
        hppCalculationDetails: hppDetails
      } as any);

      await ProductService.createProduct(storeId, productData as any);

      expect(prismaMock.product.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          hppCalculationDetails: hppDetails
        })
      }));
    });

    it('should handle missing hpp_calculation_details gracefully', async () => {
        prismaMock.product.findFirst.mockResolvedValue(null);
        prismaMock.product.findUnique.mockResolvedValue(null);
        
        prismaMock.product.create.mockResolvedValue({
          id: 'prod-1',
          ...validProductData,
          storeId,
          createdAt: new Date(),
          updatedAt: new Date(),
          isDeleted: false,
          hppCalculationDetails: null
        } as any);
  
        await ProductService.createProduct(storeId, validProductData);
  
        expect(prismaMock.product.create).toHaveBeenCalledWith(expect.objectContaining({
          data: expect.not.objectContaining({
            hppCalculationDetails: expect.anything()
          })
        }));
      });
  });
});
