import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { calculateDateRange } from '@/lib/dateUtils';

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

    // Dapatkan storeId dari session user
    let storeId: string | null = session.user?.storeId || null;
    
    // Coba mendapatkan dari request header cookie
    if (!storeId) {
      const requestCookies = req.cookies;
      const storeCookie = requestCookies.get('selectedStoreId');
      if (storeCookie) {
        storeId = storeCookie.value;
      }
    }

    // Coba mendapatkan dari query params jika masih tidak ada
    if (!storeId) {
      const url = new URL(req.url);
      const queryStoreId = url.searchParams.get('storeId');
      if (queryStoreId) {
        storeId = queryStoreId;
      }
    }

    // Jika tidak ada storeId, kembalikan error
    if (!storeId) {
      return NextResponse.json({ error: 'Store ID tidak ditemukan' }, { status: 400 });
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
        },
        storeId: storeId
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
        },
        storeId: storeId
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
        },
        storeId: storeId
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
    
    // Hitung total item terjual dan jumlah transaksi
    const items = todayTransactions.flatMap(tx => tx.items);
    const totalItemsSold = items.reduce((sum, item) => sum + item.quantity, 0);
    const transactionCount = todayTransactions.length;
    
    // Variabel untuk periode saat ini
    let currentPeriodTotal = 0;
    let currentPeriodItemsSold = 0;
    let currentPeriodTransactionCount = 0;
    let currentPeriodMargin = 0;
    
    if (timeframe === 'day') {
      // Total hari ini
      currentPeriodTotal = todayTotal;
      currentPeriodTransactionCount = transactionCount;
      currentPeriodItemsSold = totalItemsSold;
      
      // Hitung margin untuk hari ini
      const todayMarginResult = await calculateMarginFromTransactions(todayTransactions);
      currentPeriodMargin = todayMarginResult;
    } else if (timeframe === 'week') {
      // Total minggu ini: dari hari Senin hingga hari ini
      const currentDay = today.getDay(); // 0 = Minggu, 1 = Senin, ..., 6 = Sabtu
      const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
      
      const mondayStart = new Date(today);
      mondayStart.setDate(today.getDate() - daysFromMonday);
      mondayStart.setHours(0, 0, 0, 0);
      
      const weekTransactions = await prisma.transaction.findMany({
        where: {
          createdAt: {
            gte: mondayStart,
            lt: tomorrow
          },
          storeId: storeId
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
          },
          storeId: storeId
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
    const inventoryStats = await calculateInventoryValue(storeId);
    
    // Hitung target penjualan berdasarkan timeframe
    const salesTarget = await calculateSalesTarget(timeframe as 'day' | 'week' | 'month', storeId);
    
    // Prediksi produk yang akan habis stoknya
    const stockPredictions = await predictStockDepletion(storeId);
    
    // Perbandingan dengan periode sebelumnya
    const periodComparison = await generatePeriodComparison(timeframe as 'day' | 'week' | 'month', storeId);

    // Cek produk dengan tanggal kadaluwarsa mendekati
    const expiringProducts = await findExpiringProducts(storeId);
    
    // === AKHIR FITUR BARU ===
    
    return NextResponse.json({
      success: true,
      storeId,
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
async function calculateInventoryValue(storeId: string) {
  try {
    const products = await prisma.product.findMany({
      where: {
        storeId: storeId
      }
    });
    
    // Hitung total nilai inventori
    const totalValue = products.reduce((total, product) => {
      return total + (product.purchase_price || 0) * product.stock;
    }, 0);
    
    // Hitung nilai inventori per kategori
    const categories = [...new Set(products.map(p => p.category))];
    const categoryValues = categories.map(category => {
      const categoryProducts = products.filter(p => p.category === category);
      const value = categoryProducts.reduce((sum, p) => sum + (p.purchase_price || 0) * p.stock, 0);
      
      return {
        category,
        value,
        itemCount: categoryProducts.length,
        stockCount: categoryProducts.reduce((sum, p) => sum + p.stock, 0)
      };
    });
    
    return {
      totalValue,
      categoryValues
    };
  } catch (error) {
    console.error('Error calculating inventory value:', error);
    return {
      totalValue: 0,
      categoryValues: []
    };
  }
}

/**
 * Menghitung target penjualan berdasarkan timeframe
 */
async function calculateSalesTarget(timeframe: 'day' | 'week' | 'month', storeId: string) {
  try {
    // Periode saat ini
    const { startDate, endDate } = calculateDateRange(timeframe);
    
    // Ambil data historis dari periode yang sama di masa lalu
    // Misalnya, jika timeframe adalah 'month', ambil data 3 bulan terakhir
    let historicalStartDate: Date;
    let multiplier = 1;
    
    if (timeframe === 'day') {
      // Ambil data 30 hari terakhir
      historicalStartDate = new Date(startDate);
      historicalStartDate.setDate(historicalStartDate.getDate() - 30);
      multiplier = 1.1; // Target 10% lebih tinggi dari rata-rata
    } else if (timeframe === 'week') {
      // Ambil data 12 minggu terakhir
      historicalStartDate = new Date(startDate);
      historicalStartDate.setDate(historicalStartDate.getDate() - 12 * 7);
      multiplier = 1.15; // Target 15% lebih tinggi dari rata-rata
    } else { // month
      // Ambil data 6 bulan terakhir
      historicalStartDate = new Date(startDate);
      historicalStartDate.setMonth(historicalStartDate.getMonth() - 6);
      multiplier = 1.2; // Target 20% lebih tinggi dari rata-rata
    }
    
    // Ambil transaksi historis
    const historicalTransactions = await prisma.transaction.findMany({
      where: {
        createdAt: {
          gte: historicalStartDate,
          lt: startDate
        },
        storeId: storeId
      }
    });
    
    // Hitung total historis
    const historicalTotal = historicalTransactions.reduce((sum, tx) => sum + tx.total, 0);
    
    // Hitung rata-rata per periode (hari/minggu/bulan)
    let periodCount = 0;
    if (timeframe === 'day') {
      // Hitung jumlah hari antara historicalStartDate dan startDate
      periodCount = Math.ceil((startDate.getTime() - historicalStartDate.getTime()) / (1000 * 60 * 60 * 24));
    } else if (timeframe === 'week') {
      // Hitung jumlah minggu
      periodCount = Math.ceil((startDate.getTime() - historicalStartDate.getTime()) / (1000 * 60 * 60 * 24 * 7));
    } else { // month
      // Hitung jumlah bulan
      periodCount = (startDate.getFullYear() - historicalStartDate.getFullYear()) * 12 + 
                    startDate.getMonth() - historicalStartDate.getMonth();
    }
    
    // Average per period
    const averagePerPeriod = periodCount > 0 ? historicalTotal / periodCount : 0;
    
    // Target untuk periode saat ini (dengan penambahan persentase)
    const target = Math.ceil(averagePerPeriod * multiplier);
    
    // Ambil transaksi periode saat ini untuk melihat progress
    const currentTransactions = await prisma.transaction.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate
        },
        storeId: storeId
      }
    });
    
    const current = currentTransactions.reduce((sum, tx) => sum + tx.total, 0);
    
    // Hitung persentase pencapaian
    const percentage = target > 0 ? (current / target) * 100 : 0;
    
    return {
      target,
      current,
      percentage: parseFloat(percentage.toFixed(2)),
      timeframe
    };
  } catch (error) {
    console.error('Error calculating sales target:', error);
    return {
      target: 0,
      current: 0,
      percentage: 0,
      timeframe
    };
  }
}

/**
 * Memprediksi produk yang akan habis stoknya
 */
async function predictStockDepletion(storeId: string) {
  try {
    // Dapatkan semua produk
    const products = await prisma.product.findMany({
      where: {
        stock: {
          gt: 0
        },
        storeId: storeId
      }
    });
    
    // Ambil data penjualan 30 hari terakhir untuk menghitung rate penjualan
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const today = new Date();
    
    const salesData = await prisma.transactionItem.findMany({
      where: {
        transaction: {
          createdAt: {
            gte: thirtyDaysAgo,
            lte: today
          },
          storeId: storeId
        }
      },
      include: {
        product: true
      }
    });
    
    // Map untuk menyimpan total penjualan per produk
    const productSales: Record<string, number> = {};
    
    // Hitung total penjualan per produk
    salesData.forEach(item => {
      if (item.productId) {
        productSales[item.productId] = (productSales[item.productId] || 0) + item.quantity;
      }
    });
    
    // Hitung perkiraan hari hingga habis untuk setiap produk
    const predictions = products.map(product => {
      // Total penjualan produk selama 30 hari terakhir
      const sales = productSales[product.id] || 0;
      
      // Rate penjualan harian (rata-rata)
      const dailySalesRate = sales / 30;
      
      // Jika tidak ada penjualan dalam 30 hari terakhir, kita asumsikan produk tidak akan habis
      if (dailySalesRate === 0) {
        return {
          id: product.id,
          name: product.name,
          category: product.category,
          currentStock: product.stock,
          unit: product.unit,
          estimatedDaysUntilEmpty: null,
          estimatedEmptyDate: null,
          dailySalesRate: 0,
          monthlySales: 0
        };
      }
      
      // Perkiraan hari hingga habis
      const daysUntilEmpty = Math.floor(product.stock / dailySalesRate);
      
      // Perkiraan tanggal habis
      const emptyDate = new Date(today);
      emptyDate.setDate(today.getDate() + daysUntilEmpty);
      
      return {
        id: product.id,
        name: product.name,
        category: product.category,
        currentStock: product.stock,
        unit: product.unit,
        estimatedDaysUntilEmpty: daysUntilEmpty,
        estimatedEmptyDate: emptyDate,
        dailySalesRate: parseFloat(dailySalesRate.toFixed(2)),
        monthlySales: sales
      };
    });
    
    // Urutkan berdasarkan perkiraan hari hingga habis (dari yang paling cepat)
    return predictions
      .filter(p => p.estimatedDaysUntilEmpty !== null)
      .sort((a, b) => (a.estimatedDaysUntilEmpty || 0) - (b.estimatedDaysUntilEmpty || 0))
      .slice(0, 10); // Ambil 10 teratas
  } catch (error) {
    console.error('Error predicting stock depletion:', error);
    return [];
  }
}

/**
 * Membandingkan penjualan periode saat ini dengan periode sebelumnya
 */
async function generatePeriodComparison(timeframe: 'day' | 'week' | 'month', storeId: string) {
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
        },
        storeId: storeId
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
        },
        storeId: storeId
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
async function findExpiringProducts(storeId: string) {
  try {
    // Tanggal saat ini
    const today = new Date();
    
    // Tanggal 30 hari dari sekarang
    const thirtyDaysLater = new Date(today);
    thirtyDaysLater.setDate(today.getDate() + 30);
    
    // Ambil produk yang akan kadaluwarsa dalam 30 hari
    const expiringProducts = await prisma.product.findMany({
      where: {
        expiry_date: {
          not: null,
          lte: thirtyDaysLater,
          gte: today
        },
        storeId: storeId
      },
      orderBy: {
        expiry_date: 'asc'
      }
    });
    
    return expiringProducts.map(product => ({
      id: product.id,
      name: product.name,
      category: product.category,
      expiryDate: product.expiry_date,
      daysUntilExpiry: product.expiry_date 
        ? Math.ceil((product.expiry_date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) 
        : null,
      stock: product.stock,
      unit: product.unit
    }));
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