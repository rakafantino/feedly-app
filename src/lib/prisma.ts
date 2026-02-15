import prisma from "@/lib/db";
import { auth } from "@/lib/auth";

/**
 * Extended Prisma Client with RLS support.
 * Automatically sets the tenant context before executing queries.
 */
const extendedPrisma = prisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ args, query }) {
        try {
          // Get current session
          const session = await auth();
          const storeId = session?.user?.storeId;
          const userId = session?.user?.id;

          // If we have store context, wrap query in RLS transaction
          if (storeId && userId) {
            // Use transaction to ensure set_config applies to the query
            return await prisma.$transaction(async (tx) => {
              // Set RLS context variables
              // Cast to text is important because Prisma sends parameters as typed values
              await tx.$executeRaw`SELECT set_tenant_context(${storeId}::text, ${userId}::text)`;

              // Execute the original query
              return query(args);
            });
          }
        } catch {
          // Fallback if auth fails or other errors (e.g. during build time)
          // console.warn('RLS Context could not be set:', error);
        }

        // Execute query without RLS context (for public access or if context setting failed)
        // Note: If RLS is enforced in DB, this might fail or return empty results for protected tables
        return query(args);
      },
    },
  },
});

export type ExtendedPrismaClient = typeof extendedPrisma;
export default extendedPrisma;
