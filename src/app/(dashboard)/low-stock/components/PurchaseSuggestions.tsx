'use client';

import { useState } from 'react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Product } from '@/types/product';
import { Badge } from '@/components/ui/badge';
import { getStockVariant, formatRupiah } from '@/lib/utils';
import { toast } from 'sonner';
import { 
  ArrowDownToLine, 
  ClipboardCheck, 
  Download, 
  Loader2, 
  Mail, 
  Printer, 
  ShoppingCart 
} from 'lucide-react';

interface PurchaseSuggestionsProps {
  products: Product[];
}

export default function PurchaseSuggestions({ products }: PurchaseSuggestionsProps) {
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [orderQuantities, setOrderQuantities] = useState<Record<string, number>>({});
  const [selectAll, setSelectAll] = useState(false);
  const [generating, setGenerating] = useState(false);
  
  // Inisialisasi kuantitas pesanan
  const initOrderQuantities = () => {
    const quantities: Record<string, number> = {};
    products.forEach(product => {
      // Jika ada threshold, sarankan pesan hingga 2x threshold
      if (product.threshold) {
        quantities[product.id] = Math.max(
          product.threshold * 2 - product.stock, 
          1
        );
      } else {
        // Jika tidak ada threshold, sarankan 10 unit
        quantities[product.id] = 10;
      }
    });
    
    setOrderQuantities(quantities);
  };

  // Efek samping untuk inisialisasi
  useState(() => {
    initOrderQuantities();
  });

  // Toggle pilihan produk untuk dipesan
  const toggleProductSelection = (productId: string) => {
    if (selectedProducts.includes(productId)) {
      setSelectedProducts(prev => prev.filter(id => id !== productId));
    } else {
      setSelectedProducts(prev => [...prev, productId]);
    }
  };

  // Toggle pilih semua produk
  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(products.map(p => p.id));
    }
    setSelectAll(!selectAll);
  };

  // Update kuantitas pesanan
  const updateOrderQuantity = (productId: string, quantity: string) => {
    const numQuantity = parseInt(quantity) || 0;
    setOrderQuantities({
      ...orderQuantities,
      [productId]: numQuantity
    });
  };

  // Generate daftar pesanan
  const generatePurchaseOrder = () => {
    if (selectedProducts.length === 0) {
      toast.error('Pilih minimal satu produk untuk dipesan');
      return;
    }

    setGenerating(true);

    // Simulasi generasi pesanan
    setTimeout(() => {
      setGenerating(false);
      toast.success('Daftar pesanan berhasil dibuat');
    }, 1500);
  };

  // Export ke CSV
  const exportToCSV = () => {
    if (selectedProducts.length === 0) {
      toast.error('Pilih minimal satu produk untuk diekspor');
      return;
    }

    // Membuat konten CSV
    const headers = ['Nama Produk', 'Kategori', 'Stok Saat Ini', 'Threshold', 'Jumlah Pesanan'];
    const rows = selectedProducts.map(id => {
      const product = products.find(p => p.id === id);
      if (!product) return '';
      
      return [
        product.name,
        product.category || '-',
        product.stock,
        product.threshold || '-',
        orderQuantities[product.id] || 0
      ].join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    
    // Membuat file dan mengunduhnya
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `purchase-order-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('Daftar pesanan berhasil diekspor ke CSV');
  };

  // Salin ke clipboard
  const copyToClipboard = () => {
    if (selectedProducts.length === 0) {
      toast.error('Pilih minimal satu produk untuk disalin');
      return;
    }

    const text = selectedProducts.map(id => {
      const product = products.find(p => p.id === id);
      if (!product) return '';
      
      return `${product.name} - ${orderQuantities[product.id] || 0} ${product.unit || 'pcs'}`;
    }).join('\n');

    navigator.clipboard.writeText(text);
    toast.success('Daftar pesanan berhasil disalin ke clipboard');
  };

  // Hitung total estimasi biaya
  const calculateTotalCost = () => {
    return selectedProducts.reduce((total, id) => {
      const product = products.find(p => p.id === id);
      if (!product) return total;
      
      return total + (product.price * (orderQuantities[id] || 0));
    }, 0);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Saran Pembelian</CardTitle>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={copyToClipboard}
            disabled={selectedProducts.length === 0}
          >
            <ClipboardCheck className="h-4 w-4 mr-1" />
            Salin
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={exportToCSV}
            disabled={selectedProducts.length === 0}
          >
            <Download className="h-4 w-4 mr-1" />
            Ekspor CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">
                  <Checkbox 
                    checked={selectAll}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all products"
                  />
                </TableHead>
                <TableHead>Nama Produk</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Stok Saat Ini</TableHead>
                <TableHead>Threshold</TableHead>
                <TableHead>Jumlah Pesanan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.length > 0 ? (
                products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <Checkbox 
                        checked={selectedProducts.includes(product.id)}
                        onCheckedChange={() => toggleProductSelection(product.id)}
                        aria-label={`Select ${product.name}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell>{product.category || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={getStockVariant(product.stock, product.threshold)}>
                        {product.stock} {product.unit || 'pcs'}
                      </Badge>
                    </TableCell>
                    <TableCell>{product.threshold ?? '-'}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="1"
                        value={orderQuantities[product.id] || ''}
                        onChange={(e) => updateOrderQuantity(product.id, e.target.value)}
                        className="w-20"
                      />
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10">
                    <div className="flex flex-col items-center gap-2">
                      <ShoppingCart className="h-10 w-10 text-muted-foreground" />
                      <p className="text-muted-foreground">
                        Tidak ada produk dengan stok menipis
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {selectedProducts.length > 0 && (
          <div className="rounded-md border p-4 bg-muted/20">
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-medium mb-2">Ringkasan Pesanan</h3>
                  <ul className="space-y-1 text-sm">
                    <li className="flex justify-between">
                      <span>Jumlah Produk:</span>
                      <span>{selectedProducts.length}</span>
                    </li>
                    <li className="flex justify-between">
                      <span>Total Item:</span>
                      <span>
                        {selectedProducts.reduce((total, id) => total + (orderQuantities[id] || 0), 0)}
                      </span>
                    </li>
                    <li className="flex justify-between font-medium">
                      <span>Estimasi Biaya:</span>
                      <span>{formatRupiah(calculateTotalCost())}</span>
                    </li>
                  </ul>
                </div>
                
                <div className="flex flex-col sm:items-end justify-center gap-2">
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto"
                    disabled={generating}
                    onClick={generatePurchaseOrder}
                  >
                    {generating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Membuat Pesanan...
                      </>
                    ) : (
                      <>
                        <ArrowDownToLine className="h-4 w-4 mr-2" />
                        Buat Pesanan
                      </>
                    )}
                  </Button>
                  
                  <div className="flex gap-2 w-full sm:w-auto">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1"
                      disabled={generating}
                    >
                      <Printer className="h-4 w-4 mr-1" />
                      Print
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1"
                      disabled={generating}
                    >
                      <Mail className="h-4 w-4 mr-1" />
                      Email
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 