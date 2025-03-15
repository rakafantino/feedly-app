"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useEffect, useCallback } from "react";
import { useProductStore } from "@/store/useProductStore";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, Package, ExternalLink, ArrowUp, BarChart } from "lucide-react";
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
import { useSocket } from "@/lib/useSocket";

// Fallback data jika API gagal
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function DashboardPage() {
  const { getLowStockProducts, fetchProducts } = useProductStore();
  const [lowStockProducts, setLowStockProducts] = useState<Array<any>>([]);
  const [timeFilter, setTimeFilter] = useState<'day' | 'week' | 'month'>('day');
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<{
    todayTotal: number;
    percentageChange: number;
    totalItemsSold: number;
    transactionCount: number;
    salesData: Array<{name: string, sales: number}>;
    categorySales: Array<{name: string, value: number}>;
    hourlyTransactions: Array<{hour: string, transactions: number}>;
    categoryGrowth: Array<{name: string, growth: number}>;
    topProducts?: {
      byQuantity: Array<{id: string, name: string, category: string | null, quantity: number, revenue: number, unit: string}>;
      byRevenue: Array<{id: string, name: string, category: string | null, quantity: number, revenue: number, unit: string}>;
    };
    worstProducts?: {
      byQuantity: Array<{id: string, name: string, category: string | null, quantity: number, revenue: number, unit: string}>;
      byRevenue: Array<{id: string, name: string, category: string | null, quantity: number, revenue: number, unit: string}>;
    };
  }>({
    todayTotal: 0,
    percentageChange: 0,
    totalItemsSold: 0,
    transactionCount: 0,
    salesData: [],
    categorySales: [],
    hourlyTransactions: [],
    categoryGrowth: []
  });
  
  const router = useRouter();
  
  // Gunakan socket context untuk low stock monitoring
  const socketContext = useSocket();

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
          categoryGrowth: data.categoryGrowth || [],
          topProducts: data.topProducts || { byQuantity: [], byRevenue: [] },
          worstProducts: data.worstProducts || { byQuantity: [], byRevenue: [] }
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
        categoryGrowth: [],
        topProducts: { byQuantity: [], byRevenue: [] },
        worstProducts: { byQuantity: [], byRevenue: [] }
      });
    } finally {
      setLoading(false);
    }
  }, [timeFilter]);

  // Effect untuk mengambil data produk
  useEffect(() => {
    // Ambil data produk dan low stock
    fetchProducts().then(() => {
      setLowStockProducts(getLowStockProducts());
    });
    
    // Ambil data dashboard
    fetchDashboardData();
  }, [fetchProducts, getLowStockProducts, fetchDashboardData]);
  
  // Effect khusus untuk memantau perubahan lowStockCount dari socket
  useEffect(() => {
    if (socketContext) {
      // Ketika lowStockCount berubah, refresh data produk
      fetchProducts().then(() => {
        setLowStockProducts(getLowStockProducts());
      });
    }
  }, [socketContext?.lowStockCount, fetchProducts, getLowStockProducts]);
  
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
    
    return `Jam ${peakHour.hour} adalah waktu terpadat dengan ${peakHour.transactions} transaksi`;
  };

  // Cari kategori dengan pertumbuhan tertinggi
  const getTopGrowthCategory = () => {
    if (!dashboardData.categoryGrowth || dashboardData.categoryGrowth.length === 0) {
      return '(tidak ada data)';
    }
    
    const topCategory = dashboardData.categoryGrowth[0];
    return `${topCategory.name} memiliki pertumbuhan penjualan tertinggi (${topCategory.growth}%)`;
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Penjualan (Hari Ini)
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
            <div className="text-2xl font-bold">{formatRupiah(dashboardData.todayTotal)}</div>
            <p className="text-xs text-muted-foreground">
              {dashboardData.percentageChange >= 0 ? '+' : ''}{dashboardData.percentageChange.toFixed(1)}% dari kemarin
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Produk Terjual Hari Ini
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
            <div className="text-2xl font-bold">{dashboardData.totalItemsSold} item</div>
            <p className="text-xs text-muted-foreground">
              {dashboardData.transactionCount} transaksi hari ini
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
          <TabsTrigger value="low-stock">Stok Menipis</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:justify-between mb-4 gap-3">
            <div className="flex justify-center sm:justify-start w-full sm:w-auto">
              <div className="inline-flex rounded-md border p-1 shadow-sm w-full sm:w-auto">
                <button
                  onClick={() => setTimeFilter('day')}
                  className={`flex-1 px-3 py-1.5 text-sm ${
                    timeFilter === 'day' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'text-muted-foreground'
                  } rounded-sm transition-colors`}
                >
                  Hari
                </button>
                <button
                  onClick={() => setTimeFilter('week')}
                  className={`flex-1 px-3 py-1.5 text-sm ${
                    timeFilter === 'week' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'text-muted-foreground'
                  } rounded-sm transition-colors`}
                >
                  Minggu
                </button>
                <button
                  onClick={() => setTimeFilter('month')}
                  className={`flex-1 px-3 py-1.5 text-sm ${
                    timeFilter === 'month' 
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
            {/* Grafik penjualan mingguan */}
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
                            <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
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
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:justify-between mb-4 gap-3">
            <div className="flex justify-center sm:justify-start w-full sm:w-auto">
              <div className="inline-flex rounded-md border p-1 shadow-sm w-full sm:w-auto">
                <button
                  onClick={() => setTimeFilter('day')}
                  className={`flex-1 px-3 py-1.5 text-sm ${
                    timeFilter === 'day' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'text-muted-foreground'
                  } rounded-sm transition-colors`}
                >
                  Hari
                </button>
                <button
                  onClick={() => setTimeFilter('week')}
                  className={`flex-1 px-3 py-1.5 text-sm ${
                    timeFilter === 'week' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'text-muted-foreground'
                  } rounded-sm transition-colors`}
                >
                  Minggu
                </button>
                <button
                  onClick={() => setTimeFilter('month')}
                  className={`flex-1 px-3 py-1.5 text-sm ${
                    timeFilter === 'month' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'text-muted-foreground'
                  } rounded-sm transition-colors`}
                >
                  Bulan
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Grafik heatmap waktu transaksi */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Waktu Transaksi Terpadat</span>
                  <BarChart className="h-4 w-4 text-muted-foreground" />
                </CardTitle>
                <CardDescription>Jumlah transaksi per jam dalam sehari</CardDescription>
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
                          labelFormatter={(label) => `Jam ${label}`}
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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Tren Kategori Terlaris</span>
                  <ArrowUp className="h-4 w-4 text-muted-foreground" />
                </CardTitle>
                <CardDescription>Kategori dengan pertumbuhan penjualan tertinggi</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  {loading ? (
                    <div className="h-full flex items-center justify-center">
                      <p className="text-muted-foreground">Memuat data...</p>
                    </div>
                  ) : dashboardData.categoryGrowth && dashboardData.categoryGrowth.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsBarChart
                        layout="vertical"
                        data={dashboardData.categoryGrowth}
                        margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis 
                          type="number" 
                          domain={[0, 'dataMax']}
                          tickFormatter={(value) => `${value}%`}
                        />
                        <YAxis 
                          dataKey="name" 
                          type="category" 
                          tick={{ fontSize: 12 }}
                          width={100}
                        />
                        <Tooltip 
                          formatter={(value) => [`${value}%`, 'Pertumbuhan']}
                        />
                        <Bar 
                          dataKey="growth" 
                          fill="#10b981"
                          radius={[0, 4, 4, 0]}
                        />
                      </RechartsBarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center">
                      <p className="text-muted-foreground">Tidak ada data pertumbuhan</p>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground pt-4 text-center">
                  {getTopGrowthCategory()}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Section baru untuk produk terlaris */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Produk Terlaris */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Produk Terlaris</span>
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline>
                    <polyline points="16 7 22 7 22 13"></polyline>
                  </svg>
                </CardTitle>
                <CardDescription>Lima produk dengan penjualan tertinggi berdasarkan jumlah terjual</CardDescription>
              </CardHeader>
              <CardContent>
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
                            <th className="text-left whitespace-nowrap px-4 py-2 font-medium">Produk</th>
                            <th className="text-center whitespace-nowrap px-4 py-2 font-medium">Terjual</th>
                            <th className="text-right whitespace-nowrap px-4 py-2 font-medium">Pendapatan</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dashboardData.topProducts.byQuantity.map((product) => (
                            <tr key={product.id} className="border-b">
                              <td className="px-4 py-2">
                                <div>
                                  <div className="font-medium">{product.name}</div>
                                  <div className="text-xs text-muted-foreground">{product.category || 'Tidak Terkategori'}</div>
                                </div>
                              </td>
                              <td className="text-center px-4 py-2">
                                <div className="font-medium">{product.quantity} {product.unit}</div>
                              </td>
                              <td className="text-right px-4 py-2">
                                <div className="font-medium">{formatRupiah(product.revenue)}</div>
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
              </CardContent>
            </Card>

            {/* Produk Kurang Perform */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Produk Kurang Perform</span>
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                    <polyline points="22 17 13.5 8.5 8.5 13.5 2 7"></polyline>
                    <polyline points="16 17 22 17 22 11"></polyline>
                  </svg>
                </CardTitle>
                <CardDescription>Lima produk dengan penjualan terendah berdasarkan jumlah terjual</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="h-[200px] flex items-center justify-center">
                    <p className="text-muted-foreground">Memuat data...</p>
                  </div>
                ) : dashboardData.worstProducts?.byQuantity && dashboardData.worstProducts.byQuantity.length > 0 ? (
                  <div className="space-y-4">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left whitespace-nowrap px-4 py-2 font-medium">Produk</th>
                            <th className="text-center whitespace-nowrap px-4 py-2 font-medium">Terjual</th>
                            <th className="text-right whitespace-nowrap px-4 py-2 font-medium">Pendapatan</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dashboardData.worstProducts.byQuantity.map((product) => (
                            <tr key={product.id} className="border-b">
                              <td className="px-4 py-2">
                                <div>
                                  <div className="font-medium">{product.name}</div>
                                  <div className="text-xs text-muted-foreground">{product.category || 'Tidak Terkategori'}</div>
                                </div>
                              </td>
                              <td className="text-center px-4 py-2">
                                <div className="font-medium">{product.quantity} {product.unit}</div>
                              </td>
                              <td className="text-right px-4 py-2">
                                <div className="font-medium">{formatRupiah(product.revenue)}</div>
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
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="low-stock" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Daftar Produk dengan Stok Menipis</CardTitle>
              <Button
                variant="outline"
                size="sm"
                title="Muat ulang data stok menipis dari server"
                onClick={() => {
                  fetchProducts().then(() => {
                    const lowStockList = getLowStockProducts();
                    setLowStockProducts(lowStockList);
                    toast.success(`Data diperbarui: ${lowStockList.length} produk dengan stok menipis`);
                    console.log("Semua produk:", useProductStore.getState().products);
                    console.log("Produk stok menipis:", lowStockList);
                  });
                }}
              >
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  width="16" 
                  height="16" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  className="mr-2"
                >
                  <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                  <path d="M3 3v5h5"></path>
                  <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"></path>
                  <path d="M16 21h5v-5"></path>
                </svg>
                Refresh Data
              </Button>
            </CardHeader>
            <CardContent>
              {/* Tampilkan jumlah stok dari SocketContext */}
              <div className="mb-4 p-3 bg-muted rounded-lg">
                <p className="text-sm font-medium">Informasi Sistem:</p>
                <p className="text-xs text-muted-foreground">Socket WebSocket mendeteksi {socketContext?.lowStockCount || 0} produk dengan stok menipis</p>
                <p className="text-xs text-muted-foreground">Data lokal menampilkan {lowStockProducts.length} produk dengan stok menipis</p>
                <p className="text-xs text-muted-foreground">Total produk dalam database: {useProductStore.getState().products.length}</p>
                <div className="mt-4 flex justify-end">
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    onClick={() => router.push('/low-stock')}
                  >
                    <span className="mr-2">Lihat Semua</span>
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              {lowStockProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="bg-primary/10 text-primary rounded-full p-3 mb-3">
                    <Package className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-medium mb-1">Semua stok dalam kondisi baik</h3>
                  <p className="text-muted-foreground max-w-md">
                    Saat ini tidak ada produk yang stoknya mendekati nilai minimum (threshold)
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left whitespace-nowrap px-4 py-2 font-medium">Produk</th>
                          <th className="text-center whitespace-nowrap px-4 py-2 font-medium">Stok Saat Ini</th>
                          <th className="text-center whitespace-nowrap px-4 py-2 font-medium">Stok Minimum</th>
                          <th className="text-center whitespace-nowrap px-4 py-2 font-medium">Status</th>
                          <th className="text-right whitespace-nowrap px-4 py-2 font-medium">Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lowStockProducts.map((product) => (
                          <tr key={product.id} className="border-b">
                            <td className="px-4 py-2">
                              <div>
                                <div className="font-medium">{product.name}</div>
                                <div className="text-xs text-muted-foreground">{product.category}</div>
                              </div>
                            </td>
                            <td className="text-center px-4 py-2">
                              <div className="text-center font-medium">
                                {product.stock} {product.unit}
                              </div>
                            </td>
                            <td className="text-center px-4 py-2">
                              <div className="text-center">
                                {product.threshold} {product.unit}
                              </div>
                            </td>
                            <td className="text-center px-4 py-2">
                              <Badge 
                                variant={product.stock === 0 ? "destructive" : "warning"}
                                className="justify-center"
                              >
                                {product.stock === 0 ? "Habis" : "Menipis"}
                              </Badge>
                            </td>
                            <td className="text-right px-4 py-2">
                              <Button 
                                onClick={() => router.push(`/low-stock`)}
                                variant="outline" 
                                size="sm"
                                className="h-8 w-8 p-0"
                              >
                                <ExternalLink className="h-4 w-4" />
                                <span className="sr-only">Lihat semua stok menipis</span>
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}