/**
 * Re-export the raw Prisma Client.
 *
 * Previously this file wrapped every Prisma query in auth() + $transaction + set_tenant_context(),
 * which caused ~5 extra DB round-trips per query.
 *
 * RLS context is now set ONCE per request in api-middleware.ts (withAuth),
 * so the raw client is sufficient here.
 */
export { default } from "@/lib/db";
export type { PrismaClient } from "@prisma/client";
