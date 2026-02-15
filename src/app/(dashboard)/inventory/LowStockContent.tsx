'use client';

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Box,
  Package,
  ShoppingCart,
  BarChart3,
  Menu,
  Calendar,
  ClipboardEdit
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetTrigger
} from '@/components/ui/sheet';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useProducts } from '@/hooks/useProducts';
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
import StockAdjustmentTab from './components/StockAdjustmentTab';
import { useStores } from '@/hooks/useStores';
import { StatsCard } from '@/components/ui/StatsCard';
import { PieChartSkeleton } from '@/components/skeleton';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@/components/ui/card';

interface AnalyticsResponse {
  pendingOrdersCount: number;
  expiringCount: number;
  categoryStats: { name: string; count: number; value: number }[];
  history: { date: string; count: number; value: number }[];
  success: boolean;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function LowStockPage() {
  const [activeTab, setActiveTab] = useState('products');
  const [activeSubTab, setActiveSubTab] = useState('products');
  const [timeFilter, setTimeFilter] = useState<'day' | 'week' | 'month'>('week');
  
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const subTabParam = searchParams.get('subtab');

  useEffect(() => {
    if (tabParam) {
      if (tabParam === 'orders') {
        setActiveTab('products');
        setActiveSubTab('orders');
      } else {
        setActiveTab(tabParam);
      }
    }
    if (subTabParam) {
      setActiveSubTab(subTabParam);
    }
  }, [tabParam, subTabParam]);

  // Get current store
  const { data: stores } = useStores();
  const currentStore = stores?.find(s => s.isActive) || stores?.[0];
  const storeId = currentStore?.id;

  // React Query for Analytics
  const { data: analyticsData, isLoading: loadingAnalytics } = useQuery<AnalyticsResponse>({
    queryKey: ['stock-analytics', timeFilter, storeId],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/stock?timeframe=${timeFilter}&storeId=${storeId || ''}`);
      if (!res.ok) throw new Error('Failed to fetch analytics');
      return res.json();
    },
    enabled: !!storeId || true,
  });

  // React Query for Low Stock Products
  const { data: lowStockData, isLoading: loadingLowStock, refetch: refetchLowStock } = useProducts({
    lowStock: true,
    limit: 100,
    minimal: true
  });
  const lowStockProducts = lowStockData?.products || [];

  // Conditional Fetch for Heavy Tabs
  const shouldFetchAllProducts = ['threshold', 'expiry', 'adjustment'].includes(activeTab);
  const { data: allProductsData, refetch: refetchAll } = useProducts({
    enabled: shouldFetchAllProducts,
    limit: 1000,
    minimal: false // Explicitly request full data (including batches)
  });
  const allProducts = allProductsData?.products || [];

  // Conditional Fetch for Orders Tab
  const { data: poResponse, isLoading: loadingPO, refetch: refetchPO } = useQuery({
    queryKey: ['purchase-orders', storeId],
    queryFn: async () => {
      const res = await fetch(`/api/purchase-orders${storeId ? `?storeId=${storeId}` : ''}`);
      if (!res.ok) throw new Error('Failed to fetch purchase orders');
      return res.json();
    },
    enabled: activeTab === 'orders' || activeTab === 'products',
  });

  const purchaseOrders = poResponse?.purchaseOrders || [];

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setActiveSubTab('products'); // Reset sub-tab when changing main tab
  };

  // Calculate stats
  const lowStockCount = lowStockProducts.length;
  const pendingOrdersCount = analyticsData?.pendingOrdersCount || purchaseOrders.filter((po: any) => po.status !== 'received' && po.status !== 'cancelled').length;
  const expiringProductsCount = analyticsData?.expiringCount || 0;
  const totalValue = lowStockProducts.reduce((sum: number, p: any) => sum + ((p.price || 0) * p.stock), 0);

  // Helper to format numbers
  const formatNumber = (num: number) => new Intl.NumberFormat('id-ID').format(num);

  const refreshData = async () => {
    await Promise.all([
      refetchLowStock(),
      refetchAll(),
      refetchPO(),
    ]);
  };

  return (
    <div className="space-y-6">
      {/* Cards Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatsCard
          title="Produk Low Stock"
          value={loadingLowStock ? '...' : formatNumber(lowStockCount)}
          subtitle="Perlu perhatian"
          icon={<Package className="h-5 w-5 text-primary" />}
          variant="highlight"
        />

        <StatsCard
          title="Pesanan Tertunda"
          value={loadingPO ? '...' : formatNumber(pendingOrdersCount)}
          subtitle="Menunggu penerimaan"
          icon={<ShoppingCart className="h-5 w-5 text-orange-500" />}
          variant="compact"
        />

        <StatsCard
          title="Produk Expired"
          value={loadingAnalytics ? '...' : formatNumber(expiringProductsCount)}
          subtitle="Dalam 30 hari"
          icon={<Calendar className="h-5 w-5 text-red-500" />}
          variant="compact"
        />

        <StatsCard
          title="Total Nilai Stok"
          value={loadingLowStock ? '...' : `Rp ${formatNumber(Math.round(totalValue))}`}
          subtitle="Produk Low Stock"
          icon={<Box className="h-5 w-5 text-green-500" />}
          variant="compact"
        />
      </div>

      {/* Mobile Tab Selection Dropdown */}
      <div className="flex sm:hidden justify-between items-center">
        <div className="flex flex-col">
          <h2 className="text-lg font-semibold">Inventory Management</h2>
          <p className="text-xs text-muted-foreground">Kelola stok dan pesanan</p>
        </div>

        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="h-8 w-8">
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72">
            <div className="py-4">
              <h2 className="text-lg font-semibold mb-2">Navigasi</h2>
              <div className="flex flex-col space-y-1">
                {[
                  { id: 'products', label: 'Low Stock', icon: Package },
                  { id: 'analytics', label: 'Analitik', icon: BarChart3 },
                  { id: 'threshold', label: 'Threshold', icon: Box },
                  { id: 'expiry', label: 'Kadaluarsa', icon: Calendar },
                  { id: 'adjustment', label: 'Penyesuaian', icon: ClipboardEdit },
                ].map((item) => (
                  <Button
                    key={item.id}
                    variant={activeTab === item.id ? 'default' : 'ghost'}
                    className="justify-start"
                    onClick={() => handleTabChange(item.id)}
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
      <Tabs defaultValue="products" onValueChange={handleTabChange} value={activeTab}>
        <div className="overflow-x-auto hide-scrollbar">
          <TabsList className="inline-flex w-auto min-w-full bg-transparent p-0 border-b h-auto">
            {/* Low Stock Tab with Sub-tabs */}
            <div className="flex items-center border-r">
              <TabsTrigger 
                value="products"
                className="px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-primary rounded-none"
              >
                Low Stock
              </TabsTrigger>
            </div>
            
            <TabsTrigger
              value="analytics"
              className="px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-primary rounded-none"
            >
              Analitik
            </TabsTrigger>
            <TabsTrigger
              value="threshold"
              className="px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-primary rounded-none"
            >
              Threshold
            </TabsTrigger>
            <TabsTrigger
              value="expiry"
              className="px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-primary rounded-none"
            >
              Kadaluarsa
            </TabsTrigger>
            <TabsTrigger
              value="adjustment"
              className="px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-primary rounded-none"
            >
              Penyesuaian
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Low Stock Tab with Sub-tabs */}
        <TabsContent value="products" className="space-y-4 mt-4">
          {/* Sub-tabs for Low Stock */}
          <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="w-full">
            <TabsList className="bg-muted/50 w-full justify-start h-auto p-1">
              <TabsTrigger 
                value="products"
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-4 py-2"
              >
                <Package className="h-4 w-4 mr-2" />
                Produk
              </TabsTrigger>
              <TabsTrigger 
                value="orders"
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-4 py-2"
              >
                <ShoppingCart className="h-4 w-4 mr-2" />
                Purchase Orders
              </TabsTrigger>
            </TabsList>

            <TabsContent value="products" className="mt-4">
              <LowStockTable products={lowStockProducts} loading={loadingLowStock} refreshData={refreshData} />
            </TabsContent>

            <TabsContent value="orders" className="mt-4">
              <PurchaseOrdersList
                purchaseOrders={purchaseOrders}
                loading={loadingPO}
                refreshData={async () => { await refetchPO(); }}
              />
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4 mt-4">
          <div className="flex flex-col sm:flex-row sm:justify-between gap-3">
            <div className="flex rounded-md border p-1 shadow-sm">
              {['day', 'week', 'month'].map((filter) => (
                <button
                  key={filter}
                  onClick={() => setTimeFilter(filter as 'day' | 'week' | 'month')}
                  className={`px-3 py-1.5 text-sm rounded-sm transition-colors capitalize ${
                    timeFilter === filter
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Kategori Produk Low Stock</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingAnalytics ? (
                  <PieChartSkeleton />
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={analyticsData?.categoryStats || []}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="count"
                      >
                        {(analyticsData?.categoryStats || []).map((_entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Tren Low Stock</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingAnalytics ? (
                  <PieChartSkeleton />
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={analyticsData?.history || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <RechartsTooltip />
                      <Bar dataKey="count" fill="#8884d8" name="Jumlah Produk" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Threshold Tab */}
        <TabsContent value="threshold" className="space-y-4 mt-4">
          <ThresholdConfig products={allProducts} refreshData={refreshData} />
        </TabsContent>

        {/* Expiry Tab */}
        <TabsContent value="expiry" className="space-y-4 mt-4">
          <ExpiryDateAnalysis products={allProducts} />
        </TabsContent>

        {/* Adjustment Tab */}
        <TabsContent value="adjustment" className="space-y-4 mt-4">
          <StockAdjustmentTab products={allProducts} onRefresh={refreshData} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
