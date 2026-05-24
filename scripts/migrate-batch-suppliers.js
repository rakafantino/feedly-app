const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  console.log("Starting batch supplier migration...");

  // Update product_batches where supplier_id is null using the product's legacy supplier_id
  const result = await prisma.$executeRaw`
    UPDATE "product_batches" pb
    SET "supplier_id" = p."supplier_id"
    FROM "products" p
    WHERE pb."product_id" = p."id"
      AND pb."supplier_id" IS NULL
      AND p."supplier_id" IS NOT NULL;
  `;

  console.log(`Migration complete! Updated ${result} batches.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
