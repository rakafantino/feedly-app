'use client';

import { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  AlertCircle, 
  Bell, 
  Box, 
  ChevronRight, 
  Filter, 
  Loader2, 
  Package, 
  ShoppingCart,
} from 'lucide-react';
import { formatRupiah } from '@/lib/utils';
import { Product } from '@/types/product';
import { useRouter } from 'next/navigation';
import { useSocket } from '@/lib/useSocket';
import LowStockTable from './components/LowStockTable';
import StockAlertsList from './components/StockAlertsList';
import ThresholdConfig from './components/ThresholdConfig';
import PurchaseSuggestions from './components/PurchaseSuggestions';

export default function LowStockPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const { stockAlerts, lowStockCount } = useSocket();
  const router = useRouter();

  useEffect(() => {
    const fetchLowStockProducts = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/products/low-stock');
        if (!response.ok) {
          throw new Error('Failed to fetch low stock products');
        }
        const data = await response.json();
        setLowStockProducts(data.products || []);
      } catch (error) {
        console.error('Error fetching low stock products:', error);
      } finally {
        setLoading(false);
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
      } catch (error) {
        console.error('Error fetching products:', error);
      }
    };

    fetchLowStockProducts();
    fetchAllProducts();
  }, []);

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
        </TabsList>
        
        <TabsContent value="overview" className="space-y-4">
          <LowStockTable products={lowStockProducts} loading={loading} />
        </TabsContent>
        
        <TabsContent value="alerts" className="space-y-4">
          <StockAlertsList />
        </TabsContent>
        
        <TabsContent value="threshold" className="space-y-4">
          <ThresholdConfig products={allProducts} />
        </TabsContent>
        
        <TabsContent value="purchase" className="space-y-4">
          <PurchaseSuggestions products={lowStockProducts} />
        </TabsContent>
      </Tabs>
    </div>
  );
} 