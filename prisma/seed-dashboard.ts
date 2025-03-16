import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
  
  return discount;
}

async function main() {
  console.log('🗑️ Menghapus data transaksi yang ada...');
  
  // Hapus semua data transaksi
  await prisma.transactionItem.deleteMany({});
  await prisma.transaction.deleteMany({});
  
  console.log('✅ Data transaksi berhasil dihapus');
  console.log('🌱 Memulai seeding data transaksi baru...');

  // PERSIAPAN DATA DASAR
  
  // Metode pembayaran
  const paymentMethods = ['CASH', 'TRANSFER', 'QRIS', 'CREDIT'];
  
  // Data pelanggan tetap
  const regularCustomers = [
    { name: 'Pak Joko', farm: 'Peternakan Ayam Sumber Rezeki', phone: '081234567890' },
    { name: 'Bu Siti', farm: 'Peternakan Sapi Makmur Jaya', phone: '085678901234' },
    { name: 'Pak Budi', farm: 'Peternakan Kambing Berkah', phone: '089876543210' },
    { name: 'Pak Hasan', farm: 'Peternakan Lele Subur', phone: '082345678901' },
    { name: 'Bu Dewi', farm: 'Peternakan Ayam Petelur Barokah', phone: '087654321098' }
  ];
  
  // Ambil semua produk dari database
  const products = await prisma.product.findMany({
    where: {
      isDeleted: false
    }
  });
  
  if (products.length === 0) {
    console.error('❌ Tidak ada produk di database. Jalankan seed.ts terlebih dahulu!');
    return;
  }
  console.log(`✅ ${products.length} produk ditemukan di database`);

  // MEMBUAT TANGGAL TRANSAKSI
  
  // 1. DATA BULANAN: 3 bulan terakhir
  const monthlyDates: Date[] = [];
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  
  // Buat data untuk 3 bulan terakhir (bulan ini dan 2 bulan sebelumnya)
  for (let monthOffset = 0; monthOffset < 3; monthOffset++) {
    const targetMonth = (currentMonth - monthOffset + 12) % 12; // Menghindari nilai negatif
    const targetYear = currentMonth - monthOffset < 0 ? currentYear - 1 : currentYear;
    
    // Jumlah transaksi per bulan: 40-60 transaksi
    const transPerMonth = 40 + Math.floor(Math.random() * 21);
    
    for (let i = 0; i < transPerMonth; i++) {
      const maxDay = new Date(targetYear, targetMonth + 1, 0).getDate(); // Hari terakhir dalam bulan
      const day = Math.floor(1 + Math.random() * maxDay);
      
      // Skip tanggal masa depan
      const candidateDate = new Date(targetYear, targetMonth, day);
      if (candidateDate > today) continue;
      
      // Tambahkan waktu acak (jam:menit)
      candidateDate.setHours(
        Math.floor(8 + Math.random() * 12), // Jam 8 pagi - 8 malam
        Math.floor(Math.random() * 60)      // Menit acak
      );
      
      monthlyDates.push(candidateDate);
    }
  }
  
  // 2. DATA MINGGUAN: 4 minggu terakhir
  const weeklyDates: Date[] = [];
  const oneDay = 24 * 60 * 60 * 1000;
  
  // Buat data untuk 4 minggu terakhir
  for (let dayOffset = 0; dayOffset < 28; dayOffset++) {
    const targetDate = new Date(today.getTime() - (dayOffset * oneDay));
    
    // Skip hari ini dan jumlah transaksi bervariasi tergantung hari
    if (dayOffset === 0) continue;
    
    // Lebih banyak transaksi di akhir pekan
    const isWeekend = targetDate.getDay() === 0 || targetDate.getDay() === 6;
    const transPerDay = isWeekend ? 
      4 + Math.floor(Math.random() * 4) : // 4-7 transaksi di akhir pekan
      2 + Math.floor(Math.random() * 3);  // 2-4 transaksi di hari kerja
    
    for (let i = 0; i < transPerDay; i++) {
      const transactionDate = new Date(targetDate);
      
      // Tambahkan waktu acak (jam:menit)
      transactionDate.setHours(
        Math.floor(8 + Math.random() * 12), // Jam 8 pagi - 8 malam
        Math.floor(Math.random() * 60)      // Menit acak
      );
      
      weeklyDates.push(transactionDate);
    }
  }
  
  // 3. DATA HARIAN: Hari ini (past hours) dan kemarin
  const hourlyDates: Date[] = [];
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  
  // Data untuk hari ini (jam yang sudah lewat)
  const currentHour = now.getHours();
  for (let hour = 8; hour < currentHour; hour++) {
    // 0-3 transaksi per jam, lebih banyak di jam sibuk (pagi dan sore)
    const isBusyHour = (hour >= 8 && hour <= 10) || (hour >= 16 && hour <= 18);
    const transPerHour = isBusyHour ? 
      Math.floor(Math.random() * 4) : // 0-3 transaksi di jam sibuk
      Math.floor(Math.random() * 2);  // 0-1 transaksi di jam lainnya
    
    for (let i = 0; i < transPerHour; i++) {
      const transactionDate = new Date(now);
      transactionDate.setHours(hour, Math.floor(Math.random() * 60));
      hourlyDates.push(transactionDate);
    }
  }
  
  // Data untuk kemarin
  for (let hour = 8; hour <= 20; hour++) {
    // 0-3 transaksi per jam, lebih banyak di jam sibuk (pagi dan sore)
    const isBusyHour = (hour >= 8 && hour <= 10) || (hour >= 16 && hour <= 18);
    const transPerHour = isBusyHour ? 
      1 + Math.floor(Math.random() * 3) : // 1-3 transaksi di jam sibuk
      Math.floor(Math.random() * 2);      // 0-1 transaksi di jam lainnya
    
    for (let i = 0; i < transPerHour; i++) {
      const transactionDate = new Date(yesterday);
      transactionDate.setHours(hour, Math.floor(Math.random() * 60));
      hourlyDates.push(transactionDate);
    }
  }
  
  // Gabungkan semua tanggal dan urutkan
  const allDates = [...monthlyDates, ...weeklyDates, ...hourlyDates];
  allDates.sort((a, b) => a.getTime() - b.getTime());
  
  console.log(`✅ Membuat ${allDates.length} tanggal transaksi`);
  
  // MEMBUAT TRANSAKSI
  
  let transactionsCreated = 0;
  let itemsCreated = 0;
  
  for (let i = 0; i < allDates.length; i++) {
    const date = allDates[i];
    
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
      ['Peralatan'] : [];
    
    // Pilih produk berdasarkan preferensi
    const availableProducts = [...products].sort(() => {
      // Acak urutan produk, tapi beri preferensi untuk kategori tertentu
      if (preferredCategories.length > 0 && Math.random() < 0.7) {
        // 70% kemungkinan produk dari kategori yang disukai
        return preferredCategories.includes(products[0].category as string) ? -1 : 1;
      }
      return Math.random() - 0.5;
    });
    
    // Preferensi seasonal
    if (isRainySeason) {
      // Di musim hujan, vitamin dan obat lebih laku
      availableProducts.sort((a, b) => {
        if ((a.category === 'Vitamin' || a.category === 'Obat') && 
            (b.category !== 'Vitamin' && b.category !== 'Obat')) {
          return -1;
        }
        return 0;
      });
    } else {
      // Di musim kemarau, pakan lebih laku
      availableProducts.sort((a, b) => {
        if (a.category?.includes('Pakan') && !b.category?.includes('Pakan')) {
          return -1;
        }
        return 0;
      });
    }
    
    // Pilih produk secara acak
    for (let j = 0; j < Math.min(itemCount, availableProducts.length); j++) {
      if (availableProducts.length === 0) break;
      
      // Ambil produk pertama dari daftar yang sudah diurutkan berdasarkan preferensi
      const productIndex = Math.floor(Math.random() * Math.min(5, availableProducts.length));
      const product = availableProducts.splice(productIndex, 1)[0];
      
      if (!product) continue;
      
      // Quantity bervariasi tergantung kategori produk
      let quantity = 1; 
      if (product.category?.includes('Pakan')) {
        // Pakan biasanya dibeli dalam jumlah lebih banyak
        quantity = Math.floor(1 + Math.random() * 5); // 1-5 karung
      } else if (product.category === 'Vitamin' || product.category === 'Obat') {
        // Vitamin/obat dibeli dalam jumlah sedang
        quantity = Math.floor(1 + Math.random() * 3); // 1-3 botol
      } else {
        // Produk lain dibeli dalam jumlah kecil
        quantity = Math.random() < 0.7 ? 1 : 2; // Biasanya 1, kadang 2
      }
      
      // Pastikan tidak melebihi stok
      quantity = Math.min(quantity, product.stock as number);
      if (quantity <= 0) continue;
      
      // Harga jual per item
      const price = product.price;
      
      // Harga total untuk produk ini
      const itemTotal = price * quantity;
      
      selectedProducts.push({
        productId: product.id,
        quantity,
        price
      });
      
      total += itemTotal;
      totalItemQty += quantity;
    }
    
    // Skip jika tidak ada produk yang dipilih
    if (selectedProducts.length === 0) continue;
    
    // Hitung diskon jika ada
    const discount = getDiscount(totalItemQty, total);
    if (discount > 0) {
      total = total * (1 - discount);
    }
    
    // Pilih metode pembayaran
    const paymentMethod = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];
    
    // Detail pembayaran
    let paymentDetails = '';
    if (isRegularCustomer && customer) {
      paymentDetails = JSON.stringify({
        customerName: customer.name,
        customerFarm: customer.farm,
        customerPhone: customer.phone,
        discount: discount > 0 ? `${(discount * 100).toFixed(0)}%` : null
      });
    } else if (discount > 0) {
      paymentDetails = JSON.stringify({
        discount: `${(discount * 100).toFixed(0)}%`
      });
    }
    
    // Buat transaksi
    const transaction = await prisma.transaction.create({
      data: {
        total,
        paymentMethod,
        paymentDetails,
        createdAt: date,
        updatedAt: date,
        items: {
          create: selectedProducts.map(product => ({
            productId: product.productId,
            quantity: product.quantity,
            price: product.price,
            createdAt: date,
            updatedAt: date
          }))
        }
      },
      include: {
        items: true
      }
    });
    
    transactionsCreated++;
    itemsCreated += transaction.items.length;
    
    // Log progress
    if (transactionsCreated % 20 === 0) {
      console.log(`✅ Dibuat ${transactionsCreated}/${allDates.length} transaksi...`);
    }
  }
  
  console.log(`✅ SELESAI! Berhasil membuat ${transactionsCreated} transaksi dengan ${itemsCreated} item.`);
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