import { PrismaClient } from '@prisma/client';
import { hash } from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding...');

  // Create users
  const managerPassword = await hash('manager123', 10);
  const cashierPassword = await hash('cashier123', 10);

  await prisma.user.upsert({
    where: { email: 'manager@feedly.com' },
    update: {},
    create: {
      email: 'manager@feedly.com',
      name: 'Manager',
      password: managerPassword,
      role: 'MANAGER',
    },
  });

  await prisma.user.upsert({
    where: { email: 'cashier@feedly.com' },
    update: {},
    create: {
      email: 'cashier@feedly.com',
      name: 'Cashier',
      password: cashierPassword,
      role: 'CASHIER',
    },
  });

  // Create suppliers
  const supplierA = await prisma.supplier.upsert({
    where: { id: 'supplier-a' },
    update: {},
    create: {
      id: 'supplier-a',
      name: 'Supplier A',
      email: 'suppliera@example.com',
      phone: '081234567890',
      address: 'Jl. Supplier A No. 123',
    },
  });

  const supplierB = await prisma.supplier.upsert({
    where: { id: 'supplier-b' },
    update: {},
    create: {
      id: 'supplier-b',
      name: 'Supplier B',
      email: 'supplierb@example.com',
      phone: '089876543210',
      address: 'Jl. Supplier B No. 456',
    },
  });

  // Create products
  await prisma.product.upsert({
    where: { id: 'product-1' },
    update: {},
    create: {
      id: 'product-1',
      name: 'Pakan Ayam Premium',
      category: 'Unggas',
      price: 75000,
      stock: 50,
      unit: 'kg',
      description: 'Pakan berkualitas tinggi untuk ayam broiler',
      barcode: '8991234567890',
      threshold: 10,
      supplierId: supplierA.id,
    },
  });

  await prisma.product.upsert({
    where: { id: 'product-2' },
    update: {},
    create: {
      id: 'product-2',
      name: 'Pakan Sapi Perah',
      category: 'Ternak',
      price: 120000,
      stock: 30,
      unit: 'kg',
      description: 'Pakan untuk sapi perah dengan nutrisi lengkap',
      barcode: '8991234567891',
      threshold: 5,
      supplierId: supplierB.id,
    },
  });

  await prisma.product.upsert({
    where: { id: 'product-3' },
    update: {},
    create: {
      id: 'product-3',
      name: 'Pakan Ikan Lele',
      category: 'Ikan',
      price: 65000,
      stock: 40,
      unit: 'kg',
      description: 'Pakan untuk budidaya ikan lele',
      barcode: '8991234567892',
      threshold: 8,
      supplierId: supplierA.id,
    },
  });

  await prisma.product.upsert({
    where: { id: 'product-4' },
    update: {},
    create: {
      id: 'product-4',
      name: 'Pakan Kambing',
      category: 'Ternak',
      price: 95000,
      stock: 25,
      unit: 'kg',
      description: 'Pakan khusus untuk kambing',
      barcode: '8991234567893',
      threshold: 7,
      supplierId: supplierB.id,
    },
  });

  await prisma.product.upsert({
    where: { id: 'product-5' },
    update: {},
    create: {
      id: 'product-5',
      name: 'Pakan Burung Merpati',
      category: 'Unggas',
      price: 85000,
      stock: 15,
      unit: 'kg',
      description: 'Pakan khusus untuk burung merpati',
      barcode: '8991234567894',
      threshold: 5,
      supplierId: supplierA.id,
    },
  });

  // Create a sample transaction
  await prisma.transaction.create({
    data: {
      total: 360000,
      paymentMethod: 'CASH',
      items: {
        create: [
          {
            productId: 'product-1',
            quantity: 2,
            price: 75000,
          },
          {
            productId: 'product-2',
            quantity: 1.5,
            price: 120000,
          },
          {
            productId: 'product-3',
            quantity: 1,
            price: 65000,
          },
        ],
      },
    },
  });

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 