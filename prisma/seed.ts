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

// --- MAIN ---

async function main() {
  console.log("🗑️  Clearing existing data...");

  // Delete all data to start fresh
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

  // 1. STORES
  console.log("🏪 Creating stores...");
  const mainStore = await prisma.store.create({
    data: {
      name: "Toko Utama (Pusat)",
      address: "Jl. Peternakan Raya No. 1, Jakarta",
      phone: "021-99887766",
      dailyTarget: 5000000,
      monthlyTarget: 150000000,
    },
  });

  // 2. USERS
  console.log("👤 Creating users...");
  const password = await hash("password123", 10);
  
  const owner = await prisma.user.create({
    data: {
      email: "owner@feedly.com",
      name: "Budi Owner",
      password,
      role: "OWNER",
      storeId: mainStore.id,
    }
  });

  await prisma.storeAccess.create({
    data: { userId: owner.id, storeId: mainStore.id, role: "OWNER" }
  });

  const cashier = await prisma.user.create({
    data: {
      email: "kasir@feedly.com",
      name: "Siti Kasir",
      password,
      role: "CASHIER",
      storeId: mainStore.id,
    }
  });

  await prisma.storeAccess.create({
    data: { userId: cashier.id, storeId: mainStore.id, role: "CASHIER" }
  });

  // 3. SUPPLIERS
  console.log("🏭 Creating suppliers...");
  const suppliers = await Promise.all([
    prisma.supplier.create({ data: { name: "PT. Charoen Pokphand", code: "SUP-CP", storeId: mainStore.id, email: "sales@cp.co.id", phone: "021-111111" } }),
    prisma.supplier.create({ data: { name: "PT. Japfa Comfeed", code: "SUP-JC", storeId: mainStore.id, email: "orders@japfa.com", phone: "021-222222" } }),
    prisma.supplier.create({ data: { name: "CV. Makmur Jaya", code: "SUP-MJ", storeId: mainStore.id, email: "admin@makmur.co.id", phone: "021-333333" } }),
    prisma.supplier.create({ data: { name: "UD. Tani Sejahtera", code: "SUP-TS", storeId: mainStore.id, email: "sales@tanisejahtera.com", phone: "021-444444" } }),
  ]);

  // 4. CUSTOMERS
  console.log("👥 Creating customers...");
  const customers = await Promise.all([
    prisma.customer.create({ data: { name: "Pak Haji Slamet", phone: "08123456789", address: "Desa Sukamaju", storeId: mainStore.id } }),
    prisma.customer.create({ data: { name: "Bu Tejo (Warung)", phone: "08987654321", address: "Desa Sukamiskin", storeId: mainStore.id } }),
    prisma.customer.create({ data: { name: "Kang Asep Peternak", phone: "081122334455", address: "Kampung Durian", storeId: mainStore.id } }),
    prisma.customer.create({ data: { name: "Pak Yanto Lele", phone: "085566778899", address: "Kolam Ikan Jaya", storeId: mainStore.id } }),
    prisma.customer.create({ data: { name: "Ibu Sri Katering", phone: "087788990011", address: "Perum Indah", storeId: mainStore.id } }),
  ]);

  // 5. PRODUCTS
  console.log("📦 Creating diverse products...");
  
  const productData = [
    { name: "Pakan Ayam Broiler (Karung 50kg)", category: "Pakan", unit: "SAC", price: 380000, hpp: 350000, stock: 100, supplier: 0 },
    { name: "Pakan Bebek Petelur (Karung 50kg)", category: "Pakan", unit: "SAC", price: 410000, hpp: 375000, stock: 80, supplier: 0 },
    { name: "Jagung Giling Halus (KG)", category: "Bahan Baku", unit: "KG", price: 8500, hpp: 6000, stock: 500, supplier: 3 },
    { name: "Dedak Padi Super (KG)", category: "Bahan Baku", unit: "KG", price: 4500, hpp: 3000, stock: 1000, supplier: 3 },
    { name: "Vitamin VitaChicks (Sachet 5g)", category: "Obat & Vitamin", unit: "PCS", price: 5000, hpp: 3500, stock: 200, supplier: 1 },
    { name: "NeoBro Penambah Bobot (Sachet)", category: "Obat & Vitamin", unit: "PCS", price: 6000, hpp: 4000, stock: 150, supplier: 1 },
    { name: "Tempat Minum Ayam (1 Galon)", category: "Peralatan", unit: "PCS", price: 35000, hpp: 25000, stock: 50, supplier: 2 },
    { name: "Tempat Makan Ayam (5 KG)", category: "Peralatan", unit: "PCS", price: 45000, hpp: 32000, stock: 40, supplier: 2 },
    { name: "Desinfektan Kandang (1 Liter)", category: "Kebersihan", unit: "BTL", price: 75000, hpp: 55000, stock: 30, supplier: 1 },
    { name: "Sekop Kotoran Besi", category: "Peralatan", unit: "PCS", price: 55000, hpp: 40000, stock: 15, supplier: 2 },
    { name: "Pakan Ikan Lele (Karung 30kg)", category: "Pakan", unit: "SAC", price: 280000, hpp: 250000, stock: 60, supplier: 0 },
    { name: "Probiotik Ikan (Botol 1L)", category: "Obat & Vitamin", unit: "BTL", price: 90000, hpp: 70000, stock: 25, supplier: 1 },
  ];

  const products = [];

  for (const p of productData) {
    const product = await prisma.product.create({
      data: {
        product_code: `PRD-${Date.now()}-${randomInt(100, 999)}`,
        name: p.name,
        category: p.category,
        unit: p.unit,
        price: p.price,
        purchase_price: p.hpp, // Base purchase
        hpp_price: p.hpp, // HPP same as purchase for seed simplicity
        min_selling_price: p.hpp * 1.05,
        stock: p.stock,
        threshold: 10,
        description: `Stok awal untuk ${p.name}`,
        storeId: mainStore.id,
        supplierId: suppliers[p.supplier].id,
        barcode: generateBarcode(),
        hppCalculationDetails: { costs: [] },
        purchase_date: new Date(),
        expiry_date: new Date(Date.now() + 365*24*3600*1000),
        batch_number: `BATCH-${Date.now()}`,
      }
    });

    // Create Initial Batch for each product to satisfy stock logic
    await prisma.productBatch.create({
      data: {
        productId: product.id,
        stock: p.stock,
        batchNumber: `BATCH-${Date.now()}`,
        purchasePrice: p.hpp,
        inDate: new Date(),
        expiryDate: new Date(Date.now() + 365*24*3600*1000),
      }
    });

    products.push(product);
  }

  // 6. HISTORICAL TRANSACTIONS (Last 60 Days)
  console.log("💰 Generating 50+ historical transactions...");
  
  const today = new Date();
  const startDate = new Date(today.getTime() - 60 * 24 * 3600 * 1000); // 60 days ago

  for (let i = 0; i < 60; i++) {
    // Generate dates from past to present
    const txDate = randomDate(startDate, today);
    const customer = customers[randomInt(0, customers.length - 1)];
    const numItems = randomInt(1, 4);
    
    let total = 0;
    const items = [];

    for (let j = 0; j < numItems; j++) {
      const prod = products[randomInt(0, products.length - 1)];
      const qty = randomInt(1, 5);
      // Small chance of discount on item price logic (not implemented here, keeping simple)
      
      const lineTotal = prod.price * qty;


      total += lineTotal;


      items.push({
        productId: prod.id,
        quantity: qty,
        price: prod.price,
        original_price: prod.price, // Assuming no item-level discount for simplicity
        cost_price: prod.hpp_price || prod.purchase_price || 0,
      });
    }

    // Randomize payment method & status
    const isDebt = Math.random() > 0.8; // 20% Debt
    const isPartial = !isDebt && Math.random() > 0.9; // 10% Partial if not Debt
    const discount = Math.random() > 0.7 ? randomInt(5000, 50000) : 0; // 30% chance of discount
    
    // Ensure discount doesn't exceed total
    const finalDiscount = discount > total * 0.2 ? 0 : discount;
    const netTotal = total - finalDiscount;

    let payMethod = "CASH";
    let payStatus = "PAID";
    let paidParams = netTotal;
    let remaining = 0;

    if (isDebt) {
      payMethod = "DEBT";
      payStatus = "UNPAID";
      paidParams = 0;
      remaining = netTotal;
    } else if (isPartial) {
      payMethod = "CASH"; // Initial
      payStatus = "PARTIAL";
      paidParams = Math.floor(netTotal * 0.5);
      remaining = netTotal - paidParams;
    } else {
       // Random other methods
       const methodRand = Math.random();
       if (methodRand > 0.6) payMethod = "TRANSFER";
       else if (methodRand > 0.9) payMethod = "QRIS";
    }

    await prisma.transaction.create({
      data: {
        storeId: mainStore.id,
        total: netTotal, // Should be gross total stored? Schema says total is final amount usually, but let's stick to concept: total usually means subtotal in some systems but here likely Net. Let's act consistent with service.
        // Re-reading service: total is NET. Discount is just record.
        // Wait, in CheckoutModal: total passed is final.
        // Correct approach: total = netTotal.
        discount: finalDiscount,
        paymentMethod: payMethod,
        paymentStatus: payStatus,
        amountPaid: paidParams,
        remainingAmount: remaining,
        customerId: customer.id,
        createdAt: txDate, // Backdated
        items: {
          create: items
        }
      }
    });
  }

  // 7. OPERATIONAL EXPENSES HISTORY
  console.log("💸 Generating expenses...");
  for (let m = 0; m < 3; m++) {
    const d = new Date();
    d.setMonth(d.getMonth() - m);
    
    await prisma.expense.create({
      data: {
        storeId: mainStore.id,
        category: "RENT",
        amount: 2000000,
        description: `Sewa Ruko`,
        date: d,
        createdById: owner.id,
      }
    });

    await prisma.expense.create({
      data: {
        storeId: mainStore.id,
        category: "SALARY",
        amount: 4500000,
        description: `Gaji Pegawai`,
        date: d,
        createdById: owner.id,
      }
    });
    
    // Random Utilities
    await prisma.expense.create({
        data: {
          storeId: mainStore.id,
          category: "UTILITIES",
          amount: randomInt(300000, 500000),
          description: `Listrik & Air`,
          date: d,
          createdById: owner.id,
        }
      });
  }

  console.log("✅ Comprehensive seed completed!");
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
