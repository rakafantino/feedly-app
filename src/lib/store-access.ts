import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

/**
 * Role-based permissions
 */
export enum RolePermissions {
  OWNER = 'OWNER',
  CASHIER = 'CASHIER',
}

const PERMISSIONS = {
  [RolePermissions.OWNER]: ['create', 'read', 'update', 'delete', 'manage_users', 'view_reports'],
  [RolePermissions.CASHIER]: ['create', 'read'], // Cashiers can only create/read transactions
};

/**
 * Check if user has specific permission
 */
export function hasPermission(storeRole: string, requiredPermission: string): boolean {
  const permissions = PERMISSIONS[storeRole.toUpperCase() as keyof typeof PERMISSIONS] || [];
  return permissions.includes(requiredPermission);
}

/**
 * Validate store access and permissions
 */
export async function validateStoreAccess(
  userId: string,
  storeId: string
): Promise<{ valid: boolean; role?: string; error?: string }> {
  try {
    const access = await prisma.storeAccess.findUnique({
      where: {
        userId_storeId: {
          userId,
          storeId,
        },
      },
    });

    if (!access) {
      return { valid: false, error: 'No access to this store' };
    }

    return { valid: true, role: access.role };
  } catch (error) {
    console.error('Error validating store access:', error);
    return { valid: false, error: 'Failed to validate access' };
  }
}

/**
 * Middleware factory for store access validation
 */
export function withStoreAccess(requiredPermission?: string) {
  return async function (
    req: NextRequest,
    handler: (req: NextRequest) => Promise<NextResponse>
  ): Promise<NextResponse> {
    // Get session
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get storeId from query params, body, or headers
    const { searchParams } = new URL(req.url);
    const storeIdFromQuery = searchParams.get('storeId');
    const storeIdFromHeader = req.headers.get('x-store-id');
    
    // For POST/PUT requests, check body
    let storeIdFromBody: string | null = null;
    if (req.method === 'POST' || req.method === 'PUT') {
      try {
        const body = await req.json();
        storeIdFromBody = body.storeId || body.store_id || null;
      } catch {
        // Ignore JSON parse errors
      }
    }

    const storeId = storeIdFromQuery || storeIdFromHeader || storeIdFromBody;

    if (!storeId) {
      return NextResponse.json(
        { error: 'Store ID is required' },
        { status: 400 }
      );
    }

    // Validate store access
    const accessResult = await validateStoreAccess(session.user.id, storeId);
    
    if (!accessResult.valid) {
      return NextResponse.json(
        { error: accessResult.error },
        { status: 403 }
      );
    }

    // Check permission if required
    if (requiredPermission && accessResult.role) {
      if (!hasPermission(accessResult.role, requiredPermission)) {
        return NextResponse.json(
          { error: 'Insufficient permissions' },
          { status: 403 }
        );
      }
    }

    // Attach store context to request for handler use
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-store-id', storeId);
    requestHeaders.set('x-user-id', session.user.id);
    requestHeaders.set('x-store-role', accessResult.role || '');

    // Clone request with updated headers
    const clonedReq = new NextRequest(req.url, {
      method: req.method,
      headers: requestHeaders,
      body: req.body,
      duplex: 'half',
    });

    return handler(clonedReq);
  };
}

/**
 * Helper to get store context from request
 */
export function getStoreContext(req: NextRequest) {
  return {
    storeId: req.headers.get('x-store-id'),
    userId: req.headers.get('x-user-id'),
    storeRole: req.headers.get('x-store-role'),
  };
}
