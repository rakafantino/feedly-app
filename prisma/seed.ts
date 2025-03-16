import { PrismaClient, Role } from '@prisma/client';
import { hash } from 'bcrypt';

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
  
  console.log('✅ Data berhasil dihapus');
  console.log('🌱 Memulai seeding data baru...');

  // ------------------- USERS -------------------
  console.log('👤 Membuat users...');
  
  const password = await hash('password123', 10);
  
  const manager = await prisma.user.create({
    data: {
      email: 'manager@tokokita.com',
      name: 'Budi Santoso',
      password,
      role: Role.MANAGER,
    },
  });

  const cashier1 = await prisma.user.create({
    data: {
      email: 'kasir1@tokokita.com',
      name: 'Dewi Lestari',
      password,
      role: Role.CASHIER,
    },
  });

  const cashier2 = await prisma.user.create({
    data: {
      email: 'kasir2@tokokita.com',
      name: 'Ahmad Rizki',
      password,
      role: Role.CASHIER,
    },
  });

  console.log(`✅ Users dibuat: ${manager.name}, ${cashier1.name}, ${cashier2.name}`);

  // ------------------- SUPPLIERS -------------------
  console.log('🏭 Membuat suppliers...');
  
  const suppliers = [
    {
      name: 'PT Pakan Ternak Nusantara',
      email: 'sales@pakanternaknusantara.co.id',
      phone: '0218765432',
      address: 'Jl. Industri Pakan No. 123, Bekasi, Jawa Barat',
    },
    {
      name: 'CV Nutrisi Hewan Indonesia',
      email: 'order@nutrisihewan.id',
      phone: '0227654321',
      address: 'Jl. Nutrisi Hewan No. 45, Bandung, Jawa Barat',
    },
    {
      name: 'PT Agri Supply Makmur',
      email: 'contact@agrisupply.co.id',
      phone: '0318976543',
      address: 'Jl. Raya Agribisnis No. 67, Surabaya, Jawa Timur',
    },
    {
      name: 'UD Vitamin Ternak Sejahtera',
      email: 'info@vitaminternak.com',
      phone: '0248765432',
      address: 'Jl. Vitamin Unggas No. 89, Semarang, Jawa Tengah',
    },
    {
      name: 'PT Medika Hewan Indonesia',
      email: 'sales@medikahewan.com',
      phone: '0274654321',
      address: 'Jl. Kesehatan Hewan No. 32, Yogyakarta, DI Yogyakarta',
    }
  ];

  const createdSuppliers = [];
  for (const supplier of suppliers) {
    const result = await prisma.supplier.create({
      data: supplier,
    });
    createdSuppliers.push(result);
    console.log(`✅ Supplier dibuat: ${result.name}`);
  }

  // ------------------- PRODUCTS -------------------
  console.log('🛒 Membuat products...');
  
  const products = [
    // Pakan Ayam
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
    },
    {
      name: 'Pakan Ayam Grower',
      category: 'Pakan Ayam',
      price: 72000,
      purchase_price: 60000,
      stock: 38,
      unit: 'karung',
      description: 'Pakan unggas untuk ayam usia 5-12 minggu',
      threshold: 10,
      supplierId: createdSuppliers[0].id,
    },
    {
      name: 'Pakan Ayam Layer',
      category: 'Pakan Ayam',
      price: 82000,
      purchase_price: 67000,
      stock: 32,
      unit: 'karung',
      description: 'Pakan untuk ayam petelur usia >12 minggu',
      threshold: 10,
      supplierId: createdSuppliers[0].id,
    },
    {
      name: 'Pakan Ayam Broiler',
      category: 'Pakan Ayam',
      price: 76000,
      purchase_price: 62000,
      stock: 28,
      unit: 'karung',
      description: 'Pakan untuk ayam pedaging dengan pertumbuhan cepat',
      threshold: 10,
      supplierId: createdSuppliers[1].id,
    },
    
    // Pakan Sapi
    {
      name: 'Pakan Sapi Perah Pro Milk',
      category: 'Pakan Sapi',
      price: 92000,
      purchase_price: 76000,
      stock: 24,
      unit: 'karung',
      description: 'Pakan khusus untuk sapi perah dengan kandungan nutrisi tinggi',
      threshold: 8,
      supplierId: createdSuppliers[1].id,
    },
    {
      name: 'Pakan Sapi Penggemukan',
      category: 'Pakan Sapi',
      price: 97000,
      purchase_price: 81000,
      stock: 27,
      unit: 'karung',
      description: 'Pakan sapi untuk penggemukan optimal',
      threshold: 8,
      supplierId: createdSuppliers[1].id,
    },
    {
      name: 'Konsentrat Sapi',
      category: 'Pakan Sapi',
      price: 88000,
      purchase_price: 72000,
      stock: 35,
      unit: 'karung',
      description: 'Konsentrat nutrisi untuk sapi',
      threshold: 10,
      supplierId: createdSuppliers[2].id,
    },
    
    // Pakan Kambing
    {
      name: 'Pakan Kambing Premium',
      category: 'Pakan Kambing',
      price: 68000,
      purchase_price: 55000,
      stock: 40,
      unit: 'karung',
      description: 'Pakan berkualitas tinggi untuk kambing',
      threshold: 12,
      supplierId: createdSuppliers[2].id,
    },
    {
      name: 'Pakan Kambing Perah',
      category: 'Pakan Kambing',
      price: 73000,
      purchase_price: 60000,
      stock: 32,
      unit: 'karung',
      description: 'Pakan khusus untuk kambing perah',
      threshold: 8,
      supplierId: createdSuppliers[2].id,
    },
    
    // Vitamin
    {
      name: 'Vitamin Ayam Multi Nutrient',
      category: 'Vitamin',
      price: 38000,
      purchase_price: 28000,
      stock: 95,
      unit: 'botol',
      description: 'Vitamin lengkap untuk pertumbuhan ayam optimal',
      threshold: 20,
      supplierId: createdSuppliers[3].id,
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
      supplierId: createdSuppliers[3].id,
    },
    {
      name: 'Vitamin Kambing Complete',
      category: 'Vitamin',
      price: 42000,
      purchase_price: 32000,
      stock: 68,
      unit: 'botol',
      description: 'Vitamin lengkap untuk kambing',
      threshold: 15,
      supplierId: createdSuppliers[3].id,
    },
    
    // Obat
    {
      name: 'Obat Cacing Unggas',
      category: 'Obat',
      price: 43000,
      purchase_price: 32000,
      stock: 58,
      unit: 'botol',
      description: 'Obat cacing untuk unggas',
      threshold: 12,
      supplierId: createdSuppliers[4].id,
    },
    {
      name: 'Obat Cacing Ternak',
      category: 'Obat',
      price: 53000,
      purchase_price: 42000,
      stock: 48,
      unit: 'botol',
      description: 'Obat cacing untuk ternak ruminansia',
      threshold: 10,
      supplierId: createdSuppliers[4].id,
    },
    {
      name: 'Antiseptik Kandang',
      category: 'Obat',
      price: 65000,
      purchase_price: 48000,
      stock: 42,
      unit: 'galon',
      description: 'Cairan antiseptik untuk sanitasi kandang',
      threshold: 8,
      supplierId: createdSuppliers[4].id,
    },
    
    // Peralatan
    {
      name: 'Tempat Pakan Ayam',
      category: 'Peralatan',
      price: 35000,
      purchase_price: 24000,
      stock: 30,
      unit: 'buah',
      description: 'Tempat pakan untuk ayam kapasitas 2kg',
      threshold: 5,
      supplierId: createdSuppliers[2].id,
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
      supplierId: createdSuppliers[2].id,
    },
    
    // Pakan Ikan
    {
      name: 'Pakan Ikan Lele',
      category: 'Pakan Ikan',
      price: 45000,
      purchase_price: 34000,
      stock: 55,
      unit: 'karung',
      description: 'Pakan untuk budidaya ikan lele',
      threshold: 10,
      supplierId: createdSuppliers[0].id,
    },
    {
      name: 'Pakan Ikan Nila',
      category: 'Pakan Ikan',
      price: 48000,
      purchase_price: 36000,
      stock: 48,
      unit: 'karung',
      description: 'Pakan untuk budidaya ikan nila',
      threshold: 10,
      supplierId: createdSuppliers[0].id,
    }
  ];

  const createdProducts = [];
  for (const product of products) {
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
    console.log(`✅ Product dibuat: ${result.name}`);
  }

  // ------------------- TRANSACTIONS -------------------
  console.log('💰 Membuat data transaksi...');
  
  // Metode pembayaran
  const paymentMethods = ['CASH', 'TRANSFER', 'QRIS', 'CREDIT'];
  
  // Data pelanggan tetap (meskipun tidak ada dalam database, kita bisa referensikan di paymentDetails)
  const regularCustomers = [
    { name: 'Pak Joko', farm: 'Peternakan Ayam Sumber Rezeki', phone: '081234567890' },
    { name: 'Bu Siti', farm: 'Peternakan Sapi Makmur Jaya', phone: '085678901234' },
    { name: 'Pak Budi', farm: 'Peternakan Kambing Berkah', phone: '089876543210' },
    { name: 'Pak Hasan', farm: 'Peternakan Lele Subur', phone: '082345678901' },
    { name: 'Bu Dewi', farm: 'Peternakan Ayam Petelur Barokah', phone: '087654321098' }
  ];
  
  // Buat beberapa tanggal transaksi dari April 2024 hingga Maret 2025
  const transactionDates = [];
  
  // Bulan April 2024 - Maret 2025 (tanggal acak untuk setiap bulan)
  for (let month = 3; month <= 14; month++) {
    const year = month <= 11 ? 2024 : 2025;
    const adjustedMonth = month <= 11 ? month : month - 12;
    
    // Tentukan jumlah transaksi per bulan (lebih banyak di bulan tertentu)
    // Musim panen/peternak aktif: Juni-Agustus dan Desember-Januari
    let transPerMonth;
    if ([5, 6, 7, 11, 0].includes(adjustedMonth)) { // Bulan sibuk
      transPerMonth = 12 + Math.floor(Math.random() * 8); // 12-20 transaksi
    } else {
      transPerMonth = 6 + Math.floor(Math.random() * 6); // 6-12 transaksi
    }
    
    // Buat tanggal acak dalam bulan tersebut
    for (let i = 0; i < transPerMonth; i++) {
      const maxDay = new Date(year, adjustedMonth + 1, 0).getDate(); // Hari terakhir dalam bulan
      const day = Math.floor(1 + Math.random() * maxDay);
      
      // Jangan buat transaksi lebih dari 17 Maret 2025
      if (year === 2025 && adjustedMonth === 2 && day > 17) continue;
      
      const date = new Date(year, adjustedMonth, day);
      transactionDates.push(date);
    }
  }
  
  // Urutkan tanggal dari yang paling awal
  transactionDates.sort((a, b) => a.getTime() - b.getTime());
  
  // Fungsi untuk mendapatkan diskon berdasarkan jumlah item dan total
  function getDiscount(itemCount: number, total: number) {
    // Program diskon:
    // - Beli 5+ item: diskon 2%
    // - Beli 10+ item: diskon 5%
    // - Total belanja > 500rb: diskon 3%
    // - Total belanja > 1jt: diskon 7%
    // - Diskon ini bisa kumulatif
    
    let discount = 0;
    
    if (itemCount >= 10) {
      discount += 0.05;
    } else if (itemCount >= 5) {
      discount += 0.02;
    }
    
    if (total >= 1000000) {
      discount += 0.07;
    } else if (total >= 500000) {
      discount += 0.03;
    }
    
    return Math.round(total * discount);
  }

  // Untuk melacak tren pembelian musiman
  const seasonalProducts = {
    // Produk yang lebih laris di musim hujan (Oktober-Maret)
    rainySeasonProducts: [
      'Obat Cacing Unggas', 'Obat Cacing Ternak', 'Antiseptik Kandang'
    ],
    // Produk yang lebih laris di musim kemarau (April-September)
    drySeasonProducts: [
      'Vitamin Ayam Multi Nutrient', 'Vitamin Kambing Complete', 'Vitamin Sapi Calcium Plus'
    ]
  };
  
  // Untuk pelacakan inventaris
  const inventoryTracking: Record<string, number> = {};
  createdProducts.forEach(product => {
    inventoryTracking[product.id] = product.stock;
  });
  
  console.log('Total transaksi yang akan dibuat:', transactionDates.length);

  // Buat transaksi untuk setiap tanggal
  for (let i = 0; i < transactionDates.length; i++) {
    const date = transactionDates[i];
    
    // Cek musim untuk preferensi produk
    const month = date.getMonth();
    const isRainySeason = month >= 9 || month <= 2; // Oktober-Maret
    
    // Pilih 1-5 produk acak untuk transaksi ini, dengan preferensi musiman
    let itemCount = Math.floor(1 + Math.random() * 5);
    
    // 10% kemungkinan pembelian besar (5-10 item)
    if (Math.random() < 0.1) {
      itemCount = Math.floor(5 + Math.random() * 6);
    }
    
    // Pelanggan tetap untuk transaksi ini? (40% kemungkinan)
    const isRegularCustomer = Math.random() < 0.4;
    const customer = isRegularCustomer ? 
      regularCustomers[Math.floor(Math.random() * regularCustomers.length)] : 
      null;
    
    const selectedProducts: { productId: string; quantity: number; price: number }[] = [];
    let total = 0;
    let totalItemQty = 0;
    
    // Jika pelanggan tetap, ada pola pembelian tertentu
    const preferredCategories = isRegularCustomer ? 
      customer!.farm.toLowerCase().includes('ayam') ? ['Pakan Ayam', 'Vitamin'] :
      customer!.farm.toLowerCase().includes('sapi') ? ['Pakan Sapi', 'Vitamin'] :
      customer!.farm.toLowerCase().includes('kambing') ? ['Pakan Kambing', 'Vitamin'] :
      customer!.farm.toLowerCase().includes('lele') ? ['Pakan Ikan'] :
      ['Vitamin', 'Obat'] : 
      [];
    
    // Daftar semua produk yang akan dipertimbangkan untuk transaksi ini
    let consideredProducts = [...createdProducts];
    
    // Filter produk berdasarkan musim dan preferensi
    if (isRainySeason) {
      // Tingkatkan probabilitas produk musim hujan
      consideredProducts.sort((a, b) => {
        const aIsRainy = seasonalProducts.rainySeasonProducts.includes(a.name) ? 1 : 0;
        const bIsRainy = seasonalProducts.rainySeasonProducts.includes(b.name) ? 1 : 0;
        return bIsRainy - aIsRainy;
      });
    } else {
      // Tingkatkan probabilitas produk musim kemarau
      consideredProducts.sort((a, b) => {
        const aIsDry = seasonalProducts.drySeasonProducts.includes(a.name) ? 1 : 0;
        const bIsDry = seasonalProducts.drySeasonProducts.includes(b.name) ? 1 : 0;
        return bIsDry - aIsDry;
      });
    }
    
    // Jika pelanggan tetap, prioritaskan kategori yang mereka sukai
    if (isRegularCustomer && preferredCategories.length > 0) {
      consideredProducts.sort((a, b) => {
        const aIsPreferred = preferredCategories.includes(a.category) ? 1 : 0;
        const bIsPreferred = preferredCategories.includes(b.category) ? 1 : 0;
        return bIsPreferred - aIsPreferred;
      });
    }
    
    // Acak lagi agar tidak selalu sama
    consideredProducts = consideredProducts.map(p => ({ p, sort: Math.random() }))
      .sort((a, b) => a.sort - b.sort)
      .map(({ p }) => p);
    
    for (let j = 0; j < Math.min(itemCount, consideredProducts.length); j++) {
      const randomProduct = consideredProducts[j];
      
      // Periksa apakah produk sudah ada di transaksi
      if (!selectedProducts.find(p => p.productId === randomProduct.id)) {
        // Tentukan quantity yang realistis berdasarkan jenis produk
        let quantity;
        
        if (randomProduct.category.includes('Pakan')) {
          // Pakan biasanya dibeli dalam jumlah lebih besar
          quantity = Math.floor(1 + Math.random() * 5);
          
          // Pelanggan tetap kadang membeli dalam jumlah besar
          if (isRegularCustomer && preferredCategories.includes(randomProduct.category) && Math.random() < 0.3) {
            quantity += Math.floor(Math.random() * 5);
          }
        } else if (randomProduct.category === 'Vitamin' || randomProduct.category === 'Obat') {
          // Vitamin dan obat biasanya dibeli dalam jumlah kecil
          quantity = Math.floor(1 + Math.random() * 3);
        } else {
          // Kategori lain (peralatan dll)
          quantity = Math.floor(1 + Math.random() * 2);
        }
        
        // Pastikan tidak melebihi stok yang tersedia
        if (quantity > inventoryTracking[randomProduct.id]) {
          quantity = inventoryTracking[randomProduct.id];
        }
        
        // Hanya tambahkan jika kuantitas > 0
        if (quantity > 0) {
          // Hitung subtotal
          const subtotal = randomProduct.price * quantity;
          total += subtotal;
          totalItemQty += quantity;
          
          // Kurangi stok dalam pelacakan inventaris
          inventoryTracking[randomProduct.id] -= quantity;
          
          selectedProducts.push({
            productId: randomProduct.id,
            quantity,
            price: randomProduct.price
          });
        }
      }
    }
    
    // Jika tidak ada produk yang dipilih, lewati transaksi ini
    if (selectedProducts.length === 0) continue;
    
    // Hitung diskon jika ada
    const discount = getDiscount(totalItemQty, total);
    const finalTotal = total - discount;
    
    // Pilih metode pembayaran
    // Pelanggan tetap lebih sering menggunakan transfer atau kredit
    let paymentMethod;
    if (isRegularCustomer) {
      paymentMethod = Math.random() < 0.7 ? 
        (Math.random() < 0.6 ? 'TRANSFER' : 'CREDIT') : 
        (Math.random() < 0.5 ? 'CASH' : 'QRIS');
    } else {
      paymentMethod = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];
    }
    
    // Buat detail pembayaran yang lebih informatif
    let paymentDetails = '';
    
    if (paymentMethod === 'CASH') {
      paymentDetails = 'Pembayaran tunai';
    } else if (paymentMethod === 'TRANSFER') {
      const banks = ['BCA', 'BRI', 'BNI', 'Mandiri', 'BSI'];
      const bank = banks[Math.floor(Math.random() * banks.length)];
      paymentDetails = `Transfer ${bank}`;
      
      // Tambahkan nama pengirim untuk pelanggan tetap
      if (isRegularCustomer) {
        paymentDetails += ` (${customer!.name})`;
      }
    } else if (paymentMethod === 'QRIS') {
      const ewallet = ['GoPay', 'OVO', 'DANA', 'LinkAja', 'ShopeePay'];
      paymentDetails = `QRIS - ${ewallet[Math.floor(Math.random() * ewallet.length)]}`;
    } else { // CREDIT
      const banks = ['BCA', 'BRI', 'BNI', 'Mandiri', 'CIMB Niaga'];
      paymentDetails = `Kartu Kredit ${banks[Math.floor(Math.random() * banks.length)]}`;
      
      // Tambahkan nama kartu untuk pelanggan tetap
      if (isRegularCustomer) {
        paymentDetails += ` (${customer!.name})`;
      }
    }
    
    // Tambahkan informasi pelanggan tetap ke detail pembayaran
    if (isRegularCustomer) {
      paymentDetails += ` - ${customer!.farm} - ${customer!.phone}`;
    }
    
    // Tambahkan informasi diskon jika ada
    if (discount > 0) {
      paymentDetails += ` - Diskon Rp ${discount.toLocaleString('id-ID')}`;
    }
    
    // Buat transaksi
    const transaction = await prisma.transaction.create({
      data: {
        total: finalTotal,
        paymentMethod,
        paymentDetails,
        createdAt: date,
        updatedAt: date,
        items: {
          create: selectedProducts
        }
      },
      include: {
        items: true
      }
    });
    
    console.log(`✅ Transaksi dibuat: ${date.toLocaleDateString('id-ID')} - ID ${transaction.id.substring(0, 8)}... - ${transaction.items.length} item, total: Rp ${finalTotal.toLocaleString('id-ID')}`);
  }

  // ------------------- PURCHASE ORDERS -------------------
  console.log('📦 Membuat purchase orders...');
  
  const poStatuses = ['draft', 'sent', 'processing', 'completed', 'cancelled'];
  const poStatusWeights = [0.1, 0.2, 0.3, 0.3, 0.1]; // Probabilitas untuk setiap status
  
  // Fungsi untuk memilih status berdasarkan bobot
  function weightedRandomStatus() {
    const random = Math.random();
    let sum = 0;
    
    for (let i = 0; i < poStatuses.length; i++) {
      sum += poStatusWeights[i];
      if (random < sum) return poStatuses[i];
    }
    
    return poStatuses[poStatuses.length - 1];
  }
  
  // Buat purchase orders
  const poDates = [
    new Date(2024, 0, 10), // Jan 10, 2024
    new Date(2024, 0, 25), // Jan 25, 2024
    new Date(2024, 1, 8),  // Feb 8, 2024
    new Date(2024, 1, 22), // Feb 22, 2024
    new Date(2024, 2, 7),  // Mar 7, 2024
    new Date(2024, 2, 20), // Mar 20, 2024
    new Date(2024, 3, 5),  // Apr 5, 2024
  ];
  
  for (let i = 0; i < poDates.length; i++) {
    const date = poDates[i];
    const supplierId = createdSuppliers[Math.floor(Math.random() * createdSuppliers.length)].id;
    
    // Pilih produk dari supplier yang sama
    const supplierProducts = createdProducts.filter(p => p.supplierId === supplierId);
    
    // Jika supplier memiliki produk
    if (supplierProducts.length > 0) {
      // Pilih 1-4 produk acak dari supplier ini
      const itemCount = Math.floor(1 + Math.random() * Math.min(4, supplierProducts.length));
      const shuffled = [...supplierProducts].sort(() => 0.5 - Math.random());
      const selectedProducts = shuffled.slice(0, itemCount);
      
      // Buat PO dengan setiap item
      const poItems = selectedProducts.map(product => ({
        product: { connect: { id: product.id } },
        quantity: Math.floor(5 + Math.random() * 16),
        price: product.purchase_price || 0, // Fallback ke 0 jika purchase_price null
        unit: product.unit
      }));
      
      // Pilih status PO
      const status = weightedRandomStatus();
      
      // Tentukan tanggal estimasi pengiriman (7-14 hari dari tanggal PO)
      const estDelivery = new Date(date);
      estDelivery.setDate(estDelivery.getDate() + Math.floor(7 + Math.random() * 8));
      
      // Buat PO
      const purchaseOrder = await prisma.purchaseOrder.create({
        data: {
          poNumber: `PO-${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${(i + 1).toString().padStart(3, '0')}`,
          supplierId,
          status,
          createdAt: date,
          updatedAt: date,
          estimatedDelivery: estDelivery,
          notes: status === 'cancelled' 
            ? 'Dibatalkan karena perubahan kebutuhan stok' 
            : status === 'completed'
              ? 'Barang telah diterima dengan lengkap'
              : 'Mohon dikirim sesuai jadwal',
          items: {
            create: poItems
          }
        }
      });
      
      console.log(`✅ Purchase Order dibuat: ${purchaseOrder.poNumber} dengan status ${status}`);
    }
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