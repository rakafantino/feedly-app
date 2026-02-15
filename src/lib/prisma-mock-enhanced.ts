/**
 * Enhanced Prisma mock for RLS testing
 * Includes $use middleware support
 */

import { jest } from '@jest/globals';

// Create a mock Prisma client with all required methods
const createMockPrisma = () => {
  const mockClient: any = {};

  // Initialize all model namespaces
  const models = [
    'transaction', 'transactionItem', 'product', 'productBatch',
    'customer', 'supplier', 'purchaseOrder', 'purchaseOrderItem',
    'expense', 'stockAdjustment', 'notification', 'user',
    'store', 'storeAccess'
  ];

  models.forEach(model => {
    mockClient[model] = {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
      upsert: jest.fn(),
    };
  });

  // Transaction mock
  mockClient.$transaction = jest.fn((callback: any) => callback(mockClient));

  // $use middleware support
  mockClient.$use = jest.fn();

  return mockClient;
};

// Create the mock
const mockPrisma = createMockPrisma();

// Export for Jest mocking
export const prismaMock = mockPrisma;

// Default mock factory for jest.mock
export const prismaMockFactory = {
  __esModule: true,
  default: mockPrisma,
};

// Helper to reset mocks
export const resetPrismaMocks = () => {
  const newMock = createMockPrisma();
  Object.assign(mockPrisma, newMock);
};
