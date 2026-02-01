'use client';

import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { formatRupiah } from '@/lib/utils';
import { ClipboardEdit, Search, Package, AlertCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useOfflineStockAdjustment } from '@/hooks/useOfflineStockAdjustment';

interface ProductBatch {
  id: string;
  stock: number;
  expiryDate?: string | Date | null;
  batchNumber?: string | null;
  purchasePrice?: number | null;
}

interface ProductForAdjustment {
  id: string;
  name: string;
  category?: string | null;
  stock: number;
  unit?: string;
  price: number;
  purchase_price?: number | null;
  storeId?: string;
  batches?: ProductBatch[];
}

interface StockAdjustmentTabProps {
  products: ProductForAdjustment[];
  onRefresh?: () => void;
}

const ADJUSTMENT_TYPES = [
  { value: 'CORRECTION', label: 'Koreksi Stok', description: 'Selisih hasil stock opname' },
  { value: 'WASTE', label: 'Waste/Terbuang', description: 'Barang rusak/pecah' },
  { value: 'DAMAGED', label: 'Rusak', description: 'Barang cacat/tidak layak jual' },
  { value: 'EXPIRED', label: 'Kadaluarsa', description: 'Barang melewati masa pakai' },
];

export default function StockAdjustmentTab({ products, onRefresh }: StockAdjustmentTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredProducts, setFilteredProducts] = useState<ProductForAdjustment[]>([]);
  const [displayCount, setDisplayCount] = useState(10);

  // Dialog state
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductForAdjustment | null>(null);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [adjustmentType, setAdjustmentType] = useState<string>('CORRECTION');
  const [quantity, setQuantity] = useState<string>('');
  const [isPositive, setIsPositive] = useState(false);
  const [reason, setReason] = useState('');
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [productBatches, setProductBatches] = useState<ProductBatch[]>([]);

  // Use the offline stock adjustment hook
  const { adjust } = useOfflineStockAdjustment();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter products based on search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredProducts(products);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredProducts(
        products.filter(p =>
          p.name.toLowerCase().includes(query) ||
          (p.category?.toLowerCase() || '').includes(query)
        )
      );
    }
  }, [searchQuery, products]);

  // Fetch batches when product is selected
  const fetchProductBatches = async (productId: string) => {
    setLoadingBatches(true);
    try {
      const response = await fetch(`/api/products/${productId}/batches`);
      if (response.ok) {
        const data = await response.json();
        setProductBatches(data.batches || []);
      } else {
        setProductBatches([]);
      }
    } catch (error) {
      console.error('Error fetching batches:', error);
      setProductBatches([]);
    } finally {
      setLoadingBatches(false);
    }
  };

  const handleAdjustClick = (product: ProductForAdjustment) => {
    setSelectedProduct(product);
    setSelectedBatchId('');
    setAdjustmentType('CORRECTION');
    setQuantity('');
    setIsPositive(false);
    setReason('');
    setProductBatches([]);
    fetchProductBatches(product.id);
    setOpenDialog(true);
  };

  const getMaxQuantity = (): number => {
    if (isPositive) return 9999; // No limit for adding
    
    if (selectedBatchId && productBatches.length > 0) {
      const batch = productBatches.find(b => b.id === selectedBatchId);
      return batch?.stock || 0;
    }
    return selectedProduct?.stock || 0;
  };

  const handleSubmit = async () => {
    if (!selectedProduct || !quantity) {
      toast.error('Lengkapi semua field');
      return;
    }

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      toast.error('Jumlah tidak valid');
      return;
    }

    // Validate batch selection for products with batches
    if (productBatches.length > 0 && !selectedBatchId) {
      toast.error('Pilih batch terlebih dahulu');
      return;
    }

    // Validate negative quantity doesn't exceed stock
    if (!isPositive && qty > getMaxQuantity()) {
      toast.error(`Jumlah melebihi stok tersedia (${getMaxQuantity()})`);
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await adjust({
        storeId: selectedProduct.storeId!,
        productId: selectedProduct.id,
        batchId: selectedBatchId || null,
        quantity: isPositive ? qty : -qty,
        type: adjustmentType,
        reason: reason || `${ADJUSTMENT_TYPES.find(t => t.value === adjustmentType)?.label}`
      });

      setOpenDialog(false);
      // Trigger parent refresh if provided (only if not queued)
      if (typeof result !== 'string' && onRefresh) {
        onRefresh();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-medium flex items-center gap-2">
          <ClipboardEdit className="h-5 w-5 text-primary" />
          Penyesuaian Stok
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari produk..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 flex items-start gap-2">
          <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
          <div className="text-sm text-blue-800">
            <p className="font-medium">Tentang Penyesuaian Stok</p>
            <p className="text-blue-700 mt-1">
              Gunakan fitur ini untuk koreksi stok setelah stock opname, mencatat barang rusak, atau menghapus barang kadaluarsa.
              Semua penyesuaian akan tercatat di Laporan Penyesuaian Stok.
            </p>
          </div>
        </div>

        {/* Products Table */}
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produk</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead className="text-right">Stok</TableHead>
                <TableHead className="text-right">Harga Modal</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    {searchQuery ? 'Tidak ada produk yang cocok' : 'Tidak ada produk'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredProducts.slice(0, displayCount).map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{product.category}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {product.stock} {product.unit}
                    </TableCell>
                    <TableCell className="text-right">
                      {product.purchase_price ? formatRupiah(product.purchase_price) : '-'}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAdjustClick(product)}
                      >
                        Adjust
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Show More */}
        {filteredProducts.length > displayCount && (
          <div className="mt-3 text-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDisplayCount(prev => prev + 10)}
            >
              Lihat {filteredProducts.length - displayCount} produk lainnya
            </Button>
          </div>
        )}

        {/* Adjustment Dialog */}
        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
          <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle>Penyesuaian Stok</DialogTitle>
              <DialogDescription>
                Catat perubahan stok untuk {selectedProduct?.name}
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto">
              <div className="grid gap-4 py-4">
                {/* Product Info */}
                <div className="bg-muted p-3 rounded-lg">
                  <p className="font-medium">{selectedProduct?.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Stok saat ini: {selectedProduct?.stock} {selectedProduct?.unit}
                  </p>
                </div>

              {/* Adjustment Type */}
              <div className="space-y-2">
                <Label>Tipe Penyesuaian</Label>
                <Select 
                  value={adjustmentType} 
                  onValueChange={(val) => {
                    setAdjustmentType(val);
                    // Reset to negative for non-CORRECTION types
                    if (val !== 'CORRECTION') {
                      setIsPositive(false);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ADJUSTMENT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div>
                          <span>{type.label}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            ({type.description})
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Batch Selection (if has batches) */}
              {loadingBatches ? (
                <Skeleton className="h-10 w-full" />
              ) : productBatches.length > 0 ? (
                <div className="space-y-2">
                  <Label>Pilih Batch <span className="text-red-500">*</span></Label>
                  <Select value={selectedBatchId} onValueChange={setSelectedBatchId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih batch..." />
                    </SelectTrigger>
                    <SelectContent>
                      {productBatches.map((batch) => (
                        <SelectItem key={batch.id} value={batch.id}>
                          <div className="flex justify-between gap-4">
                            <span>{batch.batchNumber || 'Batch tanpa nomor'}</span>
                            <span className="text-muted-foreground">
                              ({batch.stock} {selectedProduct?.unit})
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Produk ini menggunakan sistem batch. Pilih batch yang akan di-adjust.
                  </p>
                </div>
              ) : null}

              {/* Direction (Add/Remove) */}
              <div className="space-y-2">
                <Label>Arah Penyesuaian</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={!isPositive ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => setIsPositive(false)}
                  >
                    − Kurangi
                  </Button>
                  <Button
                    type="button"
                    variant={isPositive ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => setIsPositive(true)}
                    disabled={
                      adjustmentType !== 'CORRECTION' || // Only CORRECTION allows adding
                      (productBatches.length > 0 && !selectedBatchId)
                    }
                  >
                    + Tambah
                  </Button>
                </div>
                {adjustmentType !== 'CORRECTION' && (
                  <p className="text-xs text-muted-foreground">
                    Tipe {ADJUSTMENT_TYPES.find(t => t.value === adjustmentType)?.label} hanya bisa mengurangi stok.
                  </p>
                )}
                {isPositive && productBatches.length > 0 && (
                  <p className="text-xs text-amber-600">
                    Penambahan stok hanya bisa ke batch yang sudah ada.
                  </p>
                )}
              </div>

              {/* Quantity */}
              <div className="space-y-2">
                <Label>Jumlah</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    min="0"
                    max={!isPositive ? getMaxQuantity() : undefined}
                    placeholder="0"
                  />
                  <span className="text-muted-foreground">{selectedProduct?.unit}</span>
                </div>
                {!isPositive && (
                  <p className="text-xs text-muted-foreground">
                    Maksimal: {getMaxQuantity()} {selectedProduct?.unit}
                  </p>
                )}
              </div>

              {/* Reason */}
              <div className="space-y-2">
                <Label>Alasan (Opsional)</Label>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Contoh: Selisih hasil stock opname, barang pecah saat handling..."
                  rows={2}
                />
              </div>
              </div>
            </div>

            <DialogFooter className="flex-shrink-0 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => setOpenDialog(false)}
                disabled={isSubmitting}
              >
                Batal
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || !quantity || (productBatches.length > 0 && !selectedBatchId)}
              >
                {isSubmitting ? 'Menyimpan...' : 'Simpan Penyesuaian'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
