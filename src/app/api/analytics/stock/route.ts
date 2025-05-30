import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { calculateDateRange } from '@/lib/dateUtils';

export async function GET(req: NextRequest) {
  try {
    // Verifikasi autentikasi
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Dapatkan storeId dari session, cookie, atau query params
    let storeId = session.user?.storeId || null;
    
    // Coba dapatkan dari cookies jika tidak ada di session
    if (!storeId) {
      const requestCookies = req.cookies;
      const storeCookie = requestCookies.get('selectedStoreId');
      if (storeCookie) {
        storeId = storeCookie.value;
      }
    }
    
    // Coba dapatkan dari query param jika masih tidak ada
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
    
    // Dapatkan produk dengan stok menipis
    const lowStockProducts = await prisma.product.findMany({
      where: {
        storeId: storeId,
        stock: {
          lte: prisma.product.fields.threshold
        },
        isDeleted: false
      }
    });
    
    // Dapatkan semua produk
    const allProducts = await prisma.product.findMany({
      where: {
        storeId: storeId,
        isDeleted: false
      }
    });
    
    // Dapatkan transaksi dalam periode yang diminta
    const transactions = await prisma.transaction.findMany({
      where: {
        storeId: storeId,
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
    
    // Generate data historis berdasarkan transaksi
    const historicalData = generateHistoricalData(
      transactions, 
      timeframe as 'day' | 'week' | 'month', 
      startDate
    );
    
    // Hitung statistik per kategori
    const categoryStats = calculateCategoryStats(allProducts);
    
    return NextResponse.json({
      success: true,
      storeId,
      timeframe,
      lowStockCount: lowStockProducts.length,
      history: historicalData,
      categoryStats
    });
    
  } catch (error) {
    console.error('Error fetching analytics data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics data' },
      { status: 500 }
    );
  }
}

// Fungsi untuk menghasilkan data historis dari transaksi
function generateHistoricalData(
  transactions: any[],
  timeframe: 'day' | 'week' | 'month',
  startDate: Date
) {
  const result: Array<{date: string, count: number, value: number}> = [];
  
  if (timeframe === 'day') {
    // Pengelompokan per jam untuk timeframe hari
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
      
      // Hitung total produk dan nilai
      let totalCount = 0;
      let totalValue = 0;
      
      hourTransactions.forEach(tx => {
        tx.items.forEach((item: any) => {
          totalCount += item.quantity || 0;
          totalValue += item.price * item.quantity;
        });
      });
      
      result.push({
        date: `${hourDate.getHours()}:00`,
        count: totalCount,
        value: totalValue
      });
    }
  } else if (timeframe === 'week') {
    // Pengelompokan harian untuk timeframe minggu
    const days = 7;
    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    
    for (let i = 0; i < days; i++) {
      const dayDate = new Date(startDate);
      dayDate.setDate(startDate.getDate() + i);
      
      const dayTransactions = transactions.filter(tx => {
        const txDate = new Date(tx.createdAt);
        return txDate.getDate() === dayDate.getDate() &&
               txDate.getMonth() === dayDate.getMonth();
      });
      
      // Hitung total produk dan nilai
      let totalCount = 0;
      let totalValue = 0;
      
      dayTransactions.forEach(tx => {
        tx.items.forEach((item: any) => {
          totalCount += item.quantity || 0;
          totalValue += item.price * item.quantity;
        });
      });
      
      result.push({
        date: dayNames[dayDate.getDay()],
        count: totalCount,
        value: totalValue
      });
    }
  } else if (timeframe === 'month') {
    // Pengelompokan mingguan untuk timeframe bulan
    const weeks = 4;
    
    for (let i = 0; i < weeks; i++) {
      const weekStart = new Date(startDate);
      weekStart.setDate(startDate.getDate() + (i * 7));
      
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      
      const weekTransactions = transactions.filter(tx => {
        const txDate = new Date(tx.createdAt);
        return txDate >= weekStart && txDate <= weekEnd;
      });
      
      // Hitung total produk dan nilai
      let totalCount = 0;
      let totalValue = 0;
      
      weekTransactions.forEach(tx => {
        tx.items.forEach((item: any) => {
          totalCount += item.quantity || 0;
          totalValue += item.price * item.quantity;
        });
      });
      
      result.push({
        date: `Minggu ${i + 1}`,
        count: totalCount,
        value: totalValue
      });
    }
  }
  
  return result;
}

// Helper function untuk menghitung statistik per kategori
function calculateCategoryStats(products: any[]) {
  const categoryGroups: Record<string, {count: number, value: number}> = {};
  
  products.forEach(product => {
    const category = product.category || 'Tidak Terkategori';
    if (!categoryGroups[category]) {
      categoryGroups[category] = { count: 0, value: 0 };
    }
    categoryGroups[category].count += 1;
    categoryGroups[category].value += product.price * product.stock;
  });
  
  return Object.entries(categoryGroups).map(([name, stats]) => ({
    name,
    count: stats.count,
    value: stats.value
  }));
} 