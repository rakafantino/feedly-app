/**
 * Jest setup for RLS testing
 * Mocks the store-access module for testing
 */

import { jest } from '@jest/globals';

// Mock store-access module
jest.mock('@/lib/store-access', () => ({
  validateStoreAccess: jest.fn(),
  hasPermission: jest.fn(),
  getStoreContext: jest.fn(),
  RolePermissions: {
    OWNER: 'OWNER',
    CASHIER: 'CASHIER',
  },
}));

// Mock next-auth
jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));
