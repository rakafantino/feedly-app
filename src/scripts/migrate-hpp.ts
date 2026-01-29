
import 'dotenv/config';
import prisma from '../lib/prisma';
import { calculateCleanHpp } from '../lib/hpp-calculator';

// const prisma = new PrismaClient(); // Removed

async function migrateHppPrice() {
  console.log('Starting HPP Price Migration...');

  try {
    const products = await prisma.product.findMany({
      select: {
        id: true,
        name: true,
        purchase_price: true,
        hppCalculationDetails: true,
      }
    });

    console.log(`Found ${products.length} products to check.`);

    let updatedCount = 0;

    for (const product of products) {
      const hppPrice = calculateCleanHpp(product.purchase_price, product.hppCalculationDetails);

      // Only update if hpp_price is different or null (though we can't check current hpp_price in select to save bandwidth, let's just update)
      // Actually, let's just update everything to be sure.
      
      await prisma.product.update({
        where: { id: product.id },
        data: { hpp_price: hppPrice }
      });

      updatedCount++;
      if (updatedCount % 10 === 0) {
        process.stdout.write(`.`);
      }
    }

    console.log(`\nMigration completed. Updated ${updatedCount} products.`);

  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

migrateHppPrice();
