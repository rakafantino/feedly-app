
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { addDays, differenceInDays } from 'date-fns';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

const STORE_ID_MAIN = '4e5f14a8-e03d-4030-a21b-81e45812f04f'; // Toko Utama

async function main() {
  console.log(`Checking Expired Products for Store ID: ${STORE_ID_MAIN}`);

  // 1. Get Store Settings for Notification Days
  const store = await prisma.store.findUnique({
    where: { id: STORE_ID_MAIN },
    select: { name: true, expiryNotificationDays: true }
  });

  if (!store) {
      console.error("Store not found!");
      return;
  }

  const expiryNotificationDays = store.expiryNotificationDays || 30;
  console.log(`Store Name: ${store.name}`);
  console.log(`Expiry Notification Days Setting: ${expiryNotificationDays}`);

  const thresholdDate = addDays(new Date(), expiryNotificationDays);
  console.log(`Threshold Date (Today + ${expiryNotificationDays} days): ${thresholdDate.toISOString()}`);

  // 2. Simulate Backend Query (Exact Copy from /api/analytics/stock)
  console.log("\n--- [BACKEND ALGORITHM] Database Query Simulation ---");
  const backendCount = await prisma.product.count({
    where: {
      storeId: STORE_ID_MAIN,
      isDeleted: false,
      stock: { gt: 0 },
      OR: [
        { expiry_date: { lte: thresholdDate } },
        { 
          batches: { 
            some: { 
              expiryDate: { lte: thresholdDate },
              stock: { gt: 0 }
            } 
          } 
        }
      ]
    }
  });
  console.log(`Backend Count Result: ${backendCount}`);

  if (backendCount > 0) {
      console.log("Finding the culprit(s) detected by Backend Query...");
      const culprits = await prisma.product.findMany({
        where: {
            storeId: STORE_ID_MAIN,
            isDeleted: false,
            stock: { gt: 0 },
            OR: [
              { expiry_date: { lte: thresholdDate } },
              { 
                batches: { 
                  some: { 
                    expiryDate: { lte: thresholdDate },
                    stock: { gt: 0 }
                  } 
                } 
              }
            ]
          },
          include: {
              batches: true
          }
      });
      
      culprits.forEach(p => {
          console.log(`\nFound Product: ${p.name} (ID: ${p.id})`);
          console.log(`  Stock: ${p.stock}`);
          console.log(`  Product Expiry: ${p.expiry_date ? p.expiry_date.toISOString() : 'NULL'}`);
          
          // Check Batches
          const expiringBatches = p.batches.filter(b => b.stock > 0 && b.expiryDate && b.expiryDate <= thresholdDate);
          if (expiringBatches.length > 0) {
              console.log(`  Expiring Batches:`);
              expiringBatches.forEach(b => {
                  console.log(`    - Batch ${b.batchNumber}: Stock ${b.stock}, Expiry ${b.expiryDate?.toISOString()}`);
              });
          } else {
              console.log(`  No individual batches expiring within threshold (Triggered by Product Level Expiry?)`);
          }
      });
  }

  // 3. Simulate Frontend Logic (src/lib/stock-utils.ts)
  console.log("\n--- [FRONTEND ALGORITHM] Logic Simulation ---");
  // Frontend fetches products first (usually all or paginated, but let's fetch all active products for this store)
  const allProducts = await prisma.product.findMany({
      where: {
          storeId: STORE_ID_MAIN,
          isDeleted: false
      },
      include: {
          batches: true
      }
  });

  const frontendDetected: any[] = [];

  allProducts.forEach(product => {
      // Logic from stock-utils.ts
      let isRisk = false;

      // Strategy 1: Batches
      if (product.batches && product.batches.length > 0) {
          product.batches.forEach(batch => {
              if (batch.stock <= 0) return;
              if (!batch.expiryDate) return;

              const expiryDate = new Date(batch.expiryDate);
              const today = new Date();
              const daysLeft = differenceInDays(expiryDate, today);

              if (daysLeft < expiryNotificationDays) {
                  isRisk = true;
                  console.log(`[Frontend Logic] Batch Risk detected: ${product.name} (Batch ${batch.batchNumber}), Days Left: ${daysLeft}`);
              }
          });
      } 
      // Strategy 2: Product Level Fallback
      else if (product.expiry_date && product.stock > 0) {
          const expiryDate = new Date(product.expiry_date);
          const today = new Date();
          const daysLeft = differenceInDays(expiryDate, today);

          if (daysLeft < expiryNotificationDays) {
              isRisk = true;
              console.log(`[Frontend Logic] Product Risk detected: ${product.name}, Days Left: ${daysLeft}`);
          }
      }

      if (isRisk) {
          frontendDetected.push(product.name);
      }
  });

  console.log(`Frontend Logic Detected Count: ${frontendDetected.length}`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
