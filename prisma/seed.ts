import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

// --- HELPERS ---

function randomDate(start: Date, end: Date) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function generateBarcode() {
  return `899${Math.floor(10000000000 + Math.random() * 90000000000)}`;
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// --- DATA SETS ---
const PRODUCT_TEMPLATES = [
  { name: "Pakan Ayam Broiler (Karung 50kg)", category: "Pakan", unit: "SAC", price: 380000, hpp: 350000 },
  { name: "Pakan Bebek Petelur (Karung 50kg)", category: "Pakan", unit: "SAC", price: 410000, hpp: 375000 },
  { name: "Jagung Giling Halus (KG)", category: "Bahan Baku", unit: "KG", price: 8500, hpp: 6000 },
  { name: "Dedak Padi Super (KG)", category: "Bahan Baku", unit: "KG", price: 4500, hpp: 3000 },
  { name: "Vitamin VitaChicks (Sachet 5g)", category: "Obat & Vitamin", unit: "PCS", price: 5000, hpp: 3500 },
  { name: "NeoBro Penambah Bobot (Sachet)", category: "Obat & Vitamin", unit: "PCS", price: 6000, hpp: 4000 },
  { name: "Tempat Minum Ayam (1 Galon)", category: "Peralatan", unit: "PCS", price: 35000, hpp: 25000 },
  { name: "Tempat Makan Ayam (5 KG)", category: "Peralatan", unit: "PCS", price: 45000, hpp: 32000 },
  { name: "Desinfektan Kandang (1 Liter)", category: "Kebersihan", unit: "BTL", price: 75000, hpp: 55000 },
  { name: "Sekop Kotoran Besi", category: "Peralatan", unit: "PCS", price: 55000, hpp: 40000 },
  { name: "Pakan Ikan Lele (Karung 30kg)", category: "Pakan", unit: "SAC", price: 280000, hpp: 250000 },
  { name: "Probiotik Ikan (Botol 1L)", category: "Obat & Vitamin", unit: "BTL", price: 90000, hpp: 70000 },
];

// --- MAIN ---

async function main() {
  console.log("🗑️  Clearing existing data...");

  // Delete all data to start fresh (Order matters due to foreign keys)
  await prisma.notification.deleteMany({});
  await prisma.stockAdjustment.deleteMany({});
  await prisma.expense.deleteMany({});
  await prisma.debtPayment.deleteMany({});
  await prisma.transactionItem.deleteMany({});
  await prisma.transaction.deleteMany({});
  await prisma.purchaseOrderItem.deleteMany({});
  await prisma.purchaseOrder.deleteMany({});
  await prisma.productBatch.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.supplier.deleteMany({});
  await prisma.storeAccess.deleteMany({});
  await prisma.passwordReset.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.customer.deleteMany({});
  await prisma.store.deleteMany({});

  console.log("✅ Data cleared");
  console.log("🌱 Starting comprehensive seed...");

  const password = await hash("password123", 10);

  // --- STORE GENERATION FUNCTION ---
  async function seedStore(storeName: string, storeAddress: string, isMain: boolean = false) {
    console.log(`\n🏪 Creating store: ${storeName}...`);

    const store = await prisma.store.create({
      data: {
        name: storeName,
        address: storeAddress,
        phone: isMain ? "021-99887766" : "021-55443322",
        dailyTarget: isMain ? 5000000 : 3000000,
        monthlyTarget: isMain ? 150000000 : 90000000,
      },
    });

    // Create Staff for this store
    const staffRole = "CASHIER";
    const staffName = isMain ? "Siti Kasir Pusat" : "Budi Kasir Cabang";
    const staffEmail = isMain ? "kasir.pusat@feedly.com" : "kasir.cabang@feedly.com";

    const staff = await prisma.user.create({
      data: {
        email: staffEmail,
        name: staffName,
        password,
        role: staffRole,
        storeId: store.id,
      },
    });

    await prisma.storeAccess.create({
      data: { userId: staff.id, storeId: store.id, role: staffRole },
    });

    // Create Suppliers
    const suppliers = await Promise.all([
      prisma.supplier.create({ data: { name: "PT. Charoen Pokphand", code: `SUP-CP-${store.id.substring(0, 4)}`, storeId: store.id, email: "sales@cp.co.id", phone: "021-111111" } }),
      prisma.supplier.create({ data: { name: "PT. Japfa Comfeed", code: `SUP-JC-${store.id.substring(0, 4)}`, storeId: store.id, email: "orders@japfa.com", phone: "021-222222" } }),
      prisma.supplier.create({ data: { name: "CV. Makmur Jaya", code: `SUP-MJ-${store.id.substring(0, 4)}`, storeId: store.id, email: "admin@makmur.co.id", phone: "021-333333" } }),
    ]);

    // Create Customers
    const customers = await Promise.all([
      prisma.customer.create({ data: { name: "Pak Haji Slamet", phone: `0812${randomInt(1000, 9999)}`, address: "Desa Sukamaju", storeId: store.id } }),
      prisma.customer.create({ data: { name: "Bu Tejo (Warung)", phone: `0813${randomInt(1000, 9999)}`, address: "Desa Sukamiskin", storeId: store.id } }),
      prisma.customer.create({ data: { name: "Kang Asep", phone: `0814${randomInt(1000, 9999)}`, address: "Kampung Durian", storeId: store.id } }),
    ]);

    // Create Products & Batches
    const products = [];
    for (const p of PRODUCT_TEMPLATES) {
      // Variasi stok antar toko
      const stockQty = isMain ? randomInt(50, 200) : randomInt(20, 100);
      const supplier = suppliers[randomInt(0, suppliers.length - 1)];

      const product = await prisma.product.create({
        data: {
          product_code: `PRD-${Date.now()}-${randomInt(100, 999)}`,
          name: p.name,
          category: p.category,
          unit: p.unit,
          price: p.price,
          purchase_price: p.hpp,
          hpp_price: p.hpp,
          min_selling_price: p.hpp * 1.05,
          stock: stockQty,
          threshold: 10,
          description: `Stok untuk ${storeName}`,
          storeId: store.id,
          supplierId: supplier.id,
          barcode: generateBarcode(),
          hppCalculationDetails: { costs: [] },
          purchase_date: new Date(),
          expiry_date: new Date(Date.now() + 365 * 24 * 3600 * 1000),
          batch_number: `BATCH-${Date.now()}`,
        },
      });

      await prisma.productBatch.create({
        data: {
          productId: product.id,
          stock: stockQty,
          batchNumber: `BATCH-${Date.now()}`,
          purchasePrice: p.hpp,
          inDate: new Date(),
          expiryDate: new Date(Date.now() + 365 * 24 * 3600 * 1000),
        },
      });

      products.push(product);
    }

    // Create Transactions (History)
    const today = new Date();
    const startDate = new Date(today.getTime() - 60 * 24 * 3600 * 1000); // 60 days ago

    for (let i = 0; i < 40; i++) {
      const txDate = randomDate(startDate, today);
      const customer = customers[randomInt(0, customers.length - 1)];
      const numItems = randomInt(1, 4);

      let total = 0;
      const items = [];

      for (let j = 0; j < numItems; j++) {
        const prod = products[randomInt(0, products.length - 1)];
        const qty = randomInt(1, 5);
        const lineTotal = prod.price * qty;
        total += lineTotal;

        items.push({
          productId: prod.id,
          quantity: qty,
          price: prod.price,
          original_price: prod.price,
          cost_price: prod.hpp_price || prod.purchase_price || 0,
        });
      }

      // Payment Logic
      const isDebt = Math.random() > 0.8; // 20% Debt
      const isPartial = !isDebt && Math.random() > 0.9;

      let payMethod = "CASH";
      let payStatus = "PAID";
      let paidParams = total;
      let remaining = 0;
      let dueDate = null;

      if (isDebt) {
        payMethod = "DEBT";
        payStatus = "UNPAID";
        paidParams = 0;
        remaining = total;
        dueDate = new Date(txDate.getTime() + 30 * 24 * 3600 * 1000); // Due 30 days later
      } else if (isPartial) {
        payMethod = "CASH";
        payStatus = "PARTIAL";
        paidParams = Math.floor(total * 0.5);
        remaining = total - paidParams;
        dueDate = new Date(txDate.getTime() + 14 * 24 * 3600 * 1000);
      }

      const tx = await prisma.transaction.create({
        data: {
          storeId: store.id,
          total: total,
          paymentMethod: payMethod,
          paymentStatus: payStatus,
          amountPaid: paidParams,
          remainingAmount: remaining,
          dueDate: dueDate,
          customerId: customer.id,
          createdAt: txDate,
          items: { create: items },
        },
      });

      // Create Debt Payment History if Partial or Debt that is now 'paid' (simulated)
      // For this seed, we'll just add a payment for some older debts
      if (isDebt && Math.random() > 0.5) {
        // Pay half of it 5 days later
        const payDate = new Date(txDate.getTime() + 5 * 24 * 3600 * 1000);
        if (payDate < today) {
          const payAmount = Math.floor(remaining * 0.5);
          await prisma.debtPayment.create({
            data: {
              transactionId: tx.id,
              amount: payAmount,
              paymentMethod: "TRANSFER",
              paidAt: payDate,
              notes: "Cicilan pertama",
            },
          });

          // Update transaction status
          await prisma.transaction.update({
            where: { id: tx.id },
            data: {
              amountPaid: { increment: payAmount },
              remainingAmount: { decrement: payAmount },
              paymentStatus: "PARTIAL",
            },
          });
        }
      }
    }

    // Create Expenses
    for (let m = 0; m < 3; m++) {
      const d = new Date();
      d.setMonth(d.getMonth() - m);

      await prisma.expense.create({
        data: {
          storeId: store.id,
          category: "RENT",
          amount: isMain ? 2000000 : 1000000,
          description: "Sewa Ruko",
          date: d,
          createdById: staff.id,
        },
      });

      await prisma.expense.create({
        data: {
          storeId: store.id,
          category: "SALARY",
          amount: isMain ? 4500000 : 3000000,
          description: "Gaji Pegawai",
          date: d,
          createdById: staff.id,
        },
      });
    }

    // Create Purchase Order (Draft & Received)
    const poSupplier = suppliers[0];
    const poProduct = products[0];

    // 1. Completed PO
    await prisma.purchaseOrder.create({
      data: {
        poNumber: `PO-${store.id.substring(0, 4)}-001`,
        storeId: store.id,
        supplierId: poSupplier.id,
        status: "received",
        paymentStatus: "PAID",
        totalAmount: 5000000,
        amountPaid: 5000000,
        items: {
          create: {
            productId: poProduct.id,
            quantity: 50,
            price: 100000,
            receivedQuantity: 50,
          },
        },
      },
    });

    // 2. Draft PO (Simulasi Hutang Jatuh Tempo)
    await prisma.purchaseOrder.create({
      data: {
        poNumber: `PO-${store.id.substring(0, 4)}-002`,
        storeId: store.id,
        supplierId: poSupplier.id,
        status: "draft",
        paymentStatus: "UNPAID",
        totalAmount: 2000000,
        remainingAmount: 2000000, // Harus diset agar muncul di daftar hutang
        dueDate: new Date(Date.now() - 2 * 24 * 3600 * 1000), // Jatuh tempo 2 hari lalu (Overdue)
        items: {
          create: {
            productId: products[1].id,
            quantity: 20,
            price: 100000,
            receivedQuantity: 0,
          },
        },
      },
    });

    // 3. Low Stock Simulation
    const lowStockProduct = products[2]; // Jagung Giling
    await prisma.product.update({
      where: { id: lowStockProduct.id },
      data: {
        stock: 5, // Below threshold 10
        threshold: 10,
      },
    });

    // Update batch to match low stock
    const batch = await prisma.productBatch.findFirst({ where: { productId: lowStockProduct.id } });
    if (batch) {
      await prisma.productBatch.update({
        where: { id: batch.id },
        data: { stock: 5 },
      });
    }

    // 4. Expired Product Simulation
    const expiredProduct = products[3]; // Dedak Padi
    const expiredBatch = await prisma.productBatch.findFirst({ where: { productId: expiredProduct.id } });
    if (expiredBatch) {
      await prisma.productBatch.update({
        where: { id: expiredBatch.id },
        data: {
          expiryDate: new Date(Date.now() + 2 * 24 * 3600 * 1000), // Expire in 2 days
        },
      });
      // Update product expiry too for consistency
      await prisma.product.update({
        where: { id: expiredProduct.id },
        data: { expiry_date: new Date(Date.now() + 2 * 24 * 3600 * 1000) },
      });
    }

    return store;
  }

  // --- EXECUTE SEEDING ---

  // 1. Create Main Store
  const mainStore = await seedStore("Toko Utama (Pusat)", "Jl. Peternakan Raya No. 1", true);

  // 2. Create Branch Store (To test RLS)
  const branchStore = await seedStore("Toko Cabang (Barat)", "Jl. Kebon Jeruk No. 88", false);

  // 3. Create Super Owner (Access to Main Store initially, but conceptually owns all)
  console.log("👤 Creating Super Owner...");

  const owner = await prisma.user.create({
    data: {
      email: "owner@feedly.com",
      name: "Budi Owner",
      password,
      role: "OWNER",
      storeId: mainStore.id, // Default login store
    },
  });

  // Give owner access to BOTH stores
  await prisma.storeAccess.create({
    data: { userId: owner.id, storeId: mainStore.id, role: "OWNER" },
  });

  await prisma.storeAccess.create({
    data: { userId: owner.id, storeId: branchStore.id, role: "OWNER" },
  });

  console.log("✅ Comprehensive seed completed!");
  console.log(`🔑 Credentials:
  - Owner: owner@feedly.com (Access All)
  - Kasir Pusat: kasir.pusat@feedly.com (Access Toko Utama only)
  - Kasir Cabang: kasir.cabang@feedly.com (Access Toko Cabang only)
  - Password: password123
  `);
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
