
import 'dotenv/config';
import prisma from '../src/lib/prisma';

async function main() {
    console.log('Starting backfill...');

    // 1. Backfill Suppliers
    const suppliers = await prisma.supplier.findMany({
        where: { code: null }
    });

    console.log(`Found ${suppliers.length} suppliers without code.`);

    for (const supplier of suppliers) {
        // Generate code: First 3 letters of name uppercase, remove common prefixes
        let cleanName = supplier.name.replace(/^(PT|CV|UD|TB|TOKO)\.?\s+/i, "").trim().toUpperCase();
        let code = cleanName.substring(0, 3).replace(/[^A-Z]/g, '');

        // Ensure uniqueness manually by appending ID segment
        code = `${code}-${supplier.id.substring(0, 4)}`.toUpperCase();

        await prisma.supplier.update({
            where: { id: supplier.id },
            data: { code }
        });
        console.log(`Updated Supplier ${supplier.name} -> ${code}`);
    }

    // 2. Backfill Products
    const products = await prisma.product.findMany({
        where: { product_code: null }
    });

    console.log(`Found ${products.length} products without code.`);

    for (const product of products) {
        // Generate code: SKU-(acronym)-ID
        const cleanName = product.name.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 5);
        const code = `${cleanName}-${product.id.substring(0, 4)}`.toUpperCase();

        await prisma.product.update({
            where: { id: product.id },
            data: { product_code: code }
        });
        console.log(`Updated Product ${product.name} -> ${code}`);
    }

    console.log('Backfill complete.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        // disconnecting is handled by prisma instance usually, but good practice
        // await prisma.$disconnect(); 
    });
