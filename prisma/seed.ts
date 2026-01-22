import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

// Helper to generate random date within a range
function randomDate(start: Date, end: Date) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

// Helper to generate unique barcode
function generateBarcode() {
  return `899${Math.floor(10000000000 + Math.random() * 90000000000)}`;
}

async function main() {
  console.log("🗑️  Clearing existing data...");

  // Delete in order to avoid foreign key constraints
  await prisma.transactionItem.deleteMany({});
  await prisma.transaction.deleteMany({});
  await prisma.purchaseOrderItem.deleteMany({});
  await prisma.purchaseOrder.deleteMany({});
  await prisma.storeAccess.deleteMany({});
  await prisma.passwordReset.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.supplier.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.store.deleteMany({});

  console.log("✅ Data cleared");
  console.log("🌱 Starting seed...");

  // ------------------- STORES -------------------
  console.log("🏪 Creating stores...");

  const defaultStore = await prisma.store.create({
    data: {
      name: "Toko Utama",
      address: "Jl. Utama No. 123, Jakarta",
      phone: "021-5551234",
      email: "info@tokokita.com",
      description: "Toko utama peternakan",
      monthlyTarget: 50000000, // 50 Juta
      weeklyTarget: 12500000,
      dailyTarget: 2000000,
    },
  });

  const secondStore = await prisma.store.create({
    data: {
      name: "Toko Cabang",
      address: "Jl. Cabang No. 45, Bandung",
      phone: "022-5557890",
      email: "cabang@tokokita.com",
      description: "Toko cabang peternakan",
      monthlyTarget: 30000000,
      weeklyTarget: 7500000,
      dailyTarget: 1200000,
    },
  });

  console.log(`✅ Stores created`);

  // ------------------- USERS & ACCESS -------------------
  console.log("👤 Creating users and access...");

  const password = await hash("password123", 10);

  const users = [
    {
      email: "manager@tokokita.com",
      name: "Budi Santoso",
      role: "MANAGER",
      storeId: defaultStore.id,
    },
    {
      email: "kasir1@tokokita.com",
      name: "Dewi Lestari",
      role: "CASHIER",
      storeId: defaultStore.id,
    },
    {
      email: "manager2@tokokita.com",
      name: "Ahmad Rizki",
      role: "MANAGER",
      storeId: secondStore.id,
    },
    {
      email: "kasir2@tokokita.com",
      name: "Putri Handayani",
      role: "CASHIER",
      storeId: secondStore.id,
    },
    {
      email: "admin@tokokita.com",
      name: "Super Admin",
      role: "ADMIN",
      storeId: null, // Admin usually doesn't belong to a single store in this model, or can access all
    },
  ];

  for (const u of users) {
    const user = await prisma.user.create({
      data: {
        email: u.email,
        name: u.name,
        password,
        role: u.role,
        storeId: u.storeId,
      },
    });

    // Create Store Access if user has a store
    if (u.storeId) {
      await prisma.storeAccess.create({
        data: {
          userId: user.id,
          storeId: u.storeId,
          role: u.role,
        },
      });
    } else if (u.role === "ADMIN") {
      // Give admin access to ALL stores
      await prisma.storeAccess.create({
        data: { userId: user.id, storeId: defaultStore.id, role: "ADMIN" },
      });
      await prisma.storeAccess.create({
        data: { userId: user.id, storeId: secondStore.id, role: "ADMIN" },
      });
    }
  }

  console.log(`✅ Users & Access created`);

  // ------------------- SUPPLIERS -------------------
  console.log("🏭 Creating suppliers...");

  const supplierData = [
    { name: "PT Pakan Ternak Nusantara", email: "sales@ptn.co.id", phone: "0218765432", storeId: defaultStore.id, code: "SUP-PTN" },
    { name: "CV Nutrisi Hewan Indonesia", email: "order@nhi.id", phone: "0227654321", storeId: defaultStore.id, code: "SUP-NHI" },
    { name: "UD Vitamin Ternak Sejahtera", email: "info@vts.com", phone: "0248765432", storeId: secondStore.id, code: "SUP-VTS" },
  ];

  const suppliers = [];
  for (const s of supplierData) {
    const supplier = await prisma.supplier.create({ data: s });
    suppliers.push(supplier);
  }
  console.log(`✅ Suppliers created`);

  // ------------------- PRODUCTS -------------------
  console.log("🛒 Creating products...");

  const productTemplates = [
    { name: "Pakan Ayam Starter", category: "Pakan Ayam", price: 78000, buy: 65000, unit: "karung" },
    { name: "Vitamin Ayam Multi", category: "Vitamin", price: 38000, buy: 28000, unit: "botol" },
    { name: "Obat Cacing Unggas", category: "Obat", price: 43000, buy: 32000, unit: "botol" },
    { name: "Pakan Sapi Pro Milk", category: "Pakan Sapi", price: 92000, buy: 76000, unit: "karung" },
    { name: "Kalsium Sapi Plus", category: "Vitamin", price: 47000, buy: 36000, unit: "botol" },
  ];

  const allProducts = [];

  // Create products for BOTH stores
  for (const store of [defaultStore, secondStore]) {
    // Pick a random supplier for this store's products (simplified)
    const storeSupplier = suppliers.find((s) => s.storeId === store.id) || suppliers[0];

    for (const tmpl of productTemplates) {
      const product = await prisma.product.create({
        data: {
          name: tmpl.name,
          category: tmpl.category,
          price: tmpl.price,
          purchase_price: tmpl.buy,
          min_selling_price: Math.floor(tmpl.buy * 1.1),
          stock: Math.floor(Math.random() * 100) + 10,
          unit: tmpl.unit,
          description: `Deskripsi untuk ${tmpl.name}`,
          threshold: 10,
          barcode: generateBarcode(),
          supplierId: storeSupplier.id,
          storeId: store.id,
          expiry_date: randomDate(new Date(), new Date(2026, 12, 31)),
        },
      });
      allProducts.push(product);
    }
  }
  console.log(`✅ Products created`);

  // ------------------- TRANSACTIONS (HISTORY) -------------------
  console.log("💰 Generating transaction history (Past 30 Days)...");

  const today = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(today.getDate() - 30);

  let transactionCount = 0;

  // Iterate strictly day by day to ensure chart continuity
  for (let d = 0; d <= 30; d++) {
    const currentDate = new Date(thirtyDaysAgo);
    currentDate.setDate(thirtyDaysAgo.getDate() + d);

    // Randomize sales volume per day (e.g., 2-8 transactions per store)
    const dailyTransactionCount = Math.floor(Math.random() * 7) + 2;

    for (const store of [defaultStore, secondStore]) {
      const storeProducts = allProducts.filter((p) => p.storeId === store.id);

      for (let i = 0; i < dailyTransactionCount; i++) {
        // Random time within business hours (08:00 - 20:00)
        const transactionTime = new Date(currentDate);
        transactionTime.setHours(8 + Math.floor(Math.random() * 12), Math.floor(Math.random() * 60));

        // Create Transaction Header
        const transaction = await prisma.transaction.create({
          data: {
            storeId: store.id,
            paymentMethod: Math.random() > 0.3 ? "CASH" : "QRIS",
            total: 0, // Will update after items
            createdAt: transactionTime,
            updatedAt: transactionTime,
          },
        });

        // Add 1-4 random items
        const itemCount = Math.floor(Math.random() * 4) + 1;
        let total = 0;

        for (let j = 0; j < itemCount; j++) {
          const product = storeProducts[Math.floor(Math.random() * storeProducts.length)];
          const qty = Math.floor(Math.random() * 3) + 1;
          const itemTotal = product.price * qty;

          await prisma.transactionItem.create({
            data: {
              transactionId: transaction.id,
              productId: product.id,
              quantity: qty,
              price: product.price,
              createdAt: transactionTime,
            },
          });
          total += itemTotal;
        }

        // Update total
        await prisma.transaction.update({
          where: { id: transaction.id },
          data: { total },
        });

        transactionCount++;
      }
    }
  }
  console.log(`✅ Generated ${transactionCount} transactions over the last 30 days`);

  // ------------------- PURCHASE ORDERS -------------------
  console.log("📦 Creating Purchase Orders...");

  for (const store of [defaultStore, secondStore]) {
    const storeSupplier = suppliers.find((s) => s.storeId === store.id) || suppliers[0];
    const storeProducts = allProducts.filter((p) => p.storeId === store.id);

    // 1. DRAFT PO
    const poDraft = await prisma.purchaseOrder.create({
      data: {
        poNumber: `PO-${store.name.substring(0, 3).toUpperCase()}-${Date.now()}`,
        storeId: store.id,
        supplierId: storeSupplier.id,
        status: "draft",
        notes: "Restock bulanan",
      },
    });
    // Add items to draft
    await prisma.purchaseOrderItem.create({
      data: {
        purchaseOrderId: poDraft.id,
        productId: storeProducts[0].id,
        quantity: 50,
        price: storeProducts[0].purchase_price || 0,
        unit: storeProducts[0].unit,
      },
    });

    // 2. COMPLETED PO
    const poDone = await prisma.purchaseOrder.create({
      data: {
        poNumber: `PO-${store.name.substring(0, 3).toUpperCase()}-${Date.now() - 100000}`,
        storeId: store.id,
        supplierId: storeSupplier.id,
        status: "completed",
        notes: "Stok darurat",
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      },
    });

    await prisma.purchaseOrderItem.create({
      data: {
        purchaseOrderId: poDone.id,
        productId: storeProducts[1].id,
        quantity: 20,
        price: storeProducts[1].purchase_price || 0,
        unit: storeProducts[1].unit,
      },
    });
  }
  console.log(`✅ Purchase Orders created`);

  console.log("✅ Seeding finished successfully!");
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
