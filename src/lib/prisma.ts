import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { rlsMiddleware } from './rls-middleware';

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

// Create base Prisma client
let prisma = new PrismaClient({ adapter } as any);

// Apply RLS middleware
prisma = rlsMiddleware(prisma);

export default prisma;
