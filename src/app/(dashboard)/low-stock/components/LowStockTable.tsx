'use client';

import { useState } from 'react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
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
import { FormattedNumberInput } from '@/components/ui/formatted-input';
import { Badge } from '@/components/ui/badge';
import { Product } from '@/types/product';
import { 
  ArrowUpDown, 
  Filter,
  Loader2, 
  Plus,
  Search, 
  FilterX 
} from 'lucide-react';
import { toast } from 'sonner';
import { getStockVariant, formatRupiah } from '@/lib/utils';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue 
} from '@/components/ui/select';

interface LowStockTableProps {
  products: Product[];
  loading: boolean;
  refreshData?: () => Promise<void>;
}

export default function LowStockTable({ products, loading, refreshData }: LowStockTableProps) {
  const [sortColumn, setSortColumn] = useState('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [incrementLoading, setIncrementLoading] = useState<Record<string, boolean>>({});
  const [quantityInputs, setQuantityInputs] = useState<Record<string, string>>({});

  // Mendapatkan kategori unik dari produk
  const uniqueCategories = Array.from(
    new Set(products.map(product => product.category || 'Tidak Berkategori'))
  );

  // Fungsi sort kolom
  const sortProducts = (a: Product, b: Product) => {
    if (sortColumn === 'name') {
      return sortDirection === 'asc' 
        ? a.name.localeCompare(b.name) 
        : b.name.localeCompare(a.name);
    } 
    else if (sortColumn === 'stock') {
      return sortDirection === 'asc' 
        ? a.stock - b.stock 
        : b.stock - a.stock;
    }
    else if (sortColumn === 'price') {
      return sortDirection === 'asc' 
        ? a.price - b.price 
        : b.price - a.price;
    }
    else if (sortColumn === 'category') {
      const catA = a.category || 'Tidak Berkategori';
      const catB = b.category || 'Tidak Berkategori';
      return sortDirection === 'asc' 
        ? catA.localeCompare(catB)
        : catB.localeCompare(catA);
    }
    return 0;
  };

  // Toggle sort
  const toggleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Filter produk berdasarkan pencarian dan kategori
  const filteredProducts = products
    .filter(product => 
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.description || '').toLowerCase().includes(searchTerm.toLowerCase())
    )
    .filter(product => 
      !categoryFilter || (product.category || 'Tidak Berkategori') === categoryFilter
    )
    .sort(sortProducts);

  // Handle increment stok
  const handleIncrementStock = async (product: Product, incrementAmount: number = 1) => {
    setIncrementLoading({...incrementLoading, [product.id]: true});
    
    try {
      const response = await fetch(`/api/products/${product.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          stock: product.stock + incrementAmount
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update stock');
      }

      // Memperbarui status stok
      toast.success(`Stok ${product.name} berhasil ditambahkan (${incrementAmount} unit)`);
      
      // Panggil API stock-alerts untuk memperbarui status notifikasi
      await fetch('/api/stock-alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          forceUpdate: true 
        }),
      });
      
      // Refresh data setelah pembaruan
      if (refreshData) {
        await refreshData();
      }
    } catch (error) {
      console.error('Error updating stock:', error);
      toast.error('Gagal memperbarui stok');
    } finally {
      setIncrementLoading({...incrementLoading, [product.id]: false});
    }
  };

  // Render status stok
  const renderStockStatus = (product: Product) => {
    const variant = getStockVariant(product.stock, product.threshold);
    return (
      <Badge variant={variant}>
        {product.stock} {product.unit || 'pcs'}
      </Badge>
    );
  };

  return (
    <Card className="w-full">
      <CardHeader className="px-5 sm:px-6 py-4 sm:py-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-2 sm:space-y-0">
          <div>
            <CardTitle className="text-lg sm:text-xl">Produk Stok Menipis</CardTitle>
            <CardDescription className="text-sm">
              Daftar produk dengan stok di bawah threshold
            </CardDescription>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Cari produk..."
                className="pl-8 h-9 sm:w-[200px] text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="flex gap-2">
              <Select
                value={categoryFilter || 'all'}
                onValueChange={(value) => setCategoryFilter(value === 'all' ? null : value)}
              >
                <SelectTrigger className="w-full sm:w-[180px]">
                  <div className="flex items-center">
                    <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                    <SelectValue placeholder="Filter kategori" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Kategori</SelectItem>
                  {uniqueCategories.map(category => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {(searchTerm || categoryFilter) && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="h-9 px-2"
                  onClick={() => {
                    setSearchTerm('');
                    setCategoryFilter(null);
                  }}
                >
                  <FilterX className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="px-2 sm:px-6 pb-6">
        {/* Loading indicator */}
        {loading && (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}
        
        {/* Desktop view: Table */}
        {!loading && (
          <div className="hidden sm:block rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead 
                    className="w-[200px] cursor-pointer"
                    onClick={() => toggleSort('name')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Nama Produk</span>
                      {sortColumn === 'name' && (
                        <ArrowUpDown className={`h-4 w-4 ${sortDirection === 'desc' ? 'rotate-180' : ''} transition-transform`} />
                      )}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer"
                    onClick={() => toggleSort('category')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Kategori</span>
                      {sortColumn === 'category' && (
                        <ArrowUpDown className={`h-4 w-4 ${sortDirection === 'desc' ? 'rotate-180' : ''} transition-transform`} />
                      )}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer"
                    onClick={() => toggleSort('stock')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Stok</span>
                      {sortColumn === 'stock' && (
                        <ArrowUpDown className={`h-4 w-4 ${sortDirection === 'desc' ? 'rotate-180' : ''} transition-transform`} />
                      )}
                    </div>
                  </TableHead>
                  <TableHead>Threshold</TableHead>
                  <TableHead 
                    className="cursor-pointer text-right"
                    onClick={() => toggleSort('price')}
                  >
                    <div className="flex items-center justify-end space-x-1">
                      <span>Harga</span>
                      {sortColumn === 'price' && (
                        <ArrowUpDown className={`h-4 w-4 ${sortDirection === 'desc' ? 'rotate-180' : ''} transition-transform`} />
                      )}
                    </div>
                  </TableHead>
                  <TableHead className="text-right">Tindakan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.length > 0 ? (
                  filteredProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell>{product.category || '—'}</TableCell>
                      <TableCell>
                        {renderStockStatus(product)}
                      </TableCell>
                      <TableCell>{product.threshold || '—'}</TableCell>
                      <TableCell className="text-right">{formatRupiah(product.price)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <FormattedNumberInput
                            value={quantityInputs[product.id] || ''}
                            onChange={(value) => {
                              setQuantityInputs(prev => ({
                                ...prev,
                                [product.id]: value
                              }));
                            }}
                            className="w-24 h-8 text-sm"
                            allowEmpty={true}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const quantity = quantityInputs[product.id] || '1';
                              const numQuantity = parseInt(quantity, 10) || 1;
                              
                              if (numQuantity > 0) {
                                handleIncrementStock(product, numQuantity);
                              }
                              
                              setQuantityInputs(prev => ({
                                ...prev,
                                [product.id]: ''
                              }));
                            }}
                            disabled={incrementLoading[product.id]}
                          >
                            {incrementLoading[product.id] ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Plus className="h-4 w-4 mr-1" />
                            )}
                            Tambah
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      {searchTerm || categoryFilter ? (
                        <div className="flex flex-col items-center justify-center space-y-1">
                          <Search className="h-5 w-5 text-muted-foreground" />
                          <div className="text-sm text-muted-foreground">
                            Tidak ada produk ditemukan
                          </div>
                          <Button 
                            variant="link" 
                            className="text-xs"
                            onClick={() => {
                              setSearchTerm('');
                              setCategoryFilter(null);
                            }}
                          >
                            Reset filter
                          </Button>
                        </div>
                      ) : (
                        <div className="text-muted-foreground">
                          Tidak ada produk dengan stok menipis
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
        
        {/* Mobile view: Card-based layout */}
        {!loading && (
          <div className="grid grid-cols-1 gap-3 sm:hidden">
            {filteredProducts.length > 0 ? (
              filteredProducts.map((product) => (
                <div key={product.id} className="border rounded-lg p-3">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <h3 className="font-medium line-clamp-1">{product.name}</h3>
                      <p className="text-xs text-muted-foreground">{product.category || 'Tidak Berkategori'}</p>
                    </div>
                    <div className="ml-2">
                      {renderStockStatus(product)}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-1 text-xs mb-2">
                    <div>
                      <span className="text-muted-foreground">Threshold:</span>
                      <span className="ml-1 font-medium">{product.threshold || '—'}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-muted-foreground">Harga:</span>
                      <span className="ml-1 font-medium">{formatRupiah(product.price)}</span>
                    </div>
                  </div>
                  
                  <div className="flex justify-end mt-1">
                    <div className="flex items-center gap-2">
                      <FormattedNumberInput
                        value={quantityInputs[product.id] || ''}
                        onChange={(value) => {
                          setQuantityInputs(prev => ({
                            ...prev,
                            [product.id]: value
                          }));
                        }}
                        className="h-8 w-16"
                        allowEmpty={true}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8"
                        onClick={() => {
                          const quantity = quantityInputs[product.id] || '1';
                          const numQuantity = parseInt(quantity, 10) || 1;
                          
                          if (numQuantity > 0) {
                            handleIncrementStock(product, numQuantity);
                          }
                          
                          setQuantityInputs(prev => ({
                            ...prev,
                            [product.id]: ''
                          }));
                        }}
                        disabled={incrementLoading[product.id]}
                      >
                        {incrementLoading[product.id] ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Plus className="h-4 w-4 mr-1" />
                        )}
                        Tambah
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="border rounded-lg p-6 text-center">
                {searchTerm || categoryFilter ? (
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <Search className="h-8 w-8 text-muted-foreground mb-2" />
                    <div className="text-sm text-muted-foreground">
                      Tidak ada produk ditemukan
                    </div>
                    <Button 
                      variant="link" 
                      onClick={() => {
                        setSearchTerm('');
                        setCategoryFilter(null);
                      }}
                    >
                      Reset filter
                    </Button>
                  </div>
                ) : (
                  <div className="text-muted-foreground">
                    Tidak ada produk dengan stok menipis
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        
        {/* Pagination or load more could be added here */}
        {!loading && filteredProducts.length > 0 && (
          <div className="flex justify-between items-center mt-4 text-xs text-muted-foreground">
            <div>
              Menampilkan {filteredProducts.length} dari {products.length} produk stok menipis
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 