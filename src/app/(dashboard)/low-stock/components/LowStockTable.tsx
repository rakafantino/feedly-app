'use client';

import { useState } from 'react';
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
import { Product } from '@/types/product';
import { formatRupiah, getStockVariant } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { 
  ArrowUpDown, 
  Download,
  Edit, 
  Filter,
  Loader2, 
  Package, 
  Plus, 
  RefreshCw,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface LowStockTableProps {
  products: Product[];
  loading: boolean;
  refreshData?: () => Promise<void>;
}

export default function LowStockTable({ products, loading, refreshData }: LowStockTableProps) {
  const [sortField, setSortField] = useState<'name' | 'stock' | 'threshold'>('stock');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [increasingStock, setIncreasingStock] = useState<Record<string, number>>({});
  const [savingStockId, setSavingStockId] = useState<string | null>(null);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [stockRange, setStockRange] = useState<[number, number]>([0, 100]);
  const [thresholdRange, setThresholdRange] = useState<[number, number]>([0, 50]);
  const [showFilters, setShowFilters] = useState(false);
  const [filtersApplied, setFiltersApplied] = useState(false);
  
  const router = useRouter();

  const handleSort = (field: 'name' | 'stock' | 'threshold') => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedProducts = [...products].sort((a, b) => {
    let aValue: any = a[sortField];
    let bValue: any = b[sortField];
    
    // Handle null or undefined for threshold
    if (sortField === 'threshold') {
      aValue = a.threshold ?? Infinity;
      bValue = b.threshold ?? Infinity;
    }
    
    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const handleIncreasingStockChange = (id: string, value: string) => {
    const numValue = parseInt(value) || 0;
    setIncreasingStock({
      ...increasingStock,
      [id]: numValue
    });
  };

  const updateStock = async (id: string, additionalStock: number) => {
    if (additionalStock <= 0) {
      toast.error('Jumlah stok tambahan harus lebih dari 0');
      return;
    }

    setSavingStockId(id);
    try {
      const response = await fetch(`/api/products/${id}/stock`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          adjustment: additionalStock,
          isAddition: true 
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update stock');
      }

      // Reset input field
      setIncreasingStock({
        ...increasingStock,
        [id]: 0
      });

      toast.success('Stok berhasil diperbarui');
      
      // Refresh data after successful update
      if (refreshData) {
        await refreshData();
      } else {
        // Re-fetch data or update local data
        // Here we're simulating an update - in a real app you'd re-fetch data
        const productIndex = products.findIndex(p => p.id === id);
        if (productIndex !== -1) {
          const updatedProducts = [...products];
          updatedProducts[productIndex] = {
            ...updatedProducts[productIndex],
            stock: updatedProducts[productIndex].stock + additionalStock
          };
          // Note: You'd typically update using the state setter from the parent
        }
      }
    } catch (error) {
      console.error('Error updating stock:', error);
      toast.error('Gagal memperbarui stok');
    } finally {
      setSavingStockId(null);
    }
  };

  const handleViewProduct = (id: string) => {
    router.push(`/products/edit/${id}`);
  };

  // Extract unique categories from products
  const categories = Array.from(new Set(products.map(p => p.category).filter(Boolean))) as string[];
  
  // Calculate max stock & threshold for slider ranges
  const maxStock = Math.max(...products.map(p => p.stock), 100);
  const maxThreshold = Math.max(...products.map(p => p.threshold || 0), 50);

  // Apply filters to products
  const filteredProducts = sortedProducts.filter(product => {
    // Filter by search term
    const matchesSearch = searchTerm === '' || 
      product.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Filter by category
    const matchesCategory = selectedCategory === 'all' || 
      product.category === selectedCategory;
    
    // Filter by stock range
    const matchesStockRange = 
      product.stock >= stockRange[0] && 
      product.stock <= stockRange[1];
    
    // Filter by threshold range
    const threshold = product.threshold || 0;
    const matchesThresholdRange = 
      threshold >= thresholdRange[0] && 
      threshold <= thresholdRange[1];
    
    return matchesSearch && matchesCategory && matchesStockRange && matchesThresholdRange;
  });

  // Reset all filters
  const resetFilters = () => {
    setSearchTerm('');
    setSelectedCategory('all');
    setStockRange([0, maxStock]);
    setThresholdRange([0, maxThreshold]);
    setFiltersApplied(false);
  };

  // Apply filters
  const applyFilters = () => {
    setFiltersApplied(true);
    setShowFilters(false);
  };

  // Fungsi untuk mengekspor data ke CSV
  const exportToCSV = () => {
    if (filteredProducts.length === 0) {
      toast.error('Tidak ada data untuk diekspor');
      return;
    }
    
    try {
      // Header CSV
      let csvContent = 'Nama Produk,Kategori,Stok,Unit,Threshold,Harga\n';
      
      // Konversi data produk ke format CSV
      filteredProducts.forEach(product => {
        const row = [
          // Escape koma dalam nama produk
          `"${product.name.replace(/"/g, '""')}"`,
          `"${(product.category || '-').replace(/"/g, '""')}"`,
          product.stock,
          `"${(product.unit || 'pcs').replace(/"/g, '""')}"`,
          product.threshold !== null && product.threshold !== undefined ? product.threshold : '-',
          product.price
        ];
        csvContent += row.join(',') + '\n';
      });
      
      // Buat blob dan download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      
      // Buat nama file dengan timestamp
      const date = new Date();
      const timestamp = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const filename = `produk-stok-rendah-${timestamp}.csv`;
      
      // Download file
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success('Data berhasil diekspor ke CSV');
    } catch (error) {
      console.error('Error exporting data:', error);
      toast.error('Gagal mengekspor data');
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Produk dengan Stok Menipis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] w-full flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Memuat data produk...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (products.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Produk dengan Stok Menipis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <Package className="h-16 w-16 text-muted-foreground" />
              <p className="text-medium font-medium">Tidak ada produk dengan stok menipis</p>
              <p className="text-sm text-muted-foreground">
                Semua produk memiliki stok di atas threshold yang ditentukan
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle>Produk dengan Stok Menipis</CardTitle>
        <div className="flex items-center gap-2">
          <Sheet open={showFilters} onOpenChange={setShowFilters}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={`h-8 ${filtersApplied ? 'bg-primary text-primary-foreground hover:bg-primary/90' : ''}`}
              >
                <Filter className="h-3.5 w-3.5 mr-1" />
                Filter
                {filtersApplied && (
                  <Badge variant="outline" className="ml-1 bg-background text-foreground">
                    {filteredProducts.length}
                  </Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent className="sm:max-w-md">
              <SheetHeader>
                <SheetTitle>Filter Produk</SheetTitle>
                <SheetDescription>
                  Sesuaikan filter untuk menemukan produk yang Anda butuhkan
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-6 py-4">
                {/* Search filter */}
                <div className="space-y-2">
                  <h4 className="font-medium">Nama Produk</h4>
                  <div className="relative">
                    <Input
                      placeholder="Cari produk..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full"
                    />
                    {searchTerm && (
                      <button 
                        className="absolute right-3 top-1/2 transform -translate-y-1/2"
                        onClick={() => setSearchTerm('')}
                      >
                        <X className="h-4 w-4 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Category filter */}
                <div className="space-y-2">
                  <h4 className="font-medium">Kategori</h4>
                  <Select 
                    value={selectedCategory} 
                    onValueChange={setSelectedCategory}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih kategori" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Kategori</SelectItem>
                      {categories.map(category => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                {/* Stock range filter */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-medium">Range Stok</h4>
                    <div className="text-sm text-muted-foreground">
                      {stockRange[0]} - {stockRange[1]}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Input 
                      type="number" 
                      value={stockRange[0]} 
                      onChange={(e) => setStockRange([parseInt(e.target.value) || 0, stockRange[1]])}
                      className="w-20"
                      min={0}
                      max={stockRange[1]}
                    />
                    <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary"
                        style={{ width: `${(stockRange[0] / maxStock) * 100}%` }}
                      ></div>
                    </div>
                    <Input 
                      type="number" 
                      value={stockRange[1]} 
                      onChange={(e) => setStockRange([stockRange[0], parseInt(e.target.value) || 0])}
                      className="w-20"
                      min={stockRange[0]}
                      max={maxStock}
                    />
                  </div>
                </div>

                <Separator />

                {/* Threshold range filter */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-medium">Range Threshold</h4>
                    <div className="text-sm text-muted-foreground">
                      {thresholdRange[0]} - {thresholdRange[1]}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Input 
                      type="number" 
                      value={thresholdRange[0]} 
                      onChange={(e) => setThresholdRange([parseInt(e.target.value) || 0, thresholdRange[1]])}
                      className="w-20"
                      min={0}
                      max={thresholdRange[1]}
                    />
                    <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary"
                        style={{ width: `${(thresholdRange[0] / maxThreshold) * 100}%` }}
                      ></div>
                    </div>
                    <Input 
                      type="number" 
                      value={thresholdRange[1]} 
                      onChange={(e) => setThresholdRange([thresholdRange[0], parseInt(e.target.value) || 0])}
                      className="w-20"
                      min={thresholdRange[0]}
                      max={maxThreshold}
                    />
                  </div>
                </div>
              </div>
              <SheetFooter className="flex-row justify-between gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={resetFilters}
                >
                  Reset Filter
                </Button>
                <Button 
                  size="sm" 
                  onClick={applyFilters}
                >
                  Terapkan
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
          <Button
            variant="outline"
            size="sm"
            onClick={exportToCSV}
            className="h-8"
          >
            <Download className="h-3.5 w-3.5 mr-1" />
            Export
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refreshData ? refreshData() : router.refresh()}
            className="h-8"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Search input for quick filtering */}
        <div className="mb-4">
          <Input
            placeholder="Cari produk cepat..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
        </div>
        
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead 
                  className="w-[250px] cursor-pointer"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Nama Produk</span>
                    {sortField === 'name' && (
                      <ArrowUpDown className={`h-4 w-4 ${sortDirection === 'desc' ? 'rotate-180' : ''}`} />
                    )}
                  </div>
                </TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead 
                  className="w-[100px] cursor-pointer"
                  onClick={() => handleSort('stock')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Stok</span>
                    {sortField === 'stock' && (
                      <ArrowUpDown className={`h-4 w-4 ${sortDirection === 'desc' ? 'rotate-180' : ''}`} />
                    )}
                  </div>
                </TableHead>
                <TableHead 
                  className="w-[100px] cursor-pointer"
                  onClick={() => handleSort('threshold')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Threshold</span>
                    {sortField === 'threshold' && (
                      <ArrowUpDown className={`h-4 w-4 ${sortDirection === 'desc' ? 'rotate-180' : ''}`} />
                    )}
                  </div>
                </TableHead>
                <TableHead>Harga</TableHead>
                <TableHead className="text-right">Tambah Stok</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>{product.category || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={getStockVariant(product.stock, product.threshold)}>
                      {product.stock} {product.unit}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {product.threshold !== null && product.threshold !== undefined
                      ? product.threshold
                      : '-'}
                  </TableCell>
                  <TableCell>{formatRupiah(product.price)}</TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2 justify-end">
                      <Input
                        type="number"
                        value={increasingStock[product.id] || ''}
                        onChange={(e) => handleIncreasingStockChange(product.id, e.target.value)}
                        className="w-20 text-right"
                        placeholder="0"
                        min="1"
                      />
                      <Button
                        size="sm"
                        onClick={() => updateStock(product.id, increasingStock[product.id] || 0)}
                        disabled={savingStockId === product.id || !increasingStock[product.id]}
                      >
                        {savingStockId === product.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Plus className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewProduct(product.id)}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
} 