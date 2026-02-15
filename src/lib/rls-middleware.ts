import { PrismaClient } from '@prisma/client';
import { auth } from '@/lib/auth';

/**
 * Multi-tenant models that require storeId filtering
 */
const MULTI_TENANT_MODELS = [
  'Transaction',
  'Customer',
  'Product',
  'PurchaseOrder',
  'Expense',
  'StockAdjustment',
  'Notification',
  'Supplier',
  'ProductBatch',
  'PurchaseOrderItem',
  'TransactionItem',
  'DebtPayment',
];

/**
 * Check if a model requires tenant isolation
 */
function requiresTenantIsolation(model: string): boolean {
  return MULTI_TENANT_MODELS.includes(model);
}

/**
 * Get current store ID from session
 */
export async function getCurrentStoreId(): Promise<string | null> {
  try {
    const session = await auth();
    if (!session?.user?.storeId) {
      return null;
    }
    return session.user.storeId;
  } catch (error) {
    console.error('Error getting current store ID:', error);
    return null;
  }
}

/**
 * Get current user ID from session
 */
export async function getCurrentUserId(): Promise<string | null> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return null;
    }
    return session.user.id;
  } catch (error) {
    console.error('Error getting current user ID:', error);
    return null;
  }
}

/**
 * Get current store role from session
 */
export async function getCurrentStoreRole(): Promise<string | null> {
  try {
    const session = await auth();
    return session?.user?.storeRole || null;
  } catch (error) {
    console.error('Error getting current store role:', error);
    return null;
  }
}

/**
 * Prisma Middleware for RLS
 * Automatically adds storeId filter to all queries on multi-tenant tables
 */
export function rlsMiddleware(prisma: PrismaClient): PrismaClient {
  // Skip middleware if $use is not available (e.g., in test mocks)
  if (typeof (prisma as any).$use !== 'function') {
    console.warn('RLS middleware skipped - $use not available');
    return prisma;
  }
  
  // Cast to any to avoid type errors with extended client or newer Prisma versions
  (prisma as any).$use(async (params: any, next: any) => {
    const model = params.model;
    
    // Skip if model doesn't require tenant isolation
    if (!model || !requiresTenantIsolation(model)) {
      return next(params);
    }

    // Get current store ID
    const storeId = await getCurrentStoreId();
    
    // If no store context, check if this is an admin bypass request
    if (!storeId) {
      // Allow bypass if explicitly requested (for admin operations)
      const bypass = params.args?.['__rls_bypass'];
      if (bypass === true) {
        // Remove the bypass flag before executing
        delete params.args['__rls_bypass'];
        return next(params);
      }
      
      // For create operations, validate storeId is provided
      if (params.action === 'create') {
        const providedStoreId = params.args?.data?.storeId;
        if (!providedStoreId) {
          throw new Error('Store ID is required for this operation');
        }
        return next(params);
      }
      
      // For other operations without store context, throw error
      throw new Error('No store context. Please select a store first.');
    }

    // Apply storeId filter to query
    switch (params.action) {
      case 'findMany':
      case 'findFirst':
      case 'findFirstOrThrow':
        // Add storeId to where clause if not present
        if (!params.args.where) {
          params.args.where = { storeId };
        } else if (!params.args.where.storeId) {
          params.args.where = {
            ...params.args.where,
            storeId,
          };
        }
        break;

      case 'update':
      case 'updateMany':
      case 'delete':
      case 'deleteMany':
        // Ensure storeId is in where clause
        if (!params.args.where) {
          params.args.where = { storeId };
        } else if (!params.args.where.storeId) {
          params.args.where = {
            ...params.args.where,
            storeId,
          };
        }
        break;

      case 'create':
        // Force storeId in create data
        if (params.args.data) {
          params.args.data.storeId = storeId;
        }
        break;

      case 'count':
      case 'aggregate':
        // Add storeId to where for aggregate/count
        if (!params.args.where) {
          params.args.where = { storeId };
        } else if (!params.args.where.storeId) {
          params.args.where = {
            ...params.args.where,
            storeId,
          };
        }
        break;
    }

    return next(params);
  });

  return prisma;
}

/**
 * Helper to check if user has permission for an action
 */
export async function hasPermission(
  action: 'create' | 'read' | 'update' | 'delete',
  // resource argument is reserved for future fine-grained permissions
  _resource?: string // eslint-disable-line @typescript-eslint/no-unused-vars
): Promise<boolean> {
  const role = await getCurrentStoreRole();
  
  if (!role) {
    return false;
  }

  const rolePermissions: Record<string, string[]> = {
    OWNER: ['create', 'read', 'update', 'delete'],
    CASHIER: ['create', 'read'], // Cashiers can create transactions and read
  };

  const permissions = rolePermissions[role.toUpperCase()] || [];
  return permissions.includes(action);
}

/**
 * Validate store access helper
 */
export async function validateStoreAccess(
  storeId: string,
  userId: string
): Promise<boolean> {
  try {
    const { default: prisma } = await import('@/lib/prisma');
    
    // Note: Use 'accesses' relation from previous fix
    const access = await prisma.user.findUnique({
      where: { id: userId },
      select: {
          accesses: {
              where: { storeId: storeId }
          }
      }
    });

    return !!(access?.accesses && access.accesses.length > 0);
  } catch (error) {
    console.error('Error validating store access:', error);
    return false;
  }
}

export default rlsMiddleware;
