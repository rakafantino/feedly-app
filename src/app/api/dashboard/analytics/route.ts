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
      }
    });
    
    const yesterdayTransactions = await prisma.transaction.findMany({
      where: {
        createdAt: {
          gte: yesterdayStart,
          lt: today
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
    
    // Generate data sales per hari/minggu/bulan berdasarkan timeframe
    const salesData = generateTimePeriodSalesData(transactions, timeframe as 'day' | 'week' | 'month', startDate);
    
    // Generate penjualan per kategori
    const categorySales = calculateCategorySales(transactions);
    
    // Generate data transaksi per jam (heatmap)
    const hourlyTransactions = calculateHourlyTransactions(transactions);
    
    // Generate tren pertumbuhan kategori
    const categoryGrowth = await calculateCategoryGrowth(transactions);
    
    // Generate produk terlaris
    const topProducts = calculateTopProducts(transactions);
    
    // Generate produk dengan performa rendah
    const worstProducts = calculateWorstProducts(transactions);
    
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
      worstProducts
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
function calculateHourlyTransactions(transactions: any[]) {
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