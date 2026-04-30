import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL;

// Singleton pattern to prevent multiple instances in development
type PrismaGlobalState = {
  prisma?: PrismaClient;
  prismaPool?: Pool;
  prismaCleanupRegistered?: boolean;
  prismaCleanupPromise?: Promise<void>;
};

const globalForPrisma = globalThis as unknown as PrismaGlobalState;

const pool =
  globalForPrisma.prismaPool ||
  (() => {
    const createdPool = new Pool({ connectionString });
    if (process.env.NODE_ENV !== "production") {
      globalForPrisma.prismaPool = createdPool;
    }
    return createdPool;
  })();

const prisma =
  globalForPrisma.prisma ||
  (() => {
    const adapter = new PrismaPg(pool);
    const client = new PrismaClient({ adapter } as any);
    if (process.env.NODE_ENV !== "production") {
      globalForPrisma.prisma = client;
    }
    return client;
  })();

if (!globalForPrisma.prismaCleanupRegistered) {
  globalForPrisma.prismaCleanupRegistered = true;

  const cleanup = async () => {
    if (!globalForPrisma.prismaCleanupPromise) {
      globalForPrisma.prismaCleanupPromise = (async () => {
        await prisma.$disconnect();
        await pool.end();
      })();
    }

    await globalForPrisma.prismaCleanupPromise;
  };

  process.once("beforeExit", async () => {
    await cleanup();
  });
}

export default prisma;
