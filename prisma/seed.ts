// @ts-nocheck
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

// Fungsi bantuan untuk menghasilkan tanggal acak dalam rentang tertentu
function randomDate(start: Date, end: Date) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

// Fungsi untuk menghasilkan nomor barcode unik
function generateBarcode() {
  return `899${Math.floor(10000000000 + Math.random() * 90000000000)}`;
}

async function main() {
  console.log('🗑️ Menghapus semua data yang ada...');
  
  // Hapus semua data (dalam urutan untuk menghindari konflik foreign key)
  await prisma.purchaseOrderItem.deleteMany({});
  await prisma.purchaseOrder.deleteMany({});
  await prisma.transactionItem.deleteMany({});
  await prisma.transaction.deleteMany({});
  await prisma.passwordReset.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.supplier.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.store.deleteMany({});
  
  console.log('✅ Data berhasil dihapus');
  console.log('🌱 Memulai seeding data baru...');

  // ------------------- STORE -------------------
  console.log('🏪 Membuat default store...');
  
  const defaultStore = await prisma.store.create({
    data: {
      name: 'Toko Utama',
      address: 'Jl. Utama No. 123, Jakarta',
      phone: '021-5551234',
      email: 'info@tokokita.com',
      description: 'Toko utama peternakan',
    }
  });

  const secondStore = await prisma.store.create({
    data: {
      name: 'Toko Cabang',
      address: 'Jl. Cabang No. 45, Bandung',
      phone: '022-5557890',
      email: 'cabang@tokokita.com',
      description: 'Toko cabang peternakan',
    }
  });
  
  console.log(`✅ Store dibuat: ${defaultStore.name} (${defaultStore.id})`);
  console.log(`✅ Store dibuat: ${secondStore.name} (${secondStore.id})`);

  // ------------------- USERS -------------------
  console.log('👤 Membuat users...');
  
  const password = await hash('password123', 10);
  
  // Users untuk Toko Utama
  const manager1 = await prisma.user.create({
    data: {
      email: 'manager@tokokita.com',
      name: 'Budi Santoso',
      password,
      role: 'MANAGER',
      storeId: defaultStore.id,
    },
  });

  const cashier1 = await prisma.user.create({
    data: {
      email: 'kasir1@tokokita.com',
      name: 'Dewi Lestari',
      password,
      role: 'CASHIER',
      storeId: defaultStore.id,
    },
  });

  // Users untuk Toko Cabang
  const manager2 = await prisma.user.create({
    data: {
      email: 'manager2@tokokita.com',
      name: 'Ahmad Rizki',
      password,
      role: 'MANAGER',
      storeId: secondStore.id,
    },
  });

  const cashier2 = await prisma.user.create({
    data: {
      email: 'kasir2@tokokita.com',
      name: 'Putri Handayani',
      password,
      role: 'CASHIER',
      storeId: secondStore.id,
    },
  });

  // Admin (dapat mengakses semua toko)
  const admin = await prisma.user.create({
    data: {
      email: 'admin@tokokita.com',
      name: 'Super Admin',
      password,
      role: 'ADMIN',
    },
  });

  console.log(`✅ Users Toko Utama dibuat: ${manager1.name}, ${cashier1.name}`);
  console.log(`✅ Users Toko Cabang dibuat: ${manager2.name}, ${cashier2.name}`);
  console.log(`✅ Admin dibuat: ${admin.name}`);

  // ------------------- SUPPLIERS -------------------
  console.log('🏭 Membuat suppliers...');
  
  const suppliers = [
    {
      name: 'PT Pakan Ternak Nusantara',
      email: 'sales@pakanternaknusantara.co.id',
      phone: '0218765432',
      address: 'Jl. Industri Pakan No. 123, Bekasi, Jawa Barat',
      storeId: defaultStore.id,
    },
    {
      name: 'CV Nutrisi Hewan Indonesia',
      email: 'order@nutrisihewan.id',
      phone: '0227654321',
      address: 'Jl. Nutrisi Hewan No. 45, Bandung, Jawa Barat',
      storeId: defaultStore.id,
    },
    {
      name: 'PT Medika Hewan Indonesia',
      email: 'sales@medikahewan.com',
      phone: '0274654321',
      address: 'Jl. Kesehatan Hewan No. 32, Yogyakarta, DI Yogyakarta',
      storeId: defaultStore.id,
    },
    // Supplier untuk Toko Cabang
    {
      name: 'UD Vitamin Ternak Sejahtera',
      email: 'info@vitaminternak.com',
      phone: '0248765432',
      address: 'Jl. Vitamin Unggas No. 89, Semarang, Jawa Tengah',
      storeId: secondStore.id,
    },
    {
      name: 'PT Agri Supply Makmur',
      email: 'contact@agrisupply.co.id',
      phone: '0318976543',
      address: 'Jl. Raya Agribisnis No. 67, Surabaya, Jawa Timur',
      storeId: secondStore.id,
    },
  ];

  const createdSuppliers = [];
  for (const supplier of suppliers) {
    const result = await prisma.supplier.create({
      data: supplier,
    });
    createdSuppliers.push(result);
    console.log(`✅ Supplier dibuat: ${result.name} untuk toko ${supplier.storeId}`);
  }

  // ------------------- PRODUCTS -------------------
  console.log('🛒 Membuat products...');
  
  // Produk Toko Utama
  const productsStore1 = [
    {
      name: 'Pakan Ayam Starter Premium',
      category: 'Pakan Ayam',
      price: 78000,
      purchase_price: 65000,
      stock: 45,
      unit: 'karung',
      description: 'Pakan unggas berkualitas tinggi untuk ayam usia 0-4 minggu',
      threshold: 10,
      supplierId: createdSuppliers[0].id,
      storeId: defaultStore.id,
    },
    {
      name: 'Vitamin Ayam Multi Nutrient',
      category: 'Vitamin',
      price: 38000,
      purchase_price: 28000,
      stock: 95,
      unit: 'botol',
      description: 'Vitamin lengkap untuk pertumbuhan ayam optimal',
      threshold: 20,
      supplierId: createdSuppliers[1].id,
      storeId: defaultStore.id,
    },
    {
      name: 'Obat Cacing Unggas',
      category: 'Obat',
      price: 43000,
      purchase_price: 32000,
      stock: 58,
      unit: 'botol',
      description: 'Obat cacing untuk unggas',
      threshold: 12,
      supplierId: createdSuppliers[2].id,
      storeId: defaultStore.id,
    },
  ];

  // Produk Toko Cabang
  const productsStore2 = [
    {
      name: 'Pakan Sapi Perah Pro Milk',
      category: 'Pakan Sapi',
      price: 92000,
      purchase_price: 76000,
      stock: 24,
      unit: 'karung',
      description: 'Pakan khusus untuk sapi perah dengan kandungan nutrisi tinggi',
      threshold: 8,
      supplierId: createdSuppliers[3].id,
      storeId: secondStore.id,
    },
    {
      name: 'Vitamin Sapi Calcium Plus',
      category: 'Vitamin',
      price: 47000,
      purchase_price: 36000,
      stock: 75,
      unit: 'botol',
      description: 'Suplemen kalsium untuk sapi perah',
      threshold: 15,
      supplierId: createdSuppliers[4].id,
      storeId: secondStore.id,
    },
    {
      name: 'Tempat Minum Unggas Otomatis',
      category: 'Peralatan',
      price: 48000,
      purchase_price: 35000,
      stock: 25,
      unit: 'buah',
      description: 'Tempat minum otomatis untuk unggas',
      threshold: 5,
      supplierId: createdSuppliers[3].id,
      storeId: secondStore.id,
    },
  ];

  const allProducts = [...productsStore1, ...productsStore2];
  const createdProducts = [];

  for (const product of allProducts) {
    const result = await prisma.product.create({
      data: {
        ...product,
        barcode: generateBarcode(),
        purchase_date: randomDate(new Date(2023, 0, 1), new Date()),
        expiry_date: randomDate(new Date(), new Date(2025, 11, 31)),
        batch_number: `BT${Math.floor(1000 + Math.random() * 9000)}`,
        min_selling_price: Math.floor(product.purchase_price * 1.05) // 5% di atas harga beli
      },
    });
    createdProducts.push(result);
    console.log(`✅ Product dibuat: ${result.name} untuk toko ${product.storeId}`);
  }

  console.log('✅ Seeding selesai!');
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