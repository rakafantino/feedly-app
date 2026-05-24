import prisma from '../src/lib/db';



async function main() {
  console.log('Starting data migration to ProductSupplier...');

  // 1. Dapatkan semua produk yang masih memiliki supplierId
  const products = await prisma.product.findMany({
    where: {
      supplierId: {
        not: null,
      },
    },
    select: {
      id: true,
      supplierId: true,
      purchase_price: true,
      product_code: true,
    },
  });

  console.log(`Found ${products.length} products with legacy supplierId.`);

  let successCount = 0;
  for (const product of products) {
    if (!product.supplierId) continue;

    try {
      // Buat entri di ProductSupplier
      await prisma.productSupplier.upsert({
        where: {
          productId_supplierId: {
            productId: product.id,
            supplierId: product.supplierId,
          },
        },
        update: {},
        create: {
          productId: product.id,
          supplierId: product.supplierId,
          price: product.purchase_price || 0,
          isDefault: true,
        },
      });

      successCount++;
    } catch (e) {
      console.error(`Failed to migrate product ${product.id}`, e);
    }
  }

  console.log(`Successfully migrated ${successCount} products to ProductSupplier.`);

  // 2. Petakan supplierId di ProductBatch jika ada ProductBatch tanpa supplierId
  console.log('Starting data migration for ProductBatch...');
  const batches = await prisma.productBatch.findMany({
    where: {
      supplierId: null,
    },
    include: {
      product: {
        select: {
          supplierId: true,
        },
      },
    },
  });

  console.log(`Found ${batches.length} batches without supplierId.`);
  let batchSuccessCount = 0;

  for (const batch of batches) {
    // Kalau batch berasal dari product yang punya supplierId, gunakan itu
    if (batch.product.supplierId) {
      try {
        await prisma.productBatch.update({
          where: { id: batch.id },
          data: { supplierId: batch.product.supplierId },
        });
        batchSuccessCount++;
      } catch (e) {
        console.error(`Failed to migrate batch ${batch.id}`, e);
      }
    }
  }

  console.log(`Successfully mapped ${batchSuccessCount} batches to legacy supplierId.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
