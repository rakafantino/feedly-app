import 'dotenv/config';
import prisma from '../src/lib/prisma';

async function main() {
  console.log('Starting migration: Stock -> Batches');

  try {
    const products = await prisma.product.findMany({
      where: {
        isDeleted: false,
        stock: { gt: 0 }
      },
      include: {
        batches: true
      }
    });

    console.log(`Found ${products.length} active products with stock.`);

    let migratedCount = 0;
    
    for (const product of products) {
      // If product has no batches, create a default batch for current stock
      if (product.batches.length === 0) {
        await prisma.productBatch.create({
          data: {
            productId: product.id,
            stock: product.stock,
            expiryDate: product.expiry_date,
            purchasePrice: product.purchase_price,
            batchNumber: 'INITIAL-STOCK',
            inDate: new Date()
          }
        });
        migratedCount++;
        process.stdout.write('.');
      }
    }

    console.log(`\nMigration complete. Migrated ${migratedCount} products to batches.`);

  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
