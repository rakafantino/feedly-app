'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Box,
  Package,
  ShoppingCart,
  BarChart3,
  Download,
  Menu,
  Calendar,
  TrendingUp,
  FileText
} from 'lucide-react';
import { formatRupiah } from '@/lib/utils';
import { Product } from '@/types/product';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Sheet,
  SheetContent,
  SheetTrigger
} from '@/components/ui/sheet';
import LowStockTable from './components/LowStockTable';
import ThresholdConfig from './components/ThresholdConfig';
import ExpiryDateAnalysis from './components/ExpiryDateAnalysis';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import PurchaseOrdersList from './components/PurchaseOrdersList';

// Tambahkan interface untuk PO
interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  createdAt: string;
  estimatedDelivery: string;
  status: 'draft' | 'sent' | 'processing' | 'completed' | 'cancelled';
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unit: string;
    price: number;
  }>;
  notes?: string;
}

export default function LowStockPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);

  // Tambahkan state untuk menghitung produk yang akan kadaluarsa
  const [expiringProductsCount, setExpiringProductsCount] = useState(0);

  // Tambahkan state untuk PO
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const [loadingPurchaseOrders, setLoadingPurchaseOrders] = useState(true);

  // Tambahkan state untuk tab analitik
  const [stockByCategory, setStockByCategory] = useState<Array<{ name: string, count: number, value: number }>>([]);
  const [timeFilter, setTimeFilter] = useState<'day' | 'week' | 'month'>('week');
  // State untuk menyimpan data historis berdasarkan timeframe
  const [historicalData, setHistoricalData] = useState<Array<{ date: string, count: number, value: number }>>([]);

  const fetchLowStockProducts = async () => {
    try {
      // Tetap menggunakan API baru /api/stock-alerts
      const response = await fetch('/api/stock-alerts');
      if (!response.ok) {
        throw new Error('Failed to fetch low stock products');
      }
      const data = await response.json();
      // Tetap menggunakan mapping baru
      const products = (data.notifications || []).map((notification: any) => ({
        id: notification.productId,
        name: notification.productName,
        stock: notification.currentStock,
        threshold: notification.threshold,
        unit: notification.unit,
        category: notification.category,
        price: notification.price || 0,
        supplierId: notification.supplierId || null
      }));
      setLowStockProducts(products || []);
      return products;
    } catch (error) {
      console.error('Error fetching low stock products:', error);
      return [];
    }
  };

  const fetchAllProducts = async () => {
    try {
      const response = await fetch('/api/products?limit=100');
      if (!response.ok) {
        throw new Error('Failed to fetch products');
      }
      const data = await response.json();
      setAllProducts(data.products || []);
      return data.products || [];
    } catch (error) {
      console.error('Error fetching products:', error);
      return [];
    }
  };

  // Tambahkan fungsi untuk mengambil data PO
  const fetchPurchaseOrders = async () => {
    try {
      setLoadingPurchaseOrders(true);
      const response = await fetch('/api/purchase-orders');
      if (response.ok) {
        const data = await response.json();
        const orders = data.purchaseOrders || [];
        setPurchaseOrders(orders);

        // Hitung PO yang masih dalam proses
        const pendingOrders = orders.filter((order: PurchaseOrder) =>
          ['draft', 'sent', 'processing'].includes(order.status)
        );
        setPendingOrdersCount(pendingOrders.length);
      }
    } catch (error) {
      console.error('Error fetching purchase orders:', error);
    } finally {
      setLoadingPurchaseOrders(false);
    }
  };

  // Fungsi untuk memperbarui semua data
  const refreshData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchLowStockProducts(),
        fetchAllProducts(),
        fetchPurchaseOrders()
      ]);
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      try {
        await Promise.all([
          fetchLowStockProducts(),
          fetchAllProducts(),
          fetchPurchaseOrders()
        ]);
      } catch (error) {
        console.error('Error loading initial data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, []);

  // Fungsi untuk mobile tab scroll
  const scrollToTab = (tabId: string) => {
    const tabList = document.getElementById('tab-list');
    const tabElement = document.getElementById(`tab-${tabId}`);

    if (tabList && tabElement) {
      tabList.scrollLeft = tabElement.offsetLeft - tabList.offsetWidth / 3;
    }
  };

  // Handler untuk tab change yang juga mengatur scroll
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    scrollToTab(value);
  };

  // Tambahkan fungsi untuk menghitung statistik stok per kategori
  const calculateStockStats = useCallback(() => {
    if (!allProducts.length) return;

    // Kelompokkan produk berdasarkan kategori
    const categoryGroups: Record<string, { count: number, value: number }> = {};

    allProducts.forEach(product => {
      const category = product.category || 'Tidak Terkategori';
      if (!categoryGroups[category]) {
        categoryGroups[category] = { count: 0, value: 0 };
      }
      categoryGroups[category].count += 1;
      categoryGroups[category].value += (product.price || 0) * (product.stock || 0);
    });

    // Konversi ke format array untuk chart
    const stats = Object.entries(categoryGroups).map(([name, stats]) => ({
      name,
      count: stats.count,
      value: stats.value
    }));

    setStockByCategory(stats);
  }, [allProducts]);

  // State untuk menyimpan batas notifikasi kadaluarsa
  const [expiryNotificationDays, setExpiryNotificationDays] = useState(30);

  // Fetch settings when component mounts
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/settings');
        const data = await response.json();
        if (data.success && data.data && data.data.expiryNotificationDays) {
          setExpiryNotificationDays(data.data.expiryNotificationDays);
        }
      } catch (error) {
        console.error('Failed to fetch settings:', error);
      }
    };
    fetchSettings();
  }, []);

  // Tambahkan fungsi untuk menghitung produk yang akan kadaluarsa
  const calculateExpiringProducts = useCallback(() => {
    if (!allProducts.length) return;

    const now = new Date();
    // Reset jam agar perbandingan tanggal akurat
    now.setHours(0, 0, 0, 0);
    
    const notificationDate = new Date(now);
    notificationDate.setDate(now.getDate() + expiryNotificationDays);

    const expiring = allProducts.filter(product => {
      // Periksa apakah produk memiliki expiry_date
      if (!product.expiry_date || product.stock <= 0 || product.isDeleted) return false;

      const expiryDate = new Date(product.expiry_date);
      expiryDate.setHours(0, 0, 0, 0);
      
      // Produk yang akan kadaluarsa dalam X hari ke depan (sesuai setting)
      return expiryDate >= now && expiryDate <= notificationDate;
    });

    setExpiringProductsCount(expiring.length);
  }, [allProducts, expiryNotificationDays]);

  // Fungsi untuk mendapatkan data historis berdasarkan timeframe
  const fetchHistoricalData = useCallback(async () => {
    try {
      // Gunakan API analitik yang tersedia
      const endpoint = `/api/analytics/stock?timeframe=${timeFilter}`;

      // Mengirim permintaan ke API
      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error('Failed to fetch historical data');
      }

      const data = await response.json();

      // Update state dengan data dari API
      if (data.success) {
        setHistoricalData(data.history || []);

        // Update category stats jika ada
        if (data.categoryStats && data.categoryStats.length > 0) {
          setStockByCategory(data.categoryStats);
        }
      } else {
        throw new Error(data.error || 'Failed to fetch data');
      }

    } catch (error) {
      console.error('Error fetching historical data:', error);
      toast.error('Gagal memuat data historis. Silakan coba lagi nanti.');
      // Tampilkan array kosong daripada data dummy
      setHistoricalData([]);
    }
  }, [timeFilter]);

  // Ubah useEffect untuk menghitung statistik dan memuat data historis
  useEffect(() => {
    if (allProducts.length > 0) {
      calculateStockStats();
      fetchHistoricalData();
      calculateExpiringProducts();
    }
  }, [allProducts, calculateStockStats, fetchHistoricalData, calculateExpiringProducts]);

  // Panggil fetchHistoricalData saat timeFilter berubah
  useEffect(() => {
    if (allProducts.length > 0) {
      fetchHistoricalData();
    }
  }, [timeFilter, fetchHistoricalData, allProducts.length]);

  return (
    <div className="space-y-6 pb-16 sm:pb-0">
      <div className="flex flex-col">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Manajemen Stok</h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          Kelola stok, pantau produk dengan stok menipis, dan atur threshold notifikasi.
        </p>
      </div>

      {/* Kartu ringkasan stok - hanya 2 kartu yang relevan */}
      <div className="grid gap-3 grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader className="p-3 sm:p-6 flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">
              Pesanan Tertunda
            </CardTitle>
            <FileText className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-1 sm:pt-2">
            <div className="text-xl sm:text-2xl font-bold">
              {loadingPurchaseOrders ? '...' : pendingOrdersCount}
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">
              PO belum diterima
            </p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="p-3 sm:p-6 flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">
              Akan Kadaluarsa
            </CardTitle>
            <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-1 sm:pt-2">
            <div className="text-xl sm:text-2xl font-bold">{loading ? '...' : expiringProductsCount}</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">
              Dalam {expiryNotificationDays} hari
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Mobile Tab Selection Dropdown */}
      <div className="flex sm:hidden justify-between items-center mb-4">
        <div className="flex flex-col">
          <h2 className="text-lg font-semibold">
            {(() => {
              switch (activeTab) {
                case 'overview': return 'Overview';
                case 'threshold': return 'Konfigurasi Threshold';
                case 'purchase': return 'Purchase Orders';
                case 'analytics': return 'Analitik Stok';
                case 'expiry': return 'Analisis Kadaluarsa';
                case 'seasonal': return 'Analisis Musiman';
                default: return 'Overview';
              }
            })()}
          </h2>
          <p className="text-xs text-muted-foreground">
            {(() => {
              switch (activeTab) {
                case 'overview': return 'Daftar produk dengan stok menipis';
                case 'threshold': return 'Atur batas minimum stok';
                case 'purchase': return 'Rekomendasi untuk pembelian stok';
                case 'analytics': return 'Visualisasi data stok';
                case 'expiry': return 'Pantau produk yang akan kadaluarsa';
                case 'seasonal': return 'Analisis tren musiman produk';
                default: return 'Daftar produk dengan stok menipis';
              }
            })()}
          </p>
        </div>

        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="h-8 w-8">
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72 sm:max-w-none">
            <div className="py-4">
              <h2 className="text-lg font-semibold mb-2">Navigasi</h2>
              <div className="flex flex-col space-y-1">
                {[
                  { id: 'overview', label: 'Overview', icon: Package },
                  { id: 'threshold', label: 'Konfigurasi Threshold', icon: Box },
                  { id: 'purchase', label: 'Purchase Orders', icon: ShoppingCart },
                  { id: 'analytics', label: 'Analitik', icon: BarChart3 },
                  { id: 'expiry', label: 'Analisis Kadaluarsa', icon: Calendar },
                  { id: 'seasonal', label: 'Analisis Musiman', icon: TrendingUp }
                ].map((item) => (
                  <Button
                    key={item.id}
                    variant={activeTab === item.id ? 'default' : 'ghost'}
                    className="justify-start"
                    onClick={() => {
                      setActiveTab(item.id);
                      document.querySelector<HTMLDialogElement>('dialog[data-state="open"]')?.close();
                    }}
                  >
                    <item.icon className="h-4 w-4 mr-2" />
                    {item.label}
                  </Button>
                ))}
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Tabs */}
      <Tabs defaultValue="overview" onValueChange={handleTabChange} value={activeTab}>
        <div id="tab-list" className="overflow-x-auto hide-scrollbar pb-2">
          <TabsList className="h-auto inline-flex w-auto min-w-full p-0 bg-transparent border-b">
            <TabsTrigger
              value="overview"
              id="tab-overview"
              className="data-[state=active]:bg-background data-[state=active]:shadow rounded-none py-2.5"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="analytics"
              id="tab-analytics"
              className="data-[state=active]:bg-background data-[state=active]:shadow rounded-none py-2.5"
            >
              Analitik
            </TabsTrigger>
            <TabsTrigger
              value="threshold"
              id="tab-threshold"
              className="data-[state=active]:bg-background data-[state=active]:shadow rounded-none py-2.5"
            >
              Threshold
            </TabsTrigger>
            <TabsTrigger
              value="purchase"
              id="tab-purchase"
              className="data-[state=active]:bg-background data-[state=active]:shadow rounded-none py-2.5"
            >
              Purchase Orders
            </TabsTrigger>
            <TabsTrigger
              value="expiry"
              id="tab-expiry"
              className="data-[state=active]:bg-background data-[state=active]:shadow rounded-none py-2.5"
            >
              Analisis Kadaluarsa
            </TabsTrigger>
            <TabsTrigger
              value="seasonal"
              id="tab-seasonal"
              className="data-[state=active]:bg-background data-[state=active]:shadow rounded-none py-2.5"
            >
              Analisis Musiman
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-4">
          <LowStockTable products={lowStockProducts} loading={loading} refreshData={refreshData} />
        </TabsContent>

        <TabsContent value="threshold" className="space-y-4">
          <ThresholdConfig products={allProducts} refreshData={refreshData} />
        </TabsContent>

        <TabsContent value="purchase">
          <PurchaseOrdersList
            purchaseOrders={purchaseOrders}
            loading={loadingPurchaseOrders}
            refreshData={fetchPurchaseOrders}
          />
        </TabsContent>

        {/* Tab baru untuk visualisasi data stok */}
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

            <div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // Export data to Excel/CSV
                  const stockData = lowStockProducts.map(p => ({
                    Nama: p.name,
                    Kategori: p.category || '-',
                    Stok: p.stock,
                    Unit: p.unit || 'pcs',
                    Threshold: p.threshold || '-',
                    Harga: p.price,
                    Nilai: (p.price || 0) * (p.stock || 0)
                  }));

                  if (stockData.length === 0) {
                    toast.error('Tidak ada data untuk diekspor');
                    return;
                  }

                  // Export to CSV
                  const headers = Object.keys(stockData[0]);

                  let csvContent = headers.join(',') + '\n';
                  stockData.forEach(row => {
                    csvContent += Object.values(row).join(',') + '\n';
                  });

                  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  const timestamp = new Date().toISOString().split('T')[0];
                  link.setAttribute('href', url);
                  link.setAttribute('download', `laporan-stok-${timestamp}.csv`);
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);

                  toast.success('Data stok berhasil diekspor');
                }}
                className="w-full sm:w-auto text-xs sm:text-sm"
              >
                <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                Export Data
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Grafik Kategori dengan Stok Rendah */}
            <Card>
              <CardHeader className="px-3 sm:px-6 py-2 sm:py-4">
                <CardTitle className="text-sm sm:text-base flex items-center justify-between">
                  <span>Kategori dengan Stok Rendah</span>
                  <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                </CardTitle>
              </CardHeader>
              <CardContent className="px-2 sm:px-6 pb-4 sm:pb-6">
                <div className="h-[250px] sm:h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={lowStockProducts
                        .reduce((acc, product) => {
                          const category = product.category || 'Tidak Terkategori';
                          const existingCategory = acc.find(c => c.name === category);
                          if (existingCategory) {
                            existingCategory.count += 1;
                          } else {
                            acc.push({ name: category, count: 1 });
                          }
                          return acc;
                        }, [] as { name: string, count: number }[])
                        .sort((a, b) => b.count - a.count)
                        .slice(0, 5)
                      }
                      margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 10 }}
                        tickFormatter={(value) => value.length > 8 ? `${value.substring(0, 8)}...` : value}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 10 }}
                      />
                      <RechartsTooltip
                        formatter={(value) => [value, 'Jumlah Produk']}
                        labelFormatter={(label) => `Kategori: ${label}`}
                        contentStyle={{ fontSize: '12px' }}
                      />
                      <Bar
                        dataKey="count"
                        fill="#f43f5e"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={60}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-[10px] sm:text-xs text-muted-foreground pt-2 text-center">
                  Menampilkan 5 kategori teratas dengan produk stok rendah {timeFilter === 'day' ? 'hari ini' : timeFilter === 'week' ? 'minggu ini' : 'bulan ini'}
                </p>
              </CardContent>
            </Card>

            {/* Grafik Distribusi Nilai Stok */}
            <Card>
              <CardHeader className="px-3 sm:px-6 py-2 sm:py-4">
                <CardTitle className="text-sm sm:text-base flex items-center justify-between">
                  <span>Distribusi Nilai Stok</span>
                  <Box className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                </CardTitle>
              </CardHeader>
              <CardContent className="px-2 sm:px-6 pb-4 sm:pb-6">
                <div className="h-[250px] sm:h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stockByCategory
                          .sort((a, b) => b.value - a.value)
                          .slice(0, 6)
                        }
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={1}
                        dataKey="value"
                        nameKey="name"
                        label={(entry) => entry.name.length > 10 ? `${entry.name.substring(0, 10)}...` : entry.name}
                        labelLine={{ stroke: '#888888', strokeWidth: 0.5 }}
                      >
                        {stockByCategory.slice(0, 6).map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={[
                              '#f43f5e', '#fbbf24', '#9333ea',
                              '#3b82f6', '#10b981', '#6366f1'
                            ][index % 6]}
                          />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        formatter={(value: number) => formatRupiah(value)}
                        labelFormatter={(label) => `Kategori: ${label}`}
                        contentStyle={{ fontSize: '12px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-[10px] sm:text-xs text-muted-foreground pt-2 text-center">
                  Distribusi nilai stok berdasarkan kategori {timeFilter === 'day' ? 'hari ini' : timeFilter === 'week' ? 'minggu ini' : 'bulan ini'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Tambahkan grafik tren data historis */}
          <Card>
            <CardHeader className="px-3 sm:px-6 py-2 sm:py-4">
              <CardTitle className="text-sm sm:text-base flex items-center justify-between">
                <span>Tren Stok {timeFilter === 'day' ? 'Harian' : timeFilter === 'week' ? 'Mingguan' : 'Bulanan'}</span>
                <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
              </CardTitle>
            </CardHeader>
            <CardContent className="px-2 sm:px-6 pb-4 sm:pb-6">
              <div className="h-[250px] sm:h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={historicalData}
                    margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10 }}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 10 }}
                      yAxisId="left"
                    />
                    <YAxis
                      orientation="right"
                      tick={{ fontSize: 10 }}
                      tickFormatter={(value) => formatRupiah(value as number).split(' ')[0]}
                      yAxisId="right"
                    />
                    <RechartsTooltip
                      formatter={(value, name) => {
                        if (name === 'count') return [value, 'Jumlah Produk'];
                        if (name === 'value') return [formatRupiah(value as number), 'Nilai Stok'];
                        return [value, name];
                      }}
                      labelFormatter={(label) => `${timeFilter === 'day' ? 'Jam ' : timeFilter === 'week' ? 'Hari ' : ''
                        }${label}`}
                      contentStyle={{ fontSize: '12px' }}
                    />
                    <Bar
                      dataKey="count"
                      fill="#3b82f6"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={40}
                      yAxisId="left"
                      name="Jumlah Produk"
                    />
                    <Bar
                      dataKey="value"
                      fill="#10b981"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={40}
                      yAxisId="right"
                      name="Nilai Stok"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[10px] sm:text-xs text-muted-foreground pt-2 text-center">
                Tren perubahan jumlah dan nilai stok {
                  timeFilter === 'day' ? 'selama 24 jam terakhir' :
                    timeFilter === 'week' ? 'selama 7 hari terakhir' :
                      'selama 4 minggu terakhir'
                }
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expiry" className="pt-2">
          <ExpiryDateAnalysis products={allProducts} notificationDays={expiryNotificationDays} />
        </TabsContent>

        <TabsContent value="seasonal" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Analisis Musiman</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="bg-primary/10 text-primary rounded-full p-3 mb-3">
                  <TrendingUp className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-medium mb-1">Coming Soon</h3>
                <p className="text-muted-foreground max-w-md">
                  Fitur analisis tren musiman sedang dalam pengembangan dan akan tersedia dalam pembaruan berikutnya
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 