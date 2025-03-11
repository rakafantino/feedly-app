import { PrismaClient } from '@prisma/client';
import { hash } from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // Buat user
  const managerPassword = await hash('password123', 10);
  const cashierPassword = await hash('password123', 10);

  // Buat User Manager
  const manager = await prisma.user.upsert({
    where: { email: 'manager@example.com' },
    update: {},
    create: {
      email: 'manager@example.com',
      name: 'Manager User',
      password: managerPassword,
      role: 'MANAGER',
    },
  });

  // Buat User Kasir
  const cashier = await prisma.user.upsert({
    where: { email: 'cashier@example.com' },
    update: {},
    create: {
      email: 'cashier@example.com',
      name: 'Cashier User',
      password: cashierPassword,
      role: 'CASHIER',
    },
  });

  console.log({ manager, cashier });

  // Buat Supplier
  const supplier1 = await prisma.supplier.upsert({
    where: { id: 'sup-001' },
    update: {},
    create: {
      id: 'sup-001',
      name: 'PT Pakan Ternak Sejahtera',
      phone: '08123456789',
      address: 'Jl. Raya Pakan No. 123, Jakarta',
    },
  });

  const supplier2 = await prisma.supplier.upsert({
    where: { id: 'sup-002' },
    update: {},
    create: {
      id: 'sup-002',
      name: 'CV Nutrisi Hewan',
      phone: '08987654321',
      address: 'Jl. Nutrisi Hewan No. 45, Bandung',
    },
  });

  console.log({ supplier1, supplier2 });

  // Produk Pakan Ternak
  const products = [
    {
      name: 'Pakan Ayam Starter',
      price: 75000,
      stock: 50,
      unit: 'karung',
      category: 'Pakan Ayam',
      barcode: '8991234567890',
      supplierId: supplier1.id,
    },
    {
      name: 'Pakan Ayam Grower',
      price: 70000,
      stock: 40,
      unit: 'karung',
      category: 'Pakan Ayam',
      barcode: '8991234567891',
      supplierId: supplier1.id,
    },
    {
      name: 'Pakan Ayam Layer',
      price: 80000,
      stock: 35,
      unit: 'karung',
      category: 'Pakan Ayam',
      barcode: '8991234567892',
      supplierId: supplier1.id,
    },
    {
      name: 'Pakan Sapi Perah',
      price: 90000,
      stock: 25,
      unit: 'karung',
      category: 'Pakan Sapi',
      barcode: '8991234567893',
      supplierId: supplier2.id,
    },
    {
      name: 'Pakan Sapi Penggemukan',
      price: 95000,
      stock: 30,
      unit: 'karung',
      category: 'Pakan Sapi',
      barcode: '8991234567894',
      supplierId: supplier2.id,
    },
    {
      name: 'Pakan Kambing',
      price: 65000,
      stock: 45,
      unit: 'karung',
      category: 'Pakan Kambing',
      barcode: '8991234567895',
      supplierId: supplier2.id,
    },
    {
      name: 'Vitamin Ayam',
      price: 35000,
      stock: 100,
      unit: 'botol',
      category: 'Vitamin',
      barcode: '8991234567896',
      supplierId: supplier1.id,
    },
    {
      name: 'Vitamin Sapi',
      price: 45000,
      stock: 80,
      unit: 'botol',
      category: 'Vitamin',
      barcode: '8991234567897',
      supplierId: supplier2.id,
    },
    {
      name: 'Obat Cacing Unggas',
      price: 40000,
      stock: 60,
      unit: 'botol',
      category: 'Obat',
      barcode: '8991234567898',
      supplierId: supplier1.id,
    },
    {
      name: 'Obat Cacing Ternak',
      price: 50000,
      stock: 50,
      unit: 'botol',
      category: 'Obat',
      barcode: '8991234567899',
      supplierId: supplier2.id,
    },
  ];

  // Buat produk dan log hasilnya
  for (const product of products) {
    const result = await prisma.product.upsert({
      where: { barcode: product.barcode },
      update: {},
      create: product,
    });
    console.log(`Created product: ${result.name}`);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  }); 