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
  Bell, 
  Box, 
  Package, 
  ShoppingCart,
  BarChart3,
  Download,
  FileText,
  FileBarChart
} from 'lucide-react';
import { formatRupiah } from '@/lib/utils';
import { Product } from '@/types/product';
import { useSocket } from '@/lib/useSocket';
import LowStockTable from './components/LowStockTable';
import StockAlertsList from './components/StockAlertsList';
import ThresholdConfig from './components/ThresholdConfig';
import PurchaseSuggestions from './components/PurchaseSuggestions';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

export default function LowStockPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const { stockAlerts } = useSocket();
  
  // Tambahkan state untuk tab analitik
  const [stockByCategory, setStockByCategory] = useState<Array<{name: string, count: number, value: number}>>([]);
  const [timeFilter, setTimeFilter] = useState<'day' | 'week' | 'month'>('week');

  const fetchLowStockProducts = async () => {
    try {
      const response = await fetch('/api/products/low-stock');
      if (!response.ok) {
        throw new Error('Failed to fetch low stock products');
      }
      const data = await response.json();
      setLowStockProducts(data.products || []);
      return data.products || [];
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

  // Fungsi untuk memperbarui semua data
  const refreshData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchLowStockProducts(),
        fetchAllProducts()
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
          fetchAllProducts()
        ]);
      } catch (error) {
        console.error('Error loading initial data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, []);

  // Tambahkan fungsi untuk menghitung statistik stok per kategori
  const calculateStockStats = useCallback(() => {
    if (!allProducts.length) return;
    
    // Kelompokkan produk berdasarkan kategori
    const categoryGroups: Record<string, {count: number, value: number}> = {};
    
    allProducts.forEach(product => {
      const category = product.category || 'Tidak Terkategori';
      if (!categoryGroups[category]) {
        categoryGroups[category] = { count: 0, value: 0 };
      }
      categoryGroups[category].count += 1;
      categoryGroups[category].value += product.price * product.stock;
    });
    
    // Konversi ke format array untuk chart
    const stats = Object.entries(categoryGroups).map(([name, stats]) => ({
      name,
      count: stats.count,
      value: stats.value
    }));
    
    setStockByCategory(stats);
  }, [allProducts]);

  // Tambahkan useEffect untuk menghitung statistik
  useEffect(() => {
    if (allProducts.length > 0) {
      calculateStockStats();
    }
  }, [allProducts, calculateStockStats]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col">
        <h1 className="text-3xl font-bold tracking-tight">Manajemen Stok</h1>
        <p className="text-muted-foreground">
          Kelola stok, pantau produk dengan stok menipis, dan atur threshold notifikasi.
        </p>
      </div>

      {/* Kartu ringkasan stok */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Produk Stok Menipis
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '...' : lowStockProducts.length}</div>
            <p className="text-xs text-muted-foreground">
              Produk yang tersisa di bawah threshold
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Notifikasi Stok
            </CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stockAlerts.length}</div>
            <p className="text-xs text-muted-foreground">
              Notifikasi stok menipis aktif
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Nilai Produk Terikat
            </CardTitle>
            <Box className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? (
                '...'
              ) : (
                formatRupiah(
                  lowStockProducts.reduce(
                    (total, product) => total + product.price * product.stock,
                    0
                  )
                )
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Total nilai produk stok menipis
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pesanan Tertunda
            </CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">
              Pesanan ke pemasok dalam proses
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs untuk berbagai fungsi manajemen stok */}
      <Tabs 
        defaultValue="overview" 
        value={activeTab} 
        onValueChange={setActiveTab}
        className="space-y-4"
      >
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="alerts">Notifikasi Stok</TabsTrigger>
          <TabsTrigger value="threshold">Konfigurasi Threshold</TabsTrigger>
          <TabsTrigger value="purchase">Saran Pembelian</TabsTrigger>
          <TabsTrigger value="analytics">Analitik</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-4">
          <LowStockTable products={lowStockProducts} loading={loading} refreshData={refreshData} />
        </TabsContent>
        
        <TabsContent value="alerts" className="space-y-4">
          <StockAlertsList />
        </TabsContent>
        
        <TabsContent value="threshold" className="space-y-4">
          <ThresholdConfig products={allProducts} refreshData={refreshData} />
        </TabsContent>
        
        <TabsContent value="purchase" className="space-y-4">
          <PurchaseSuggestions products={lowStockProducts} />
        </TabsContent>
        
        {/* Tab baru untuk visualisasi data stok */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="flex justify-between mb-4">
            <div className="inline-flex rounded-md border p-1 shadow-sm">
              <button
                onClick={() => setTimeFilter('day')}
                className={`px-3 py-1 text-sm ${
                  timeFilter === 'day' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'text-muted-foreground'
                } rounded-sm transition-colors`}
              >
                Hari
              </button>
              <button
                onClick={() => setTimeFilter('week')}
                className={`px-3 py-1 text-sm ${
                  timeFilter === 'week' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'text-muted-foreground'
                } rounded-sm transition-colors`}
              >
                Minggu
              </button>
              <button
                onClick={() => setTimeFilter('month')}
                className={`px-3 py-1 text-sm ${
                  timeFilter === 'month' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'text-muted-foreground'
                } rounded-sm transition-colors`}
              >
                Bulan
              </button>
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
                    Nilai: p.price * p.stock
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
              >
                <Download className="h-4 w-4 mr-2" />
                Export Data
              </Button>
            </div>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2">
            {/* Grafik Kategori dengan Stok Rendah */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Kategori dengan Stok Rendah</span>
                  <BarChart3 className="h-5 w-5 text-muted-foreground" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
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
                        }, [] as {name: string, count: number}[])
                        .sort((a, b) => b.count - a.count)
                        .slice(0, 5)
                      }
                      margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" />
                      <YAxis allowDecimals={false} />
                      <Tooltip
                        formatter={(value) => [value, 'Jumlah Produk']}
                        labelFormatter={(label) => `Kategori: ${label}`}
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
                <p className="text-xs text-muted-foreground pt-2 text-center">
                  Menampilkan 5 kategori teratas dengan produk stok rendah
                </p>
              </CardContent>
            </Card>
            
            {/* Grafik Distribusi Nilai Stok */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Distribusi Nilai Stok</span>
                  <Box className="h-5 w-5 text-muted-foreground" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stockByCategory
                          .sort((a, b) => b.value - a.value)
                          .slice(0, 6)
                        }
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={1}
                        dataKey="value"
                        nameKey="name"
                        label={(entry) => entry.name}
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
                      <Tooltip 
                        formatter={(value: number) => formatRupiah(value)}
                        labelFormatter={(label) => `Kategori: ${label}`}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-xs text-muted-foreground pt-2 text-center">
                  Distribusi nilai stok berdasarkan kategori
                </p>
              </CardContent>
            </Card>
          </div>
          
          {/* Custom Report Builder */}
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Custom Report Builder</span>
                <FileText className="h-5 w-5 text-muted-foreground" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-4 justify-between">
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium">Field yang Tersedia</h3>
                    <div className="border rounded-md p-3 min-h-[120px]">
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: 'name', label: 'Nama Produk' },
                          { id: 'category', label: 'Kategori' },
                          { id: 'stock', label: 'Stok Saat Ini' },
                          { id: 'unit', label: 'Unit' },
                          { id: 'threshold', label: 'Threshold' }, 
                          { id: 'price', label: 'Harga' }
                        ].map(field => (
                          <div 
                            key={field.id}
                            className="border rounded p-2 text-sm cursor-move bg-background hover:bg-muted transition-colors"
                            draggable
                          >
                            {field.label}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium">Field yang Dipilih</h3>
                    <div className="border rounded-md p-3 min-h-[120px] border-dashed">
                      <div className="flex flex-col gap-2">
                        <div className="text-xs text-muted-foreground text-center p-4">
                          Seret dan lepas field di sini untuk membangun laporan kustom
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row justify-between items-center pt-4 border-t">
                  <div className="flex gap-2 mb-4 sm:mb-0">
                    <span className="text-sm font-medium">Format:</span>
                    <Select defaultValue="pdf">
                      <SelectTrigger className="w-[120px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pdf">PDF</SelectItem>
                        <SelectItem value="excel">Excel</SelectItem>
                        <SelectItem value="csv">CSV</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <span className="text-sm font-medium ml-2">Jadwalkan:</span>
                    <Select defaultValue="none">
                      <SelectTrigger className="w-[150px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Tidak Ada</SelectItem>
                        <SelectItem value="daily">Setiap Hari</SelectItem>
                        <SelectItem value="weekly">Setiap Minggu</SelectItem>
                        <SelectItem value="monthly">Setiap Bulan</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <Button variant="default" size="sm">
                    <FileBarChart className="h-4 w-4 mr-2" />
                    Generate Report
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 