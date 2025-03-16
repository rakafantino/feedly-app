import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { calculateDateRange } from '@/lib/dateUtils';
import { differenceInDays } from 'date-fns';

// Tambahkan definisi interface untuk produk di bagian atas file
interface Product {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  name: string;
  price: number;
  category: string;
  stock: number;
  unit: string;
  supplierId: string | null;
  description: string | null;
  barcode: string | null;
  threshold: number | null;
  isDeleted: boolean;
  // Field-field baru
  purchase_price?: number | null;
  expiry_date?: Date | null;
  batch_number?: string | null;
  purchase_date?: Date | null;
  min_selling_price?: number | null;
}

export async function GET(req: NextRequest) {
  try {
    // Verifikasi autentikasi
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Dapatkan parameter timeframe dari query
    const url = new URL(req.url);
    const timeframe = url.searchParams.get('timeframe') || 'week';
    
    // Tentukan range tanggal berdasarkan timeframe
    const { startDate, endDate } = calculateDateRange(timeframe as 'day' | 'week' | 'month');
    
    // Dapatkan transaksi dalam range tanggal
    const transactions = await prisma.transaction.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        items: {
          include: {
            product: true
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    // Hitung total penjualan hari ini
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const yesterdayStart = new Date(today);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    
    const todayTransactions = await prisma.transaction.findMany({
      where: {
        createdAt: {
          gte: today,
          lt: tomorrow
        }
      },
      include: {
        items: {
          include: {
            product: true
          }
        }
      }
    });
    
    const yesterdayTransactions = await prisma.transaction.findMany({
      where: {
        createdAt: {
          gte: yesterdayStart,
          lt: today
        }
      },
      include: {
        items: {
          include: {
            product: true
          }
        }
      }
    });
    
    const todayTotal = todayTransactions.reduce((sum, tx) => sum + tx.total, 0);
    const yesterdayTotal = yesterdayTransactions.reduce((sum, tx) => sum + tx.total, 0);
    
    // Hitung persentase peningkatan/penurunan
    let percentageChange = 0;
    if (yesterdayTotal > 0) {
      percentageChange = ((todayTotal - yesterdayTotal) / yesterdayTotal) * 100;
    }
    
    // Hitung total item terjual hari ini
    const todayItems = await prisma.transactionItem.findMany({
      where: {
        transaction: {
          createdAt: {
            gte: today,
            lt: tomorrow
          }
        }
      }
    });
    
    const totalItemsSold = todayItems.reduce((sum, item) => sum + item.quantity, 0);
    const transactionCount = todayTransactions.length;
    
    // === FITUR BARU: TOTAL PENJUALAN SESUAI TIMEFRAME ===
    
    // Hitung total penjualan untuk periode saat ini sesuai timeframe
    let currentPeriodTotal = todayTotal; // Default: total hari ini
    // Tambahkan variabel untuk menyimpan jumlah item terjual dan jumlah transaksi berdasarkan timeframe
    let currentPeriodItemsSold = totalItemsSold; // Default: item terjual hari ini
    let currentPeriodTransactionCount = transactionCount; // Default: jumlah transaksi hari ini
    let currentPeriodMargin = 0; // Default: 0
    
    if (timeframe === 'week') {
      // Total minggu ini: 7 hari terakhir
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - 6); // 6 hari yang lalu + hari ini = 7 hari
      
      const weekTransactions = await prisma.transaction.findMany({
        where: {
          createdAt: {
            gte: weekStart,
            lt: tomorrow
          }
        },
        include: {
          items: {
            include: {
              product: true
            }
          }
        }
      });
      
      currentPeriodTotal = weekTransactions.reduce((sum, tx) => sum + tx.total, 0);
      currentPeriodTransactionCount = weekTransactions.length;
      
      // Hitung jumlah item terjual untuk minggu ini
      const weekItems = weekTransactions.flatMap(tx => tx.items);
      currentPeriodItemsSold = weekItems.reduce((sum, item) => sum + item.quantity, 0);
      
      // Hitung margin untuk minggu ini
      const weekMarginResult = await calculateMarginFromTransactions(weekTransactions);
      currentPeriodMargin = weekMarginResult;
    } else if (timeframe === 'month') {
      // Total bulan ini: dari awal bulan hingga hari ini
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      
      const monthTransactions = await prisma.transaction.findMany({
        where: {
          createdAt: {
            gte: monthStart,
            lt: tomorrow
          }
        },
        include: {
          items: {
            include: {
              product: true
            }
          }
        }
      });
      
      currentPeriodTotal = monthTransactions.reduce((sum, tx) => sum + tx.total, 0);
      currentPeriodTransactionCount = monthTransactions.length;
      
      // Hitung jumlah item terjual untuk bulan ini
      const monthItems = monthTransactions.flatMap(tx => tx.items);
      currentPeriodItemsSold = monthItems.reduce((sum, item) => sum + item.quantity, 0);
      
      // Hitung margin untuk bulan ini
      const monthMarginResult = await calculateMarginFromTransactions(monthTransactions);
      currentPeriodMargin = monthMarginResult;
    }
    
    // === AKHIR FITUR BARU ===
    
    // Generate data sales per hari/minggu/bulan berdasarkan timeframe
    const salesData = generateTimePeriodSalesData(transactions, timeframe as 'day' | 'week' | 'month', startDate);
    
    // Generate penjualan per kategori
    const categorySales = calculateCategorySales(transactions);
    
    // Generate data transaksi per jam (heatmap)
    const hourlyTransactions = calculateHourlyTransactions(transactions, timeframe as 'day' | 'week' | 'month');
    
    // Generate tren pertumbuhan kategori
    const categoryGrowth = await calculateCategoryGrowth(transactions);
    
    // Generate produk terlaris
    const topProducts = calculateTopProducts(transactions);
    
    // Generate produk dengan performa rendah
    const worstProducts = calculateWorstProducts(transactions);

    // === FITUR BARU ===
    
    // Hitung margin keuntungan rata-rata
    const { averageMargin, yesterdayMargin } = await calculateProfitMargins(todayTransactions, yesterdayTransactions);
    
    // Hitung total nilai inventori
    const inventoryStats = await calculateInventoryValue();
    
    // Hitung target penjualan berdasarkan timeframe
    const salesTarget = await calculateSalesTarget(timeframe as 'day' | 'week' | 'month');
    
    // Prediksi produk yang akan habis stoknya
    const stockPredictions = await predictStockDepletion();
    
    // Perbandingan dengan periode sebelumnya
    const periodComparison = await generatePeriodComparison(timeframe as 'day' | 'week' | 'month');

    // Cek produk dengan tanggal kadaluwarsa mendekati
    const expiringProducts = await findExpiringProducts();
    
    // === AKHIR FITUR BARU ===
    
    return NextResponse.json({
      success: true,
      todayTotal,
      percentageChange,
      totalItemsSold,
      transactionCount,
      salesData,
      categorySales,
      hourlyTransactions,
      categoryGrowth,
      topProducts,
      worstProducts,
      // Data baru
      averageMargin,
      yesterdayMargin,
      inventoryStats,
      salesTarget,
      stockPredictions,
      periodComparison: periodComparison.data,
      periodComparisonInfo: {
        currentPeriod: periodComparison.currentPeriodInfo,
        previousPeriod: periodComparison.previousPeriodInfo
      },
      expiringProducts,
      currentPeriodTotal, // Tambahkan nilai total periode saat ini
      currentPeriodItemsSold, // Tambahkan jumlah item terjual berdasarkan periode
      currentPeriodTransactionCount, // Tambahkan jumlah transaksi berdasarkan periode
      currentPeriodMargin // Tambahkan margin keuntungan berdasarkan periode
    });
    
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}

// Fungsi untuk generate data penjualan berdasarkan periode waktu
function generateTimePeriodSalesData(
  transactions: any[],
  timeframe: 'day' | 'week' | 'month',
  startDate: Date
) {
  const result: Array<{name: string, sales: number}> = [];
  
  if (timeframe === 'day') {
    // Data per jam untuk timeframe hari
    const hours = 24;
    for (let i = 0; i < hours; i++) {
      const hourDate = new Date(startDate);
      hourDate.setHours(startDate.getHours() + i);
      
      const hourTransactions = transactions.filter(tx => {
        const txDate = new Date(tx.createdAt);
        return txDate.getHours() === hourDate.getHours() && 
               txDate.getDate() === hourDate.getDate() &&
               txDate.getMonth() === hourDate.getMonth();
      });
      
      const hourSales = hourTransactions.reduce((sum, tx) => sum + tx.total, 0);
      
      result.push({
        name: `${hourDate.getHours()}:00`,
        sales: hourSales
      });
    }
  } else if (timeframe === 'week') {
    // Data harian untuk timeframe minggu
    const days = 7;
    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    
    for (let i = 0; i < days; i++) {
      const dayDate = new Date(startDate);
      dayDate.setDate(startDate.getDate() + i);
      
      const dayStart = new Date(dayDate);
      dayStart.setHours(0, 0, 0, 0);
      
      const dayEnd = new Date(dayDate);
      dayEnd.setHours(23, 59, 59, 999);
      
      const dayTransactions = transactions.filter(tx => {
        const txDate = new Date(tx.createdAt);
        return txDate >= dayStart && txDate <= dayEnd;
      });
      
      const daySales = dayTransactions.reduce((sum, tx) => sum + tx.total, 0);
      
      result.push({
        name: dayNames[dayDate.getDay()],
        sales: daySales
      });
    }
  } else if (timeframe === 'month') {
    // Data mingguan untuk timeframe bulan
    const weeks = 4;
    
    for (let i = 0; i < weeks; i++) {
      const weekStart = new Date(startDate);
      weekStart.setDate(startDate.getDate() + (i * 7));
      
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      
      const weekTransactions = transactions.filter(tx => {
        const txDate = new Date(tx.createdAt);
        return txDate >= weekStart && txDate <= weekEnd;
      });
      
      const weekSales = weekTransactions.reduce((sum, tx) => sum + tx.total, 0);
      
      result.push({
        name: `Minggu ${i + 1}`,
        sales: weekSales
      });
    }
  }
  
  return result;
}

// Fungsi untuk menghitung penjualan per kategori
function calculateCategorySales(transactions: any[]) {
  // Kelompokkan penjualan berdasarkan kategori produk
  const categoryMap: Record<string, number> = {};
  
  transactions.forEach(tx => {
    tx.items.forEach((item: any) => {
      const category = item.product.category || 'Tidak Terkategori';
      if (!categoryMap[category]) {
        categoryMap[category] = 0;
      }
      categoryMap[category] += item.price * item.quantity;
    });
  });
  
  // Konversi ke format yang sesuai dengan chart
  return Object.entries(categoryMap).map(([name, value]) => ({
    name,
    value
  }));
}

// Fungsi untuk menghitung transaksi per jam (heatmap)
function calculateHourlyTransactions(transactions: any[], timeframe: 'day' | 'week' | 'month' = 'day') {
  if (timeframe === 'day') {
    // Inisialisasi array untuk 24 jam (00:00 - 23:00)
    const hourlyData: Array<{hour: string, transactions: number}> = [];
    
    for (let hour = 0; hour <= 23; hour++) {
      const hourString = `${hour.toString().padStart(2, '0')}:00`;
      
      const hourTransactions = transactions.filter(tx => {
        const txDate = new Date(tx.createdAt);
        return txDate.getHours() === hour;
      });
      
      hourlyData.push({
        hour: hourString,
        transactions: hourTransactions.length
      });
    }
    
    return hourlyData;
  } else if (timeframe === 'week') {
    // Data per hari untuk timeframe minggu
    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const dailyData: Array<{hour: string, transactions: number}> = [];
    
    // Kelompokkan transaksi berdasarkan hari dalam seminggu
    for (let day = 0; day < 7; day++) {
      const dayTransactions = transactions.filter(tx => {
        const txDate = new Date(tx.createdAt);
        return txDate.getDay() === day;
      });
      
      dailyData.push({
        hour: dayNames[day],
        transactions: dayTransactions.length
      });
    }
    
    return dailyData;
  } else if (timeframe === 'month') {
    // Data per minggu untuk timeframe bulan
    const weeklyData: Array<{hour: string, transactions: number}> = [];
    
    // Dapatkan tanggal awal bulan
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // Kelompokkan transaksi berdasarkan minggu dalam sebulan
    for (let week = 0; week < 4; week++) {
      const weekStart = new Date(startOfMonth);
      weekStart.setDate(weekStart.getDate() + (week * 7));
      
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      
      const weekTransactions = transactions.filter(tx => {
        const txDate = new Date(tx.createdAt);
        return txDate >= weekStart && txDate <= weekEnd;
      });
      
      weeklyData.push({
        hour: `Minggu ${week + 1}`,
        transactions: weekTransactions.length
      });
    }
    
    return weeklyData;
  }
  
  // Default fallback ke data harian jika timeframe tidak dikenal
  return [];
}

// Fungsi untuk menghitung pertumbuhan kategori
async function calculateCategoryGrowth(transactions: any[]) {
  // Untuk menyederhanakan, kita akan menghitung kategori berdasarkan jumlah item terjual
  const categoryItems: Record<string, number> = {};
  
  transactions.forEach(tx => {
    tx.items.forEach((item: any) => {
      const category = item.product.category || 'Tidak Terkategori';
      if (!categoryItems[category]) {
        categoryItems[category] = 0;
      }
      categoryItems[category] += item.quantity;
    });
  });
  
  // Dapatkan data transaksi dari periode sebelumnya untuk perbandingan
  const now = new Date();
  const currentPeriodStart = new Date(transactions[0]?.createdAt || now);
  
  // Tentukan periode perbandingan (sebelumnya) dengan durasi yang sama
  const periodDuration = now.getTime() - currentPeriodStart.getTime();
  const previousPeriodEnd = new Date(currentPeriodStart);
  const previousPeriodStart = new Date(previousPeriodEnd.getTime() - periodDuration);
  
  // Query untuk mendapatkan transaksi dari periode sebelumnya
  const previousTransactions = await prisma.transaction.findMany({
    where: {
      createdAt: {
        gte: previousPeriodStart,
        lt: previousPeriodEnd
      }
    },
    include: {
      items: {
        include: {
          product: true
        }
      }
    }
  });
  
  // Hitung jumlah item per kategori di periode sebelumnya
  const previousCategoryItems: Record<string, number> = {};
  
  previousTransactions.forEach(tx => {
    tx.items.forEach((item: any) => {
      const category = item.product.category || 'Tidak Terkategori';
      if (!previousCategoryItems[category]) {
        previousCategoryItems[category] = 0;
      }
      previousCategoryItems[category] += item.quantity;
    });
  });
  
  // Hitung pertumbuhan berdasarkan data real
  const categoryGrowth = Object.entries(categoryItems)
    .map(([name, currentValue]) => {
      const previousValue = previousCategoryItems[name] || 0;
      
      // Hitung pertumbuhan
      let growth = 0;
      if (previousValue > 0) {
        growth = ((currentValue - previousValue) / previousValue) * 100;
      } else if (currentValue > 0) {
        // Jika tidak ada data periode sebelumnya tapi ada penjualan saat ini
        growth = 100; // 100% pertumbuhan (dari 0)
      }
      
      return { name, growth: Math.round(growth) };
    })
    .filter(item => !isNaN(item.growth)) // Filter nilai NaN
    .sort((a, b) => b.growth - a.growth) // Urutkan dari pertumbuhan tertinggi
    .slice(0, 5); // Ambil 5 teratas
  
  return categoryGrowth;
}

// Fungsi untuk menghitung produk terlaris
function calculateTopProducts(transactions: any[]) {
  // Map untuk menyimpan informasi penjualan per produk
  const productSales: Record<string, {
    id: string,
    name: string,
    category: string | null,
    quantity: number,
    revenue: number,
    unit: string
  }> = {};
  
  // Agregasi penjualan per produk
  transactions.forEach(tx => {
    tx.items.forEach((item: any) => {
      const productId = item.product.id;
      
      if (!productSales[productId]) {
        productSales[productId] = {
          id: productId,
          name: item.product.name,
          category: item.product.category,
          quantity: 0,
          revenue: 0,
          unit: item.product.unit || 'pcs'
        };
      }
      
      productSales[productId].quantity += item.quantity;
      productSales[productId].revenue += item.price * item.quantity;
    });
  });
  
  // Konversi ke array dan urutkan berdasarkan quantity (jumlah terjual)
  const topByQuantity = Object.values(productSales)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);
  
  // Urutkan berdasarkan revenue (pendapatan)
  const topByRevenue = Object.values(productSales)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);
  
  return {
    byQuantity: topByQuantity,
    byRevenue: topByRevenue
  };
}

// Fungsi untuk menghitung produk dengan performa rendah
function calculateWorstProducts(transactions: any[]) {
  // Map untuk menyimpan informasi penjualan per produk
  const productSales: Record<string, {
    id: string,
    name: string,
    category: string | null,
    quantity: number,
    revenue: number,
    unit: string
  }> = {};
  
  // Kumpulkan semua ID produk yang pernah terjual dalam transaksi
  const soldProductIds = new Set<string>();
  
  // Agregasi penjualan per produk dan catat ID produk yang terjual
  transactions.forEach(tx => {
    tx.items.forEach((item: any) => {
      const productId = item.product.id;
      soldProductIds.add(productId);
      
      if (!productSales[productId]) {
        productSales[productId] = {
          id: productId,
          name: item.product.name,
          category: item.product.category,
          quantity: 0,
          revenue: 0,
          unit: item.product.unit || 'pcs'
        };
      }
      
      productSales[productId].quantity += item.quantity;
      productSales[productId].revenue += item.price * item.quantity;
    });
  });
  
  // Konversi ke array dan urutkan berdasarkan quantity (jumlah terjual) dari rendah ke tinggi
  const worstByQuantity = Object.values(productSales)
    .sort((a, b) => a.quantity - b.quantity)
    .slice(0, 5);
  
  // Urutkan berdasarkan revenue (pendapatan) dari rendah ke tinggi
  const worstByRevenue = Object.values(productSales)
    .sort((a, b) => a.revenue - b.revenue)
    .slice(0, 5);
  
  return {
    byQuantity: worstByQuantity,
    byRevenue: worstByRevenue
  };
}

// === FUNGSI BARU ===

/**
 * Menghitung rata-rata margin keuntungan hari ini dan kemarin
 */
async function calculateProfitMargins(todayTransactions: any[], yesterdayTransactions: any[]) {
  try {
    // Fungsi bantuan untuk menghitung margin dari transaksi
    const calculateMarginFromTransactions = async (transactions: any[]) => {
      if (!transactions || transactions.length === 0) return 0;
      
      let totalRevenue = 0;
      let totalCost = 0;
      
      for (const tx of transactions) {
        totalRevenue += tx.total;
        
        // Dapatkan cost untuk setiap item (gunakan purchase_price jika ada, atau asumsikan sebagai 70% dari harga jual)
        for (const item of tx.items) {
          if (item.product) {
            // Sekarang kita bisa langsung menggunakan purchase_price yang ada di skema
            const product = item.product as Product;
            const costPrice = product.purchase_price !== null && product.purchase_price !== undefined 
              ? product.purchase_price 
              : (item.price * 0.7);
            totalCost += costPrice * item.quantity;
          }
        }
      }
      
      if (totalRevenue === 0) return 0;
      return ((totalRevenue - totalCost) / totalRevenue) * 100;
    };
    
    const averageMargin = await calculateMarginFromTransactions(todayTransactions);
    const yesterdayMargin = await calculateMarginFromTransactions(yesterdayTransactions);
    
    return { averageMargin, yesterdayMargin };
  } catch (error) {
    console.error('Error calculating profit margins:', error);
    return { averageMargin: 0, yesterdayMargin: 0 };
  }
}

/**
 * Menghitung total nilai inventori dan jumlah produk dalam stok
 */
async function calculateInventoryValue() {
  try {
    const products = await prisma.product.findMany({
      where: {
        isDeleted: false
      }
    });
    
    let totalValue = 0;
    let productsInStock = 0;
    
    for (const product of products) {
      if (product.stock > 0) {
        productsInStock++;
        
        // Gunakan purchase_price jika ada, atau estimasi sebagai 70% dari sell_price
        const typedProduct = product as unknown as Product;
        const costPrice = typedProduct.purchase_price !== null && typedProduct.purchase_price !== undefined
          ? typedProduct.purchase_price
          : (product.price * 0.7);
        totalValue += costPrice * product.stock;
      }
    }
    
    return { totalValue, productsInStock };
  } catch (error) {
    console.error('Error calculating inventory value:', error);
    return { totalValue: 0, productsInStock: 0 };
  }
}

/**
 * Menghitung target penjualan berdasarkan timeframe
 */
async function calculateSalesTarget(timeframe: 'day' | 'week' | 'month') {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let startDatePrev: Date;
    let endDatePrev: Date;
    let defaultTarget: number;
    
    // Tentukan rentang waktu untuk periode sebelumnya
    if (timeframe === 'day') {
      // Kemarin
      startDatePrev = new Date(today);
      startDatePrev.setDate(startDatePrev.getDate() - 1);
      
      endDatePrev = new Date(today);
      endDatePrev.setMilliseconds(-1);
      
      defaultTarget = 5000000; // Default jika tidak ada data: Rp 5 juta
    } else if (timeframe === 'week') {
      // Minggu lalu: 7-14 hari yang lalu
      startDatePrev = new Date(today);
      startDatePrev.setDate(startDatePrev.getDate() - 14);
      
      endDatePrev = new Date(today);
      endDatePrev.setDate(endDatePrev.getDate() - 7);
      endDatePrev.setMilliseconds(-1);
      
      defaultTarget = 35000000; // Default jika tidak ada data: Rp 35 juta
    } else {
      // Bulan lalu
      startDatePrev = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      endDatePrev = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999);
      
      defaultTarget = 150000000; // Default jika tidak ada data: Rp 150 juta
    }
    
    // Ambil transaksi dari periode sebelumnya
    const previousTransactions = await prisma.transaction.findMany({
      where: {
        createdAt: {
          gte: startDatePrev,
          lte: endDatePrev
        }
      }
    });
    
    // Hitung total penjualan periode sebelumnya
    const previousTotal = previousTransactions.reduce((sum, tx) => sum + tx.total, 0);
    
    // Target: total periode sebelumnya + 10% (atau default jika tidak ada transaksi)
    const target = previousTotal > 0 
      ? previousTotal * 1.1 // Tambahkan 10%
      : defaultTarget;
      
    return target;
  } catch (error) {
    console.error('Error calculating sales target:', error);
    // Fallback ke nilai default jika terjadi error
    switch (timeframe) {
      case 'day': return 5000000;
      case 'week': return 35000000;
      case 'month': return 150000000;
      default: return 5000000;
    }
  }
}

/**
 * Memperkirakan produk yang akan habis stoknya
 */
async function predictStockDepletion() {
  try {
    // Ambil produk dengan stok di atas 0
    const products = await prisma.product.findMany({
      where: {
        stock: {
          gt: 0
        },
        isDeleted: false
      }
    });
    
    // Ambil transaksi 30 hari terakhir untuk menghitung rata-rata penjualan harian
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const transactions = await prisma.transaction.findMany({
      where: {
        createdAt: {
          gte: thirtyDaysAgo
        }
      },
      include: {
        items: true
      }
    });
    
    // Hitung rata-rata penjualan per hari untuk setiap produk
    const productDailySales: Record<string, number> = {};
    
    transactions.forEach(tx => {
      tx.items.forEach(item => {
        const productId = item.productId;
        if (!productDailySales[productId]) {
          productDailySales[productId] = 0;
        }
        productDailySales[productId] += item.quantity;
      });
    });
    
    // Konversi ke rata-rata harian (dibagi 30 hari)
    Object.keys(productDailySales).forEach(productId => {
      productDailySales[productId] = productDailySales[productId] / 30;
    });
    
    // Perkirakan hari hingga stok habis
    const stockPredictions = products.map(product => {
      const dailySale = productDailySales[product.id] || 0.1; // Minimal 0.1 untuk menghindari pembagian dengan 0
      const daysLeft = dailySale > 0 ? Math.round(product.stock / dailySale) : 999;
      
      return {
        id: product.id,
        name: product.name,
        category: product.category,
        stock: product.stock,
        unit: product.unit || 'pcs',
        avgDailySale: dailySale,
        daysLeft: daysLeft
      };
    });
    
    // Urutkan berdasarkan produk yang akan habis paling cepat
    return stockPredictions
      .filter(p => p.daysLeft < 30) // Hanya tampilkan yang diprediksi habis dalam 30 hari
      .sort((a, b) => a.daysLeft - b.daysLeft);
      
  } catch (error) {
    console.error('Error predicting stock depletion:', error);
    return [];
  }
}

/**
 * Membandingkan penjualan periode saat ini dengan periode sebelumnya
 */
async function generatePeriodComparison(timeframe: 'day' | 'week' | 'month') {
  try {
    // Tentukan periode saat ini dan periode sebelumnya berdasarkan timeframe
    const now = new Date();
    let currentPeriodStart: Date;
    const currentPeriodEnd: Date = now;
    let previousPeriodStart: Date;
    let previousPeriodEnd: Date;
    
    if (timeframe === 'day') {
      // Hari ini vs kemarin
      currentPeriodStart = new Date(now);
      currentPeriodStart.setHours(0, 0, 0, 0);
      
      // Untuk perbandingan yang adil, gunakan rentang waktu yang sama
      // Jika sekarang jam 15:30, bandingkan dari 00:00-15:30 hari ini dengan 00:00-15:30 kemarin
      const currentHours = now.getHours();
      const currentMinutes = now.getMinutes();
      const currentSeconds = now.getSeconds();
      
      previousPeriodStart = new Date(currentPeriodStart);
      previousPeriodStart.setDate(previousPeriodStart.getDate() - 1);
      
      previousPeriodEnd = new Date(previousPeriodStart);
      previousPeriodEnd.setHours(currentHours, currentMinutes, currentSeconds);
    } else if (timeframe === 'week') {
      // Minggu ini vs minggu lalu
      const dayOfWeek = now.getDay(); // 0 = Minggu, 1 = Senin, ...
      const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      
      currentPeriodStart = new Date(now);
      currentPeriodStart.setDate(now.getDate() - daysFromMonday);
      currentPeriodStart.setHours(0, 0, 0, 0);
      
      // Untuk perbandingan yang adil, gunakan jumlah hari yang sama
      // Jika hari ini Rabu (3 hari dari awal minggu), bandingkan 3 hari pertama minggu ini dengan 3 hari pertama minggu lalu
      const daysSinceWeekStart = Math.floor((now.getTime() - currentPeriodStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      
      previousPeriodStart = new Date(currentPeriodStart);
      previousPeriodStart.setDate(previousPeriodStart.getDate() - 7);
      
      previousPeriodEnd = new Date(previousPeriodStart);
      previousPeriodEnd.setDate(previousPeriodStart.getDate() + daysSinceWeekStart - 1);
      previousPeriodEnd.setHours(23, 59, 59, 999);
    } else {
      // Bulan ini vs bulan lalu
      currentPeriodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      
      // Untuk perbandingan yang adil, gunakan jumlah hari yang sama
      // Jika hari ini tanggal 15, bandingkan dari tanggal 1-15 bulan ini dengan tanggal 1-15 bulan lalu
      const dayOfMonth = now.getDate();
      
      previousPeriodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      
      // Pastikan tidak melebihi jumlah hari dalam bulan sebelumnya
      const lastDayOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
      const compareDay = Math.min(dayOfMonth, lastDayOfPrevMonth);
      
      previousPeriodEnd = new Date(now.getFullYear(), now.getMonth() - 1, compareDay, 23, 59, 59, 999);
    }
    
    // Ambil transaksi periode saat ini
    const currentPeriodTransactions = await prisma.transaction.findMany({
      where: {
        createdAt: {
          gte: currentPeriodStart,
          lte: currentPeriodEnd
        }
      },
      include: {
        items: {
          include: {
            product: true
          }
        }
      }
    });
    
    // Ambil transaksi periode sebelumnya
    const previousPeriodTransactions = await prisma.transaction.findMany({
      where: {
        createdAt: {
          gte: previousPeriodStart,
          lte: previousPeriodEnd
        }
      },
      include: {
        items: {
          include: {
            product: true
          }
        }
      }
    });
    
    // Hitung total penjualan per kategori untuk kedua periode
    const currentSalesByCategory: Record<string, number> = {};
    const previousSalesByCategory: Record<string, number> = {};
    
    // Fungsi helper untuk mengekstrak sales data
    const extractSalesByCategory = (transactions: any[], target: Record<string, number>) => {
      transactions.forEach(tx => {
        tx.items.forEach((item: any) => {
          const category = item.product?.category || 'Tidak Terkategori';
          if (!target[category]) {
            target[category] = 0;
          }
          target[category] += item.price * item.quantity;
        });
      });
    };
    
    extractSalesByCategory(currentPeriodTransactions, currentSalesByCategory);
    extractSalesByCategory(previousPeriodTransactions, previousSalesByCategory);
    
    // Gabungkan dan format data untuk perbandingan
    const categories = new Set([
      ...Object.keys(currentSalesByCategory),
      ...Object.keys(previousSalesByCategory)
    ]);
    
    const periodComparisonData = Array.from(categories).map(category => {
      const current = currentSalesByCategory[category] || 0;
      const previous = previousSalesByCategory[category] || 0;
      
      // Hitung persentase perubahan
      let percentageChange = 0;
      if (previous > 0) {
        percentageChange = ((current - previous) / previous) * 100;
      } else if (current > 0) {
        percentageChange = 100; // Jika sebelumnya 0, tetapi sekarang ada, maka pertumbuhan 100%
      }
      
      return {
        name: category,
        current,
        previous,
        percentageChange: Math.round(percentageChange)
      };
    });
    
    // Urutkan kategori berdasarkan perbedaan nilai (selisih terbesar)
    periodComparisonData.sort((a, b) => {
      const diffA = Math.abs(a.current - a.previous);
      const diffB = Math.abs(b.current - b.previous);
      return diffB - diffA; // Urutan menurun
    });
    
    // Tambahkan data total
    const currentTotal = currentPeriodTransactions.reduce((sum, tx) => sum + tx.total, 0);
    const previousTotal = previousPeriodTransactions.reduce((sum, tx) => sum + tx.total, 0);
    
    // Hitung persentase perubahan total
    let totalPercentageChange = 0;
    if (previousTotal > 0) {
      totalPercentageChange = ((currentTotal - previousTotal) / previousTotal) * 100;
    } else if (currentTotal > 0) {
      totalPercentageChange = 100;
    }
    
    // Tambahkan total pada awal array
    periodComparisonData.unshift({
      name: 'Total',
      current: currentTotal,
      previous: previousTotal,
      percentageChange: Math.round(totalPercentageChange)
    });
    
    return {
      data: periodComparisonData,
      currentPeriodInfo: {
        start: currentPeriodStart,
        end: currentPeriodEnd
      },
      previousPeriodInfo: {
        start: previousPeriodStart,
        end: previousPeriodEnd
      }
    };
  } catch (error) {
    console.error('Error generating period comparison:', error);
    return {
      data: [],
      currentPeriodInfo: {
        start: new Date(),
        end: new Date()
      },
      previousPeriodInfo: {
        start: new Date(),
        end: new Date()
      }
    };
  }
}

/**
 * Mencari produk dengan tanggal kadaluwarsa yang mendekati
 */
async function findExpiringProducts() {
  try {
    // Ambil tanggal hari ini untuk perhitungan
    const now = new Date();
    const thirtyDaysLater = new Date();
    thirtyDaysLater.setDate(now.getDate() + 30);
    
    // Ambil semua produk yang masih dalam stok dan tidak dihapus
    const products = await prisma.product.findMany({
      where: {
        isDeleted: false,
        stock: {
          gt: 0
        }
      }
    });
    
    // Filter produk secara manual berdasarkan tanggal kadaluwarsa
    const expiringProducts = products
      .filter(product => {
        // Periksa apakah produk memiliki expiry_date
        const typedProduct = product as unknown as Product;
        const expiryDate = typedProduct.expiry_date;
        
        // Lanjutkan hanya jika produk memiliki tanggal kadaluwarsa yang valid
        return expiryDate && 
               expiryDate instanceof Date && 
               expiryDate >= now && 
               expiryDate <= thirtyDaysLater;
      })
      .map(product => {
        const typedProduct = product as unknown as Product;
        const expiryDate = typedProduct.expiry_date!;
        
        // Gunakan differenceInDays dari date-fns untuk konsistensi dengan ExpiryDateAnalysis
        const daysUntilExpiry = differenceInDays(expiryDate, now);
        
        return {
          id: product.id,
          name: product.name,
          category: product.category,
          stock: product.stock,
          unit: product.unit || 'pcs',
          expiryDate: expiryDate,
          daysUntilExpiry: daysUntilExpiry
        };
      })
      .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry); // Urutkan dari yang paling dekat kadaluwarsa
    
    return expiringProducts;
  } catch (error) {
    console.error('Error finding expiring products:', error);
    return [];
  }
}

// === AKHIR FUNGSI BARU === 

/**
 * Fungsi bantuan untuk menghitung margin keuntungan dari transaksi
 */
async function calculateMarginFromTransactions(transactions: any[]) {
  if (!transactions || transactions.length === 0) return 0;
  
  let totalRevenue = 0;
  let totalCost = 0;
  
  for (const tx of transactions) {
    totalRevenue += tx.total;
    
    // Dapatkan cost untuk setiap item (gunakan purchase_price jika ada, atau asumsikan sebagai 70% dari harga jual)
    for (const item of tx.items) {
      if (item.product) {
        // Sekarang kita bisa langsung menggunakan purchase_price yang ada di skema
        const product = item.product as Product;
        const costPrice = product.purchase_price !== null && product.purchase_price !== undefined 
          ? product.purchase_price 
          : (item.price * 0.7);
        totalCost += costPrice * item.quantity;
      }
    }
  }
  
  if (totalRevenue === 0) return 0;
  return ((totalRevenue - totalCost) / totalRevenue) * 100;
}

// === AKHIR FUNGSI BARU === 