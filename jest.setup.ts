import '@testing-library/jest-dom'

// Enhanced Prisma mock with $use middleware support
import { prismaMockFactory } from '@/lib/prisma-mock-enhanced';

jest.mock('@/lib/prisma', () => prismaMockFactory);

// Store-access mock
jest.mock('@/lib/store-access', () => ({
  validateStoreAccess: jest.fn().mockResolvedValue({ valid: true, role: 'OWNER' }),
  hasPermission: jest.fn().mockReturnValue(true),
  getStoreContext: jest.fn().mockReturnValue({ storeId: 'test-store', userId: 'test-user', storeRole: 'OWNER' }),
  RolePermissions: {
    OWNER: 'OWNER',
    CASHIER: 'CASHIER',
  },
}))
