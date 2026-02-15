import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { validateStoreAccess, hasPermission } from "@/lib/store-access";

/**
 * Middleware untuk melindungi API routes dengan RLS support
 * Memastikan pengguna terautentikasi dan memiliki akses ke store
 */
export function withAuth(
  handler: (req: NextRequest, session: any, storeId: string | null, ...args: any[]) => Promise<NextResponse>,
  options: {
    requiredRoles?: string[];
    requireStore?: boolean;
    requiredPermission?: string;
  } = {}
) {
  return async (req: NextRequest, ...args: any[]) => {
    // Check authentication
    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get storeId from session
    let storeId = session.user.storeId || null;
    
    // Try cookie if session doesn't have storeId
    try {
      const selectedStoreId = req.cookies.get("selectedStoreId")?.value;
      if (!storeId && selectedStoreId) {
        storeId = selectedStoreId;
      }
    } catch (error) {
      console.error("Error accessing cookies:", error);
    }

    // If store is required but not present
    if (options.requireStore && !storeId) {
      return NextResponse.json(
        { error: "Store selection required" },
        { status: 400 }
      );
    }

    // Validate StoreAccess if storeId is present
    if (storeId) {
      const accessResult = await validateStoreAccess(session.user.id, storeId);
      
      if (!accessResult.valid) {
        return NextResponse.json(
          { error: accessResult.error || "Forbidden" },
          { status: 403 }
        );
      }

      // Check role-based permissions
      if (options.requiredPermission && accessResult.role) {
        if (!hasPermission(accessResult.role, options.requiredPermission)) {
          return NextResponse.json(
            { error: "Insufficient permissions" },
            { status: 403 }
          );
        }
      }

      // Legacy role check (for backward compatibility)
      if (options.requiredRoles && options.requiredRoles.length > 0) {
        const userRole = session.user.role?.toLowerCase();
        if (!userRole || !options.requiredRoles.includes(userRole)) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      }
    }

    // Forward to handler with session and storeId
    return handler(req, session, storeId, ...args);
  };
}

/**
 * Helper untuk mengecek akses store (legacy support)
 */
export function hasStoreAccess(
  storeId: string | null | undefined,
  userStoreId: string | null | undefined,
  userRole: string
): boolean {
  if (userRole.toLowerCase() === "admin") {
    return true;
  }
  if (!storeId && userStoreId) {
    return true;
  }
  return storeId === userStoreId;
}

/**
 * Role constants for backward compatibility
 */
export const ROLES = {
  OWNER: 'OWNER',
  CASHIER: 'CASHIER',
};
