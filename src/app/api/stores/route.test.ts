/**
 * @jest-environment node
 */
import { GET as listStores } from './list/route';
import { POST as createStore } from './create/route';
import { POST as switchStore } from '../auth/switch-store/route';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { NextRequest } from 'next/server';

// Mock dependencies
jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/prisma', () => {
  const mockPrisma = {
    storeAccess: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    store: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  // Implement transaction to call callback with self
  mockPrisma.$transaction.mockImplementation((callback) => callback(mockPrisma));

  return {
    __esModule: true,
    default: mockPrisma,
  };
});

describe('Store APIs', () => {
  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    role: 'OWNER',
    storeId: 'store-1',
  };

  // Helper to get typed prisma mock
  const prismaMock = prisma as any;

  const mockSession = {
    user: mockUser,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (auth as jest.Mock).mockResolvedValue(mockSession);
  });

  describe('GET /api/stores/list', () => {
    it('should return list of stores for authenticated user', async () => {
      const mockAccesses = [
        { store: { id: 'store-1', name: 'Store 1', address: 'Addr 1', phone: '123' }, role: 'OWNER' },
        { store: { id: 'store-2', name: 'Store 2', address: 'Addr 2', phone: '456' }, role: 'CASHIER' },
      ];

      (prismaMock.storeAccess.findMany as jest.Mock).mockResolvedValue(mockAccesses);
      // Mock existing access check for self-healing
      (prismaMock.storeAccess.findUnique as jest.Mock).mockResolvedValue({ id: 'access-1' });

      const res = await listStores();
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.data).toHaveLength(2);
      expect(data.data[0].role).toBe('OWNER');
    });

    it('should return 401 if not authenticated', async () => {
      (auth as jest.Mock).mockResolvedValue(null);
      const res = await listStores();
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/stores/create', () => {
    it('should create a new store and assign owner access', async () => {
      const newStoreData = {
        name: 'New Store',
        description: 'Desc',
        address: 'Addr',
        phone: '08123456789',
      };

      const createdStore = { id: 'store-new', ...newStoreData };

      (prismaMock.store.create as jest.Mock).mockResolvedValue(createdStore);
      (prismaMock.storeAccess.create as jest.Mock).mockResolvedValue({ id: 'access-new' });
      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prismaMock.user.update as jest.Mock).mockResolvedValue({ ...mockUser, storeId: 'store-new' });

      const req = new NextRequest('http://localhost:3000/api/stores/create', {
        method: 'POST',
        body: JSON.stringify(newStoreData),
      });
      const res = await createStore(req);
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(createdStore);

      // Verify transaction steps
      expect(prismaMock.store.create).toHaveBeenCalled();
      expect(prismaMock.storeAccess.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ userId: mockUser.id, role: 'OWNER' })
      }));
      expect(prismaMock.user.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: mockUser.id },
        data: { storeId: createdStore.id }
      }));
    });

    it('should return 400 for validation error', async () => {
      const req = new NextRequest('http://localhost:3000/api/stores/create', {
        method: 'POST',
        body: JSON.stringify({ name: '' }), // Invalid data
      });
      const res = await createStore(req);
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/switch-store', () => {
    it('should switch active store if user has access', async () => {
      const targetStoreId = 'store-2';

      // Mock user access check
      (prismaMock.storeAccess.findUnique as jest.Mock).mockResolvedValue({
        userId: mockUser.id,
        storeId: targetStoreId,
        role: 'CASHIER',
        store: { name: 'Target Store' }
      });

      const req = new NextRequest('http://localhost:3000/api/auth/switch-store', {
        method: 'POST',
        body: JSON.stringify({ storeId: targetStoreId }),
      });

      const res = await switchStore(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(prismaMock.user.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: mockUser.id },
        data: { storeId: targetStoreId, role: 'CASHIER' }
      }));
    });

    it('should return 403 if user has no access to target store', async () => {
      const targetStoreId = 'store-forbidden';

      (prismaMock.storeAccess.findUnique as jest.Mock).mockResolvedValue(null);

      const req = new NextRequest('http://localhost:3000/api/auth/switch-store', {
        method: 'POST',
        body: JSON.stringify({ storeId: targetStoreId }),
      });

      const res = await switchStore(req);
      expect(res.status).toBe(403);
    });
  });
});
