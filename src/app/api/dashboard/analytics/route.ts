import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { calculateDateRange } from '@/lib/dateUtils';



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
    
    // === OPTIMASI: Hitung semua tanggal di awal ===
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const yesterdayStart = new Date(today);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    
    // Hitung range berdasarkan timeframe
    const { startDate, endDate } = calculateDateRange(timeframe as 'day' | 'week' | 'month');
    
    // Hitung tanggal paling awal yang kita butuhkan (untuk menggabungkan query)
    const earliestDate = new Date(Math.min(yesterdayStart.getTime(), startDate.getTime()));
    
    // === OPTIMASI: SATU QUERY UNTUK SEMUA TRANSAKSI ===
    // Fetch semua transaksi dari tanggal paling awal hingga sekarang dalam SATU query
    const allTransactions = await prisma.transaction.findMany({
      where: {
        createdAt: {
          gte: earliestDate,
          lte: endDate
        },
        storeId: storeId
      },
      include: {
        items: {
          select: {
            id: true,
            quantity: true,
            price: true,
            cost_price: true,
            product: {
              select: {
                id: true,
                name: true,
                category: true,
                purchase_price: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });
    
    // === FILTER LOKAL (di memori, bukan query baru) ===
    const todayTransactions = allTransactions.filter(tx => {
      const txDate = new Date(tx.createdAt);
      return txDate >= today && txDate < tomorrow;
    });
    
    const yesterdayTransactions = allTransactions.filter(tx => {
      const txDate = new Date(tx.createdAt);
      return txDate >= yesterdayStart && txDate < today;
    });
    
    const periodTransactions = allTransactions.filter(tx => {
      const txDate = new Date(tx.createdAt);
      return txDate >= startDate && txDate <= endDate;
    });
    
    // === HITUNG METRICS DARI DATA LOKAL ===
    const todayTotal = todayTransactions.reduce((sum, tx) => sum + tx.total, 0);
    const yesterdayTotal = yesterdayTransactions.reduce((sum, tx) => sum + tx.total, 0);
    
    // Hitung persentase peningkatan/penurunan
    let percentageChange = 0;
    if (yesterdayTotal > 0) {
      percentageChange = ((todayTotal - yesterdayTotal) / yesterdayTotal) * 100;
    }
    
    // Hitung total item terjual dan jumlah transaksi
    const todayItems = todayTransactions.flatMap(tx => tx.items);
    const totalItemsSold = todayItems.reduce((sum, item) => sum + item.quantity, 0);
    const transactionCount = todayTransactions.length;
    
    // === HITUNG PERIODE SAAT INI ===
    let currentPeriodTotal = 0;
    let currentPeriodItemsSold = 0;
    let currentPeriodTransactionCount = 0;
    let currentPeriodTransactions: typeof allTransactions = [];
    
    if (timeframe === 'day') {
      currentPeriodTransactions = todayTransactions;
    } else if (timeframe === 'week') {
      const currentDay = today.getDay();
      const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
      const mondayStart = new Date(today);
      mondayStart.setDate(today.getDate() - daysFromMonday);
      mondayStart.setHours(0, 0, 0, 0);
      
      currentPeriodTransactions = allTransactions.filter(tx => {
        const txDate = new Date(tx.createdAt);
        return txDate >= mondayStart && txDate < tomorrow;
      });
    } else if (timeframe === 'month') {
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      currentPeriodTransactions = allTransactions.filter(tx => {
        const txDate = new Date(tx.createdAt);
        return txDate >= monthStart && txDate < tomorrow;
      });
    }
    
    currentPeriodTotal = currentPeriodTransactions.reduce((sum, tx) => sum + tx.total, 0);
    currentPeriodTransactionCount = currentPeriodTransactions.length;
    const periodItems = currentPeriodTransactions.flatMap(tx => tx.items);
    currentPeriodItemsSold = periodItems.reduce((sum, item) => sum + item.quantity, 0);
    
    // === GENERATE DATA CHARTS (dari data lokal) ===
    const salesData = generateTimePeriodSalesData(periodTransactions, timeframe as 'day' | 'week' | 'month', startDate);
    const categorySales = calculateCategorySales(periodTransactions);
    const hourlyTransactions = calculateHourlyTransactions(periodTransactions, timeframe as 'day' | 'week' | 'month');
    
    // === OPTIMASI: PARALLEL EXECUTION untuk operasi independen ===
    const [
      topProducts,
      { averageMargin, yesterdayMargin },
      currentPeriodMargin,
      inventoryStats,
      salesTargetResult,
      expiringProducts
    ] = await Promise.all([
      getTopProducts(storeId, startDate, endDate),
      calculateProfitMargins(todayTransactions, yesterdayTransactions),
      calculateMarginFromTransactions(currentPeriodTransactions),
      calculateInventoryValue(storeId),
      calculateSalesTarget(timeframe as 'day' | 'week' | 'month', storeId),
      findExpiringProducts(storeId)
    ]);
    
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
      topProducts,
      averageMargin,
      yesterdayMargin,
      inventoryStats,
      salesTarget: salesTargetResult.target,
      expiringProducts,
      currentPeriodTotal,
      currentPeriodItemsSold,
      currentPeriodTransactionCount,
      currentPeriodMargin
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



// Fungsi untuk menghitung produk terlaris dengan Aggregation Database
async function getTopProducts(storeId: string, startDate: Date, endDate: Date) {
  // Query raw untuk Top by Quantity
  const topByQuantity = await prisma.$queryRaw`
    SELECT 
      p.id, p.name, p.unit, p.category,
      SUM(ti.quantity) as quantity,
      SUM(ti.quantity * ti.price) as revenue
    FROM "transaction_items" ti
    JOIN "transactions" t ON ti.transaction_id = t.id
    JOIN "products" p ON ti.product_id = p.id
    WHERE t.store_id = ${storeId}
      AND t.created_at >= ${startDate}
      AND t.created_at <= ${endDate}
    GROUP BY p.id, p.name, p.unit, p.category
    ORDER BY quantity DESC
    LIMIT 5
  ` as any[];

  // Query raw untuk Top by Revenue
  const topByRevenue = await prisma.$queryRaw`
    SELECT 
      p.id, p.name, p.unit, p.category,
      SUM(ti.quantity) as quantity,
      SUM(ti.quantity * ti.price) as revenue
    FROM "transaction_items" ti
    JOIN "transactions" t ON ti.transaction_id = t.id
    JOIN "products" p ON ti.product_id = p.id
    WHERE t.store_id = ${storeId}
      AND t.created_at >= ${startDate}
      AND t.created_at <= ${endDate}
    GROUP BY p.id, p.name, p.unit, p.category
    ORDER BY revenue DESC
    LIMIT 5
  ` as any[];
  
  return {
    byQuantity: topByQuantity.map(item => ({
      ...item,
      quantity: Number(item.quantity),
      revenue: Number(item.revenue)
    })),
    byRevenue: topByRevenue.map(item => ({
      ...item,
      quantity: Number(item.quantity),
      revenue: Number(item.revenue)
    }))
  };
}



// === FUNGSI BARU ===

/**
 * Menghitung margin dari sekumpulan transaksi
 */
const calculateMarginFromTransactions = async (transactions: any[]) => {
  if (!transactions || transactions.length === 0) return 0;
  
  let totalRevenue = 0;
  let totalCost = 0;
  
  for (const tx of transactions) {
    totalRevenue += tx.total;
    
    // Dapatkan cost untuk setiap item (gunakan purchase_price jika ada, atau asumsikan sebagai 70% dari harga jual)
    for (const item of tx.items) {
      // Prioritize historical cost_price (from transaction snapshot)
      // Fallback to current product purchase_price
      // Fallback to estimation (70% of price)
      /* @ts-ignore */
      const costPrice = item.cost_price ?? item.product?.purchase_price ?? (item.price * 0.7);
      
      totalCost += costPrice * item.quantity;
    }
  }
  
  if (totalRevenue === 0) return 0;
  return ((totalRevenue - totalCost) / totalRevenue) * 100;
};

/**
 * Menghitung rata-rata margin keuntungan hari ini dan kemarin
 */
async function calculateProfitMargins(todayTransactions: any[], yesterdayTransactions: any[]) {
  try {

    
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

    // Hitung total jumlah produk dalam stok
    const productsInStock = products.reduce((total, product) => total + product.stock, 0);
    
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
      productsInStock,
      categoryValues
    };
  } catch (error) {
    console.error('Error calculating inventory value:', error);
    return {
      totalValue: 0,
      productsInStock: 0,
      categoryValues: []
    };
  }
}

/**
 * Menghitung target penjualan berdasarkan timeframe
 */
async function calculateSalesTarget(timeframe: 'day' | 'week' | 'month', storeId: string) {
  try {
    // === CEK TARGET MANUAL DARI STORE SETTINGS ===
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: {
        dailyTarget: true,
        weeklyTarget: true,
        monthlyTarget: true
      }
    });

    let manualTarget = 0;
    if (store) {
      if (timeframe === 'day') manualTarget = store.dailyTarget || 0;
      else if (timeframe === 'week') manualTarget = store.weeklyTarget || 0;
      else if (timeframe === 'month') manualTarget = store.monthlyTarget || 0;
    }

    // Periode saat ini
    const { startDate, endDate } = calculateDateRange(timeframe);
    
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
    
    // Hitung current total saat ini
    const current = currentTransactions.reduce((sum, tx) => sum + tx.total, 0);

    // JIKA ADA TARGET MANUAL, GUNAKAN ITU
    if (manualTarget > 0) {
      const percentage = (current / manualTarget) * 100;
      return {
        target: manualTarget,
        current,
        percentage: parseFloat(percentage.toFixed(2)),
        timeframe,
        isManual: true
      };
    }

    // === FALLBACK: AUTO CALCULATE (LOGIKA LAMA) ===
    
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
    
    // Hitung persentase pencapaian
    const percentage = target > 0 ? (current / target) * 100 : 0;
    
    return {
      target,
      current,
      percentage: parseFloat(percentage.toFixed(2)),
      timeframe,
      isManual: false
    };
  } catch (error) {
    console.error('Error calculating sales target:', error);
    return {
      target: 0,
      current: 0,
      percentage: 0,
      timeframe,
      isManual: false
    };
  }
}



/**
 * Mencari produk dengan tanggal kadaluwarsa yang mendekati
 */
async function findExpiringProducts(storeId: string) {
  try {
    // Dapatkan settings toko untuk batas notifikasi (default 30 hari)
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { expiryNotificationDays: true }
    });
    
    const notificationDays = store?.expiryNotificationDays || 30;

    // Tanggal saat ini
    const today = new Date();
    
    // Tanggal X hari dari sekarang (sesuai setting)
    const notificationDate = new Date(today);
    notificationDate.setDate(today.getDate() + notificationDays);
    
    // Ambil BATCH yang akan kadaluwarsa dalam rentang tersebut
    // Dan pastikan stok batch > 0
    const expiringBatches = await prisma.productBatch.findMany({
      where: {
        expiryDate: {
          not: null,
          lte: notificationDate,
          gte: today
        },
        stock: {
          gt: 0 
        },
        product: {
          storeId: storeId,
          isDeleted: false
        }
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            category: true,
            unit: true
          }
        }
      },
      orderBy: {
        expiryDate: 'asc'
      }
    });
    
    return expiringBatches.map(batch => ({
      id: batch.product.id,
      name: batch.product.name,
      category: batch.product.category,
      expiryDate: batch.expiryDate,
      daysUntilExpiry: batch.expiryDate 
        ? Math.ceil((new Date(batch.expiryDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) 
        : null,
      stock: batch.stock, // Stok spesifik batch ini
      unit: batch.product.unit,
      batchNumber: batch.batchNumber // Info tambahan jika frontend mau pakai
    }));
  } catch (error) {
    console.error('Error finding expiring products:', error);
    return [];
  }
}

// === AKHIR FUNGSI BARU === 

 