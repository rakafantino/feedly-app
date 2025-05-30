import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Script untuk melakukan migrasi dari satu toko menjadi multi-toko
 * Script ini akan:
 * 1. Membuat toko baru
 * 2. Menghubungkan semua pengguna ke toko tersebut
 * 3. Menghubungkan semua produk ke toko tersebut
 * 4. Menghubungkan semua supplier ke toko tersebut
 * 5. Menghubungkan semua transaksi ke toko tersebut
 * 6. Menghubungkan semua purchase order ke toko tersebut
 */
async function main() {
  try {
    console.log('🚀 Memulai migrasi ke multi-toko...');

    // 1. Buat toko baru sebagai toko default
    console.log('📦 Membuat toko baru...');
    const store = await prisma.store.create({
      data: {
        name: 'Toko Utama',
        description: 'Toko default yang terbuat dari migrasi',
        isActive: true,
      },
    });
    console.log(`✅ Toko berhasil dibuat dengan ID: ${store.id}`);

    // 2. Update semua pengguna untuk terhubung dengan toko
    console.log('👥 Menghubungkan semua pengguna ke toko...');
    const updateUsers = await prisma.user.updateMany({
      data: {
        storeId: store.id,
      },
    });
    console.log(`✅ ${updateUsers.count} pengguna berhasil dihubungkan ke toko`);

    // 3. Update semua produk untuk terhubung dengan toko
    console.log('📝 Menghubungkan semua produk ke toko...');
    const updateProducts = await prisma.product.updateMany({
      data: {
        storeId: store.id,
      },
    });
    console.log(`✅ ${updateProducts.count} produk berhasil dihubungkan ke toko`);

    // 4. Update semua supplier untuk terhubung dengan toko
    console.log('🚚 Menghubungkan semua supplier ke toko...');
    const updateSuppliers = await prisma.supplier.updateMany({
      data: {
        storeId: store.id,
      },
    });
    console.log(`✅ ${updateSuppliers.count} supplier berhasil dihubungkan ke toko`);

    // 5. Update semua transaksi untuk terhubung dengan toko
    console.log('💰 Menghubungkan semua transaksi ke toko...');
    const updateTransactions = await prisma.transaction.updateMany({
      data: {
        storeId: store.id,
      },
    });
    console.log(`✅ ${updateTransactions.count} transaksi berhasil dihubungkan ke toko`);

    // 6. Update semua purchase order untuk terhubung dengan toko
    console.log('📋 Menghubungkan semua purchase order ke toko...');
    const updatePurchaseOrders = await prisma.purchaseOrder.updateMany({
      data: {
        storeId: store.id,
      },
    });
    console.log(`✅ ${updatePurchaseOrders.count} purchase order berhasil dihubungkan ke toko`);

    console.log('✅ Migrasi ke multi-toko berhasil! 🎉');
  } catch (error) {
    console.error('❌ Error dalam migrasi:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main(); 