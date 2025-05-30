// @ts-nocheck
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Fungsi untuk menghasilkan tanggal acak dalam rentang tertentu
function randomDate(start: Date, end: Date) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

// Fungsi untuk menghasilkan nomor barcode unik
function generateBarcode() {
  return `899${Math.floor(10000000000 + Math.random() * 90000000000)}`;
}

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
  try {
    console.log('🗑️ Menghapus transaksi yang ada...');
    
    // Hapus data transaksi yang ada
    await prisma.transactionItem.deleteMany();
    await prisma.transaction.deleteMany();
  
  console.log('✅ Data transaksi berhasil dihapus');
    console.log('🌱 Memulai seeding data dashboard...');

    // Dapatkan defaultStore
    const defaultStore = await prisma.store.findFirst({
      where: {
        name: 'Toko Utama'
      }
    });

    if (!defaultStore) {
      throw new Error('Default store tidak ditemukan');
    }

    const defaultStoreId = defaultStore.id;
    
    // Dapatkan storeId untuk toko kedua
    const secondStore = await prisma.store.findFirst({
    where: {
        name: 'Toko Cabang'
      }
    });

    if (!secondStore) {
      throw new Error('Second store tidak ditemukan');
    }

    const secondStoreId = secondStore.id;

    // ------------------- TRANSACTIONS -------------------
    console.log('💰 Membuat data transaksi untuk dasbor...');
    
    // Generate tanggal untuk 12 bulan terakhir
    const today = new Date();
    const dates = [];
    
    for (let i = 0; i < 12; i++) {
      const month = today.getMonth() - i;
      const year = today.getFullYear() - (month < 0 ? 1 : 0);
      const adjustedMonth = month < 0 ? month + 12 : month;
      
      // Buat 15-30 transaksi per bulan
      const numTransactions = 15 + Math.floor(Math.random() * 16);
      
      for (let j = 0; j < numTransactions; j++) {
        const daysInMonth = new Date(year, adjustedMonth + 1, 0).getDate();
        const day = 1 + Math.floor(Math.random() * daysInMonth);
        const hour = Math.floor(Math.random() * 12) + 8; // 8 AM - 8 PM
        const minute = Math.floor(Math.random() * 60);
        
        const date = new Date(year, adjustedMonth, day, hour, minute);
        dates.push(date);
      }
    }
    
    // Urutkan tanggal
    dates.sort((a, b) => a.getTime() - b.getTime());
    
    // Metode pembayaran
    const paymentMethods = ['CASH', 'TRANSFER', 'QRIS'];
    
    // Dapatkan semua produk dari database
    const allProducts = await prisma.product.findMany();
    
    // Buat transaksi untuk setiap tanggal
    for (let i = 0; i < dates.length; i++) {
      const date = dates[i];
      const storeId = Math.random() > 0.5 ? defaultStoreId : secondStoreId;
      
      // Pilih 1-5 produk acak untuk transaksi ini
      const numItems = 1 + Math.floor(Math.random() * 5);
      
      // Pilih produk dari toko ini saja
      const storeProducts = allProducts.filter(product => product.storeId === storeId);
      
      if (storeProducts.length === 0) {
        console.log(`Tidak ada produk untuk toko ${storeId}`);
        continue;
      }
      
      // Kocok produk dan pilih beberapa
      const shuffled = [...storeProducts].sort(() => 0.5 - Math.random());
      const selectedProducts = shuffled.slice(0, Math.min(numItems, shuffled.length));
      
      const items = [];
      let total = 0;
      
      // Buat item transaksi
      for (const product of selectedProducts) {
        const quantity = 1 + Math.floor(Math.random() * 5);
        const subtotal = product.price * quantity;
        
        items.push({
          productId: product.id,
          quantity,
          price: product.price
        });
        
        total += subtotal;
      }
      
      // Jika tidak ada item, lewati
      if (items.length === 0) continue;
      
      // Tentukan metode pembayaran acak
      const paymentMethod = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];
      
      // Buat transaksi
      const transaction = await prisma.transaction.create({
        data: {
          total,
          paymentMethod,
          paymentDetails: `Payment via ${paymentMethod}`,
          createdAt: date,
          updatedAt: date,
          storeId,
          items: {
            create: items
          }
        }
      });
      
      // Log setiap 10 transaksi
      if (i % 10 === 0) {
        console.log(`✅ Dibuat ${i + 1}/${dates.length} transaksi untuk toko ${storeId}`);
      }
    }
    
    console.log(`✅ Selesai membuat ${dates.length} transaksi`);
    
    // ------------------- PURCHASE ORDERS -------------------
    console.log('📦 Membuat purchase orders...');
    
    const poStatuses = ['draft', 'sent', 'processing', 'completed', 'cancelled'];
    
    // Buat purchase orders untuk 12 bulan terakhir
    const poDates = [];
    for (let i = 0; i < 12; i++) {
      const month = today.getMonth() - i;
      const year = today.getFullYear() - (month < 0 ? 1 : 0);
      const adjustedMonth = month < 0 ? month + 12 : month;
      
      // 2-4 PO per bulan
      const numPOs = 2 + Math.floor(Math.random() * 3);
      
      for (let j = 0; j < numPOs; j++) {
        const daysInMonth = new Date(year, adjustedMonth + 1, 0).getDate();
        const day = 1 + Math.floor(Math.random() * daysInMonth);
        
        const date = new Date(year, adjustedMonth, day);
        poDates.push(date);
      }
    }
    
    // Urutkan tanggal
    poDates.sort((a, b) => a.getTime() - b.getTime());
    
    // Dapatkan semua supplier
    const suppliers = await prisma.supplier.findMany();
    
    for (let i = 0; i < poDates.length; i++) {
      const date = poDates[i];
      
      // Pilih supplier acak
      const supplier = suppliers[Math.floor(Math.random() * suppliers.length)];
      const storeId = supplier.storeId;
      
      // Pilih produk dari supplier ini
      const supplierProducts = allProducts.filter(p => p.supplierId === supplier.id);
      
      if (supplierProducts.length === 0) continue;
      
      // Pilih 1-3 produk acak dari supplier ini
      const numItems = 1 + Math.floor(Math.random() * 3);
      const shuffled = [...supplierProducts].sort(() => 0.5 - Math.random());
      const selectedProducts = shuffled.slice(0, Math.min(numItems, shuffled.length));
      
      const items = [];
      
      // Buat item PO
      for (const product of selectedProducts) {
        const quantity = 5 + Math.floor(Math.random() * 21);
        
        items.push({
          price: product.purchase_price || product.price * 0.7, // Fallback jika null
          quantity,
          productId: product.id,
          unit: product.unit
        });
      }
      
      // Pilih status acak
      const status = poStatuses[Math.floor(Math.random() * poStatuses.length)];
      
      // Buat tanggal estimasi pengiriman
      const estDelivery = new Date(date);
      estDelivery.setDate(estDelivery.getDate() + 7 + Math.floor(Math.random() * 8));
      
      // Buat PO
      await prisma.purchaseOrder.create({
      data: {
          poNumber: `PO-${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${(i + 1).toString().padStart(3, '0')}`,
          supplierId: supplier.id,
          storeId,
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
            create: items
          }
        }
      });
      
      // Log setiap 5 PO
      if (i % 5 === 0 || i === poDates.length - 1) {
        console.log(`✅ Dibuat ${i + 1}/${poDates.length} purchase orders`);
      }
    }
    
    console.log('✅ Seeding data dashboard selesai!');
  } catch (error) {
    console.error('❌ Error:', error);
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