'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
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
  FilterX,
  ShoppingCart,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { getStockVariant, formatRupiah } from '@/lib/utils';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface LowStockTableProps {
  products: Product[];
  loading: boolean;
  refreshData?: () => Promise<void>;
}

export default function LowStockTable({ products, loading, refreshData }: LowStockTableProps) {
  const router = useRouter();
  const [sortColumn, setSortColumn] = useState('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [quantityInputs, setQuantityInputs] = useState<Record<string, string>>({});
  const [incrementLoading, setIncrementLoading] = useState<Record<string, boolean>>({});
  
  // Tambahkan state untuk produk terpilih untuk PO
  const [selectedProducts, setSelectedProducts] = useState<Record<string, boolean>>({});
  
  // Mendapatkan semua kategori unik dari produk
  const categories = Array.from(new Set(products.map(product => product.category).filter(Boolean)));

  // Fungsi sort kolom
  const sortProducts = (a: Product, b: Product) => {
    const direction = sortDirection === 'asc' ? 1 : -1;
    
    switch (sortColumn) {
      case 'name':
        return a.name.localeCompare(b.name) * direction;
      case 'category':
        return (a.category || '').localeCompare(b.category || '') * direction;
      case 'stock':
        return ((a.stock || 0) - (b.stock || 0)) * direction;
      case 'price':
        return ((a.price || 0) - (b.price || 0)) * direction;
      default:
        return 0;
    }
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

  // Handle increment stok
  const handleIncrementStock = async (product: Product, incrementAmount: number = 1) => {
    setIncrementLoading(prev => ({ ...prev, [product.id]: true }));
    
    try {
      const response = await fetch(`/api/products/${product.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          stock: (product.stock || 0) + incrementAmount,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update stock');
      }

      toast.success(`Berhasil menambahkan ${incrementAmount} ${product.unit || 'item'} ke stok ${product.name}`);
      
      // Refresh data after successful update
      if (refreshData) {
        await refreshData();
      }
      
      // Force refresh notifications header
      window.dispatchEvent(new Event('stock-alerts-refresh'));
    } catch (error) {
      console.error('Error updating stock:', error);
      toast.error('Gagal mengupdate stok produk');
    } finally {
      setIncrementLoading(prev => ({ ...prev, [product.id]: false }));
    }
  };

  // Render status stok
  const renderStockStatus = (product: Product) => {
    const stockValue = product.stock || 0;
    const thresholdValue = product.threshold || 5;
    
    let statusText = 'Menipis';
    if (stockValue <= 0) {
      statusText = 'Habis';
    }
    
    return (
      <Badge variant={getStockVariant(stockValue, thresholdValue)}>
        {statusText} ({stockValue} {product.unit || 'pcs'})
      </Badge>
    );
  };

  // Tambahkan fungsi untuk toggle pilihan produk
  const toggleProductSelection = (productId: string) => {
    setSelectedProducts(prev => ({
      ...prev,
      [productId]: !prev[productId]
    }));
  };

  // Tambahkan fungsi untuk membuat PO baru dengan produk terpilih
  const createPurchaseOrder = () => {
    // Filter produk yang dipilih
    const selectedProductsData = products.filter(product => selectedProducts[product.id]);
    
    if (selectedProductsData.length === 0) {
      toast.error('Pilih minimal satu produk untuk membuat Purchase Order');
      return;
    }
    
    // Simpan data produk terpilih ke localStorage
    localStorage.setItem('selected_po_products', JSON.stringify(selectedProductsData));
    
    // Navigasi ke halaman pembuatan PO
    router.push('/purchase-orders/create');
  };
  
  const filteredProducts = [...products]
    .filter(product => {
      // Filter berdasarkan pencarian
      if (searchTerm && !product.name.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      
      // Filter berdasarkan kategori
      if (categoryFilter && product.category !== categoryFilter) {
        return false;
      }
      
      // Filter berdasarkan status stok
      if (statusFilter === 'out_of_stock' && product.stock > 0) {
        return false;
      } else if (statusFilter === 'low_stock' && product.stock <= 0) {
        return false;
      }
      
      return true;
    })
    .sort(sortProducts);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>Produk dengan Stok Menipis</CardTitle>
            <CardDescription>
              {products.length} produk di bawah threshold stok
            </CardDescription>
          </div>
          
          {/* Tambahkan tombol "Buat PO" */}
          <div className="flex space-x-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={createPurchaseOrder}
                    disabled={Object.values(selectedProducts).filter(Boolean).length === 0}
                  >
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Buat PO
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Buat Purchase Order untuk produk terpilih</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari produk..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowFilters(!showFilters)}
              className={showFilters ? 'bg-secondary' : ''}
            >
              <Filter className="h-4 w-4" />
            </Button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Select
                  value={categoryFilter}
                  onValueChange={setCategoryFilter}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Filter kategori" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Semua Kategori</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category || ''}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Select
                  value={statusFilter}
                  onValueChange={setStatusFilter}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Filter status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Semua Status</SelectItem>
                    <SelectItem value="out_of_stock">Stok Habis</SelectItem>
                    <SelectItem value="low_stock">Stok Menipis</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2 flex justify-end">
                <Button 
                  variant="ghost" 
                  onClick={() => {
                    setSearchTerm('');
                    setCategoryFilter('');
                    setStatusFilter('');
                  }}
                >
                  <FilterX className="h-4 w-4 mr-2" />
                  Reset Filter
                </Button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="h-24 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="rounded-md border hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    {/* Tambahkan kolom pilihan */}
                    <TableHead className="w-[50px]">Pilih</TableHead>
                    <TableHead 
                      className="cursor-pointer"
                      onClick={() => toggleSort('name')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Produk</span>
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
                        {/* Tambahkan checkbox untuk pilih produk */}
                        <TableCell>
                          <Button
                            variant={selectedProducts[product.id] ? "default" : "outline"}
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => toggleProductSelection(product.id)}
                          >
                            {selectedProducts[product.id] && <Check className="h-4 w-4" />}
                          </Button>
                        </TableCell>
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
                      <TableCell colSpan={7} className="h-24 text-center">
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
                                setCategoryFilter('');
                                setStatusFilter('');
                              }}
                            >
                              Reset pencarian
                            </Button>
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground">
                            Semua produk memiliki stok yang cukup
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {!loading && (
            <div className="grid grid-cols-1 gap-3 sm:hidden">
              {filteredProducts.length > 0 ? (
                filteredProducts.map((product) => (
                  <div key={product.id} className="border rounded-lg p-3">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <h3 className="font-medium line-clamp-1">
                          <div className="flex items-center">
                            <Button
                              variant={selectedProducts[product.id] ? "default" : "outline"}
                              size="icon"
                              className="h-6 w-6 mr-2"
                              onClick={() => toggleProductSelection(product.id)}
                            >
                              {selectedProducts[product.id] && <Check className="h-3 w-3" />}
                            </Button>
                            {product.name}
                          </div>
                        </h3>
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
                    
                    <div className="flex items-center mt-2">
                      <FormattedNumberInput
                        value={quantityInputs[product.id] || ''}
                        onChange={(value) => {
                          setQuantityInputs(prev => ({
                            ...prev,
                            [product.id]: value
                          }));
                        }}
                        className="w-full h-8 text-sm mr-2"
                        placeholder="Jumlah"
                        allowEmpty={true}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="whitespace-nowrap"
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
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <Plus className="h-4 w-4 mr-1" />
                        )}
                        Tambah Stok
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center p-8 border rounded-lg">
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
                          setCategoryFilter('');
                          setStatusFilter('');
                        }}
                      >
                        Reset pencarian
                      </Button>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      Semua produk memiliki stok yang cukup
                    </div>
                  )}
                </div>
              )}
              
              {/* Tambahkan tombol Buat PO untuk tampilan mobile */}
              {filteredProducts.length > 0 && Object.values(selectedProducts).some(Boolean) && (
                <div className="sticky bottom-4 flex justify-center z-10">
                  <Button
                    variant="default"
                    size="default"
                    onClick={createPurchaseOrder}
                    className="shadow-md"
                  >
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Buat PO untuk Produk Terpilih ({Object.values(selectedProducts).filter(Boolean).length})
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
} 