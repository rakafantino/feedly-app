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
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue 
} from '@/components/ui/select';
import { Product } from '@/types/product';
import { formatRupiah, getStockVariant } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { 
  AlertCircle, 
  ArrowUpDown, 
  Edit, 
  Loader2, 
  Package, 
  Plus, 
  RefreshCw,
  ShoppingCart
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface LowStockTableProps {
  products: Product[];
  loading: boolean;
}

export default function LowStockTable({ products, loading }: LowStockTableProps) {
  const [sortField, setSortField] = useState<'name' | 'stock' | 'threshold'>('stock');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [increasingStock, setIncreasingStock] = useState<Record<string, number>>({});
  const [savingStockId, setSavingStockId] = useState<string | null>(null);
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.refresh()}
            className="h-8"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
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
              {sortedProducts.map((product) => (
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