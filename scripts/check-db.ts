import prisma from '../src/lib/prisma';

async function main() {
  const products = await prisma.product.findMany({
    where: {
      OR: [
        { purchase_price: null },
        { purchase_price: 0 },
        { hpp_price: null },
        { hpp_price: 0 }
      ]
    }
  });
  console.log('Products with empty purchase_price/hpp_price:', products.length);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
