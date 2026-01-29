"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useEffect, useCallback } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  Package,
  BarChart,
  Target,
  Calendar,
  Percent
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart as RechartsBarChart,
  Bar
} from "recharts";
import { formatRupiah } from "@/lib/utils";
import { toast } from "sonner";

// Fallback data jika API gagal
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function DashboardPage() {
  // const { getLowStockProducts } = useProductStore(); // helper unused here as we use API
  const [lowStockProducts, setLowStockProducts] = useState<Array<any>>([]);
  const [timeFilter, setTimeFilter] = useState<'day' | 'week' | 'month'>('day');
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<{
    todayTotal: number;
    percentageChange: number;
    totalItemsSold: number;
    transactionCount: number;
    salesData: Array<{ name: string, sales: number }>;
    categorySales: Array<{ name: string, value: number }>;
    hourlyTransactions: Array<{ hour: string, transactions: number }>;
    topProducts?: {
      byQuantity: Array<{ id: string, name: string, category: string | null, quantity: number, revenue: number, unit: string }>;
      byRevenue: Array<{ id: string, name: string, category: string | null, quantity: number, revenue: number, unit: string }>;
    };
    averageMargin?: number;
    yesterdayMargin?: number;
    inventoryStats?: {
      totalValue: number;
      productsInStock: number;
    };
    salesTarget?: number;
    expiringProducts?: Array<{
      id: string;
      name: string;
      category: string | null;
      stock: number;
      unit: string;
      expiryDate: Date;
      daysUntilExpiry: number;
    }>;
    currentPeriodTotal?: number;
    currentPeriodItemsSold?: number;
    currentPeriodTransactionCount?: number;
    currentPeriodMargin?: number;
  }>({
    todayTotal: 0,
    percentageChange: 0,
    totalItemsSold: 0,
    transactionCount: 0,
    salesData: [],
    categorySales: [],
    hourlyTransactions: [],
  });

  const router = useRouter();

  // Fungsi untuk mengambil data dashboard dari API
  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/dashboard/analytics?timeframe=${timeFilter}`);
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }

      const data = await response.json();
      if (data.success) {
        setDashboardData({
          todayTotal: data.todayTotal || 0,
          percentageChange: data.percentageChange || 0,
          totalItemsSold: data.totalItemsSold || 0,
          transactionCount: data.transactionCount || 0,
          salesData: data.salesData || [],
          categorySales: data.categorySales || [],
          hourlyTransactions: data.hourlyTransactions || [],
          topProducts: data.topProducts || { byQuantity: [], byRevenue: [] },
          averageMargin: data.averageMargin || 0,
          yesterdayMargin: data.yesterdayMargin || 0,
          inventoryStats: data.inventoryStats || { totalValue: 0, productsInStock: 0 },
          salesTarget: data.salesTarget || 0,
          expiringProducts: data.expiringProducts || [],
          currentPeriodTotal: data.currentPeriodTotal || 0,
          currentPeriodItemsSold: data.currentPeriodItemsSold || 0,
          currentPeriodTransactionCount: data.currentPeriodTransactionCount || 0,
          currentPeriodMargin: data.currentPeriodMargin || 0
        });
      } else {
        throw new Error(data.error || 'Failed to fetch data');
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Gagal memuat data dashboard. Silakan coba lagi nanti.');
      // Tidak lagi menggunakan data fallback, tetapi kita beri tau user dan kosongkan data saja
      setDashboardData({
        todayTotal: 0,
        percentageChange: 0,
        totalItemsSold: 0,
        transactionCount: 0,
        salesData: [],
        categorySales: [],
        hourlyTransactions: [],
        topProducts: { byQuantity: [], byRevenue: [] },
        currentPeriodTotal: 0
      });
    } finally {
      setLoading(false);
    }
  }, [timeFilter]);

  // Effect untuk mengambil data produk
  useEffect(() => {
    // Panggil fungsi fetchDashboardData ketika komponen dimount
    fetchDashboardData();

    // Ambil data low stock dari API baru
    fetchLowStockNotifications();

    // Setup interval untuk memperbarui data low stock secara periodik
    const interval = setInterval(() => {
      fetchLowStockNotifications();
    }, 30000); // Periksa setiap 30 detik

    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  // Fungsi untuk mengambil data notifikasi stok rendah (Real-time dari Product table)
  const fetchLowStockNotifications = async () => {
    try {
      // FIX: Fetch directly from products table via API instead of notifications table
      // This ensures 100% accuracy with actual stock levels, ignoring phantom notifications
      const response = await fetch('/api/products?lowStock=true&limit=100'); 
      if (!response.ok) {
        throw new Error('Failed to fetch low stock products');
      }
      const data = await response.json();
      setLowStockProducts(data.products || []);
    } catch (error) {
      console.error('Error fetching low stock products:', error);
    }
  };

  // Panggil fetchDashboardData saat timeFilter berubah
  useEffect(() => {
    fetchDashboardData();
  }, [timeFilter, fetchDashboardData]);

  // Custom tooltip untuk grafik penjualan
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded p-2 shadow-sm">
          <p className="font-medium">{label}</p>
          <p className="text-sm">{formatRupiah(payload[0].value)}</p>
        </div>
      );
    }
    return null;
  };

  // Cari waktu transaksi terpadat
  const getPeakTransactionTime = () => {
    if (!dashboardData.hourlyTransactions || dashboardData.hourlyTransactions.length === 0) {
      return '(tidak ada data)';
    }

    const peakHour = dashboardData.hourlyTransactions.reduce(
      (max, current) => (current.transactions > max.transactions ? current : max),
      dashboardData.hourlyTransactions[0]
    );

    if (timeFilter === 'day') {
      return `Jam ${peakHour.hour} adalah waktu terpadat dengan ${peakHour.transactions} transaksi`;
    } else if (timeFilter === 'week') {
      return `${peakHour.hour} adalah hari terpadat dengan ${peakHour.transactions} transaksi`;
    } else if (timeFilter === 'month') {
      return `${peakHour.hour} adalah waktu terpadat dengan ${peakHour.transactions} transaksi`;
    }

    return `${peakHour.hour} adalah waktu terpadat dengan ${peakHour.transactions} transaksi`;
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {timeFilter === 'day' && 'Total Penjualan Hari Ini'}
              {timeFilter === 'week' && 'Total Penjualan Minggu Ini'}
              {timeFilter === 'month' && 'Total Penjualan Bulan Ini'}
            </CardTitle>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-4 w-4 text-muted-foreground"
            >
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatRupiah(dashboardData.currentPeriodTotal || dashboardData.todayTotal)}</div>
            <p className="text-xs text-muted-foreground">
              {timeFilter === 'day' && (
                <>{dashboardData.percentageChange >= 0 ? '+' : ''}{dashboardData.percentageChange.toFixed(1)}% dari kemarin</>
              )}
              {timeFilter === 'week' && 'Total 7 hari terakhir'}
              {timeFilter === 'month' && 'Total bulan ini'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {timeFilter === 'day' && 'Produk Terjual Hari Ini'}
              {timeFilter === 'week' && 'Produk Terjual Minggu Ini'}
              {timeFilter === 'month' && 'Produk Terjual Bulan Ini'}
            </CardTitle>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-4 w-4 text-muted-foreground"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData.currentPeriodItemsSold || dashboardData.totalItemsSold} item</div>
            <p className="text-xs text-muted-foreground">
              {timeFilter === 'day' && `${dashboardData.transactionCount} transaksi hari ini`}
              {timeFilter === 'week' && 'Total transaksi minggu ini'}
              {timeFilter === 'month' && 'Total transaksi bulan ini'}
            </p>
          </CardContent>
        </Card>

        {/* Card Margin Keuntungan Baru */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {timeFilter === 'day' && 'Keuntungan Hari Ini'}
              {timeFilter === 'week' && 'Keuntungan Minggu Ini'}
              {timeFilter === 'month' && 'Keuntungan Bulan Ini'}
            </CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {timeFilter === 'day'
                ? (dashboardData.averageMargin?.toFixed(1) || '0')
                : (dashboardData.currentPeriodMargin?.toFixed(1) || '0')
              }%
            </div>
            <p className="text-xs text-muted-foreground">
              {timeFilter === 'day' && (
                <>{(dashboardData.averageMargin || 0) > (dashboardData.yesterdayMargin || 0) ? '+' : ''}
                  {((dashboardData.averageMargin || 0) - (dashboardData.yesterdayMargin || 0)).toFixed(1)}% dari kemarin</>
              )}
              {timeFilter === 'week' && 'Margin rata-rata minggu ini'}
              {timeFilter === 'month' && 'Margin rata-rata bulan ini'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Stok Menipis
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lowStockProducts.length}</div>
            <p className="text-xs text-muted-foreground">
              Produk perlu diisi ulang
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="analytics">Analitik</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:justify-between mb-4 gap-3">
            <div className="flex justify-center sm:justify-start w-full sm:w-auto">
              <div className="inline-flex rounded-md border p-1 shadow-sm w-full sm:w-auto">
                <button
                  onClick={() => setTimeFilter('day')}
                  className={`flex-1 px-3 py-1.5 text-sm ${timeFilter === 'day'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground'
                    } rounded-sm transition-colors`}
                >
                  Hari
                </button>
                <button
                  onClick={() => setTimeFilter('week')}
                  className={`flex-1 px-3 py-1.5 text-sm ${timeFilter === 'week'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground'
                    } rounded-sm transition-colors`}
                >
                  Minggu
                </button>
                <button
                  onClick={() => setTimeFilter('month')}
                  className={`flex-1 px-3 py-1.5 text-sm ${timeFilter === 'month'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground'
                    } rounded-sm transition-colors`}
                >
                  Bulan
                </button>
              </div>
            </div>
          </div>

          {/* Card Baris Kedua */}
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-7">
            {/* Card Nilai Inventori Baru */}
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Nilai Inventori
                </CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatRupiah(dashboardData.inventoryStats?.totalValue || 0)}</div>
                <p className="text-xs text-muted-foreground">
                  {dashboardData.inventoryStats?.productsInStock || 0} produk dalam stok
                </p>
              </CardContent>
            </Card>

            {/* Card Target Penjualan Baru */}
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Target Penjualan
                </CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span>{formatRupiah(dashboardData.currentPeriodTotal || 0)}</span>
                  <span className="text-muted-foreground">Target: {formatRupiah(dashboardData.salesTarget || 0)}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${Math.min(100, (((dashboardData.currentPeriodTotal || 0) / (dashboardData.salesTarget || 1)) * 100))}%` }}
                  ></div>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  {(((dashboardData.currentPeriodTotal || 0) / (dashboardData.salesTarget || 1)) * 100).toFixed(1)}% dari target {timeFilter === 'day' ? 'harian' : timeFilter === 'week' ? 'mingguan' : 'bulanan'}
                </p>
              </CardContent>
            </Card>

            {/* Card Produk Hampir Kadaluwarsa */}
            <Card className="lg:col-span-3">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Produk Hampir Kadaluwarsa
                </CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {(dashboardData.expiringProducts?.length || 0) > 0 ? (
                  <div className="space-y-3">
                    {(dashboardData.expiringProducts || []).slice(0, 3).map(product => (
                      <div key={product.id} className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm truncate max-w-[150px]">{product.name}</p>
                          <p className="text-xs text-muted-foreground">{product.stock} {product.unit}</p>
                        </div>
                        <Badge
                          variant={product.daysUntilExpiry <= 7 ? "destructive" : "secondary"}
                          className="ml-2"
                        >
                          {product.daysUntilExpiry} hari
                        </Badge>
                      </div>
                    ))}

                    {/* Tombol Lihat Semua */}
                    {(dashboardData.expiringProducts?.length || 0) > 3 && (
                      <Button
                        variant="link"
                        size="sm"
                        className="w-full mt-2"
                        onClick={() => router.push('/low-stock')}
                      >
                        Lihat Semua ({dashboardData.expiringProducts?.length})
                      </Button>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Tidak ada produk yang akan kadaluwarsa segera</p>
                )}
              </CardContent>
            </Card>
          </div>



        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:justify-between mb-4 gap-3">
            <div className="flex justify-center sm:justify-start w-full sm:w-auto">
              <div className="inline-flex rounded-md border p-1 shadow-sm w-full sm:w-auto">
                <button
                  onClick={() => setTimeFilter('day')}
                  className={`flex-1 px-3 py-1.5 text-sm ${timeFilter === 'day'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground'
                    } rounded-sm transition-colors`}
                >
                  Hari
                </button>
                <button
                  onClick={() => setTimeFilter('week')}
                  className={`flex-1 px-3 py-1.5 text-sm ${timeFilter === 'week'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground'
                    } rounded-sm transition-colors`}
                >
                  Minggu
                </button>
                <button
                  onClick={() => setTimeFilter('month')}
                  className={`flex-1 px-3 py-1.5 text-sm ${timeFilter === 'month'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground'
                    } rounded-sm transition-colors`}
                >
                  Bulan
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Grafik penjualan */}
            <Card className="col-span-2">
              <CardHeader>
                <CardTitle>Penjualan {timeFilter === 'day' ? 'Harian' : timeFilter === 'week' ? 'Mingguan' : 'Bulanan'}</CardTitle>
                <CardDescription>
                  {timeFilter === 'day'
                    ? 'Total penjualan per jam dalam 24 jam terakhir'
                    : timeFilter === 'week'
                      ? 'Total penjualan per hari dalam seminggu terakhir'
                      : 'Total penjualan per minggu dalam sebulan terakhir'
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  {loading ? (
                    <div className="h-full flex items-center justify-center">
                      <p className="text-muted-foreground">Memuat data...</p>
                    </div>
                  ) : dashboardData.salesData && dashboardData.salesData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={dashboardData.salesData}
                        margin={{
                          top: 5,
                          right: 5,
                          left: 5,
                          bottom: 5,
                        }}
                      >
                        <defs>
                          <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.8} />
                            <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 12 }}
                        />
                        <YAxis
                          tick={{ fontSize: 12 }}
                          tickFormatter={(value) =>
                            value >= 1000000
                              ? `${(value / 1000000).toFixed(0)} Jt`
                              : `${(value / 1000).toFixed(0)} Rb`
                          }
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Area
                          type="monotone"
                          dataKey="sales"
                          stroke="#0ea5e9"
                          fillOpacity={1}
                          fill="url(#colorSales)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center">
                      <p className="text-muted-foreground">Tidak ada data penjualan</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Grafik penjualan per kategori */}
            <Card className="col-span-2">
              <CardHeader>
                <CardTitle>Penjualan per Kategori</CardTitle>
                <CardDescription>Distribusi penjualan berdasarkan kategori produk</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  {loading ? (
                    <div className="h-full flex items-center justify-center">
                      <p className="text-muted-foreground">Memuat data...</p>
                    </div>
                  ) : dashboardData.categorySales && dashboardData.categorySales.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
                        <Pie
                          data={dashboardData.categorySales}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                        >
                          {dashboardData.categorySales.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => formatRupiah(value as number)} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center">
                      <p className="text-muted-foreground">Tidak ada data kategori</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 grid-cols-1">
            {/* Grafik heatmap waktu transaksi */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Waktu Transaksi Terpadat</span>
                  <BarChart className="h-4 w-4 text-muted-foreground" />
                </CardTitle>
                <CardDescription>
                  {timeFilter === 'day' && 'Jumlah transaksi per jam dalam sehari'}
                  {timeFilter === 'week' && 'Jumlah transaksi per hari dalam seminggu'}
                  {timeFilter === 'month' && 'Jumlah transaksi per minggu dalam sebulan'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  {loading ? (
                    <div className="h-full flex items-center justify-center">
                      <p className="text-muted-foreground">Memuat data...</p>
                    </div>
                  ) : dashboardData.hourlyTransactions && dashboardData.hourlyTransactions.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsBarChart
                        data={dashboardData.hourlyTransactions.filter(item => item.transactions > 0)}
                        margin={{
                          top: 10, right: 10, left: 10, bottom: 30,
                        }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="hour"
                          tick={{ fontSize: 12 }}
                          interval={0}
                          angle={-45}
                          textAnchor="end"
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fontSize: 12 }}
                        />
                        <Tooltip
                          formatter={(value) => [`${value} transaksi`, 'Jumlah']}
                          labelFormatter={(label) => {
                            if (timeFilter === 'day') return `Jam ${label}`;
                            if (timeFilter === 'week') return `${label}`;
                            if (timeFilter === 'month') return `${label}`;
                            return label;
                          }}
                        />
                        <Bar
                          dataKey="transactions"
                          fill="#8884d8"
                          radius={[4, 4, 0, 0]}
                          maxBarSize={40}
                        />
                      </RechartsBarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center">
                      <p className="text-muted-foreground">Tidak ada data transaksi</p>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground pt-4 text-center">
                  {getPeakTransactionTime()}
                </p>
              </CardContent>
            </Card>

            {/* Grafik peningkatan penjualan */}

          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="col-span-2 md:col-span-1 lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Produk Terlaris</span>
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline>
                    <polyline points="16 7 22 7 22 13"></polyline>
                  </svg>
                </CardTitle>
                <CardDescription>Lima produk dengan kinerja terbaik pada periode ini</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="qty" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-4">
                    <TabsTrigger value="qty">Paling Banyak Terjual</TabsTrigger>
                    <TabsTrigger value="revenue">Paling Menghasilkan</TabsTrigger>
                  </TabsList>
                  
                  {/* TAB 1: BY QUANTITY */}
                  <TabsContent value="qty">
                    {loading ? (
                      <div className="h-[200px] flex items-center justify-center">
                        <p className="text-muted-foreground">Memuat data...</p>
                      </div>
                    ) : dashboardData.topProducts?.byQuantity && dashboardData.topProducts.byQuantity.length > 0 ? (
                      <div className="space-y-4">
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead>
                              <tr className="border-b">
                                <th className="text-left whitespace-nowrap px-2 py-2 font-medium text-sm">Produk</th>
                                <th className="text-center whitespace-nowrap px-2 py-2 font-medium text-sm">Terjual</th>
                                <th className="text-right whitespace-nowrap px-2 py-2 font-medium text-sm">Pendapatan</th>
                              </tr>
                            </thead>
                            <tbody>
                              {dashboardData.topProducts.byQuantity.map((product) => (
                                <tr key={product.id} className="border-b">
                                  <td className="px-2 py-2">
                                    <div>
                                      <div className="font-medium text-sm truncate max-w-[110px] sm:max-w-none" title={product.name}>{product.name}</div>
                                      <div className="text-xs text-muted-foreground truncate max-w-[110px] sm:max-w-none">{product.category || 'Tidak Terkategori'}</div>
                                    </div>
                                  </td>
                                  <td className="text-center px-2 py-2">
                                    <Badge variant="secondary" className="font-bold whitespace-nowrap text-xs">
                                      {product.quantity} {product.unit}
                                    </Badge>
                                  </td>
                                  <td className="text-right px-2 py-2">
                                    <div className="text-muted-foreground text-sm whitespace-nowrap">{formatRupiah(product.revenue)}</div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <div className="h-[200px] flex items-center justify-center">
                        <p className="text-muted-foreground">Tidak ada data penjualan</p>
                      </div>
                    )}
                  </TabsContent>

                  {/* TAB 2: BY REVENUE */}
                  <TabsContent value="revenue">
                    {loading ? (
                      <div className="h-[200px] flex items-center justify-center">
                        <p className="text-muted-foreground">Memuat data...</p>
                      </div>
                    ) : dashboardData.topProducts?.byRevenue && dashboardData.topProducts.byRevenue.length > 0 ? (
                      <div className="space-y-4">
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead>
                              <tr className="border-b">
                                <th className="text-left whitespace-nowrap px-2 py-2 font-medium text-sm">Produk</th>
                                <th className="text-center whitespace-nowrap px-2 py-2 font-medium text-sm">Terjual</th>
                                <th className="text-right whitespace-nowrap px-2 py-2 font-medium text-sm">Pendapatan</th>
                              </tr>
                            </thead>
                            <tbody>
                              {dashboardData.topProducts.byRevenue.map((product) => (
                                <tr key={product.id} className="border-b">
                                  <td className="px-2 py-2">
                                    <div>
                                      <div className="font-medium text-sm truncate max-w-[110px] sm:max-w-none" title={product.name}>{product.name}</div>
                                      <div className="text-xs text-muted-foreground truncate max-w-[110px] sm:max-w-none">{product.category || 'Tidak Terkategori'}</div>
                                    </div>
                                  </td>
                                  <td className="text-center px-2 py-2">
                                    <div className="text-muted-foreground text-sm whitespace-nowrap">{product.quantity} {product.unit}</div>
                                  </td>
                                  <td className="text-right px-2 py-2">
                                    <Badge variant="outline" className="font-bold border-green-500 text-green-600 whitespace-nowrap text-xs">
                                      {formatRupiah(product.revenue)}
                                    </Badge>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <div className="h-[200px] flex items-center justify-center">
                        <p className="text-muted-foreground">Tidak ada data penjualan</p>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
            {/* Produk Terlaris */}

        </TabsContent>

      </Tabs>
    </div>
  );
}