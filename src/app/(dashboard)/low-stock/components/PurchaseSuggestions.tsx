'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormattedNumberInput } from '@/components/ui/formatted-input';
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
  Brain,
  ClipboardCheck, 
  Download, 
  Loader2, 
  Mail, 
  PackageSearch,
  Printer, 
  ShoppingCart,
  TrendingUp
} from 'lucide-react';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

// Type definitions
interface ProductRecommendation {
  productId: string;
  averageSales: number;
  daysToEmpty: number;
  recommendedOrder: number;
  salesTrend: 'up' | 'down' | 'stable';
}

interface PurchaseSuggestionsProps {
  products: Product[];
}

export default function PurchaseSuggestions({ products }: PurchaseSuggestionsProps) {
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [orderQuantities, setOrderQuantities] = useState<Record<string, number>>({});
  const [selectAll, setSelectAll] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [salesData, setSalesData] = useState<Record<string, number>>({});
  const [recommendations, setRecommendations] = useState<Record<string, ProductRecommendation>>({});
  const [orderMode, setOrderMode] = useState<'basic' | 'smart'>('basic');
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [emailAddress, setEmailAddress] = useState('');
  const [supplier, setSupplier] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [suppliers, setSuppliers] = useState<Array<{id: string, name: string}>>([]);
  const [isGeneratingPO, setIsGeneratingPO] = useState(false);
  const [createPODialogOpen, setCreatePODialogOpen] = useState(false);
  
  // Inisialisasi kuantitas pesanan
  const initOrderQuantities = useCallback(() => {
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
  }, [products]);

  // Fetch supplier data
  const fetchSuppliers = async () => {
    try {
      // Normally you'd fetch this from an API
      // For demonstration purposes, we'll use a static list
      setSuppliers([
        { id: 'supplier-1', name: 'PT Pakan Ternak Sejahtera' },
        { id: 'supplier-2', name: 'UD Makmur Jaya' },
        { id: 'supplier-3', name: 'CV Ternak Sukses' },
        { id: 'supplier-4', name: 'Toko Pakan Berkah' }
      ]);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      toast.error('Gagal mengambil data supplier');
    }
  };

  // Efek samping untuk inisialisasi
  useEffect(() => {
    initOrderQuantities();
    generatePoNumber();
    fetchSuppliers();
  }, [products, initOrderQuantities]);

  // Generate nomor PO
  const generatePoNumber = () => {
    const now = new Date();
    const year = now.getFullYear().toString().slice(2);
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    setPoNumber(`PO-${year}${month}${day}-${random}`);
  };

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
    if (quantity === '') {
      // Jika input kosong, hapus key dari orderQuantities atau set ke 0
      const updatedQuantities = { ...orderQuantities };
      delete updatedQuantities[productId];
      setOrderQuantities(updatedQuantities);
      return;
    }
    
    const numQuantity = parseInt(quantity) || 0;
    setOrderQuantities({
      ...orderQuantities,
      [productId]: numQuantity
    });
  };

  // Fetch sales data for recommendations
  const fetchSalesData = async () => {
    setLoadingRecommendations(true);
    
    try {
      // Panggil API untuk mendapatkan data penjualan 30 hari terakhir
      const response = await fetch('/api/analytics/sales?period=30days');
      
      if (!response.ok) {
        throw new Error('Failed to fetch sales data');
      }
      
      const data = await response.json();
      
      // Struktur data produk berdasarkan id
      const productSales: Record<string, number> = {};
      const salesTrend: Record<string, 'up' | 'down' | 'stable'> = {};
      
      // Jika API mengembalikan data yang distrukturisasi dengan benar
      if (data.success && data.productSales) {
        // Gunakan data dari API jika tersedia
        Object.keys(data.productSales).forEach(productId => {
          productSales[productId] = data.productSales[productId].avgDaily || 0;
          salesTrend[productId] = data.productSales[productId].trend || 'stable';
        });
      } else {
        // Fallback jika API tidak mengembalikan struktur yang diharapkan
        if (data.transactions) {
          const sales: Record<string, number[]> = {};
          
          // Kelompokkan penjualan berdasarkan produk
          data.transactions.forEach((tx: any) => {
            tx.items.forEach((item: any) => {
              const productId = item.productId;
              if (!sales[productId]) {
                sales[productId] = [];
              }
              sales[productId].push(item.quantity);
            });
          });
          
          // Hitung rata-rata penjualan dan tren
          Object.entries(sales).forEach(([productId, quantities]) => {
            const total = quantities.reduce((sum, qty) => sum + qty, 0);
            const avgDaily = total / 30; // Rata-rata harian selama 30 hari
            
            productSales[productId] = avgDaily;
            
            // Tentukan tren berdasarkan perbandingan 15 hari pertama dan 15 hari kedua
            if (quantities.length > 15) {
              const firstHalf = quantities.slice(0, 15).reduce((sum, qty) => sum + qty, 0);
              const secondHalf = quantities.slice(15).reduce((sum, qty) => sum + qty, 0);
              
              if (secondHalf > firstHalf * 1.1) {
                salesTrend[productId] = 'up';
              } else if (secondHalf < firstHalf * 0.9) {
                salesTrend[productId] = 'down';
              } else {
                salesTrend[productId] = 'stable';
              }
            } else {
              salesTrend[productId] = 'stable';
            }
          });
        }
      }
      
      setSalesData(productSales);
      
      // Buat rekomendasi
      const newRecommendations: Record<string, ProductRecommendation> = {};
      
      products.forEach(product => {
        const avgSales = productSales[product.id] || 0;
        const trend = salesTrend[product.id] || 'stable';
        
        // Perkiraan berapa hari stok akan habis
        const daysToEmpty = avgSales > 0 ? Math.floor(product.stock / avgSales) : 999;
        
        // Rekomendasi kuantitas pesanan yang lebih cerdas
        let recommendedOrder = 0;
        
        if (avgSales > 0) {
          // Hitung kebutuhan berdasarkan tren:
          // - Tren naik: Pesanan untuk 45 hari ke depan (1.5x normal)
          // - Tren stabil: Pesanan untuk 30 hari ke depan (normal)
          // - Tren turun: Pesanan untuk 20 hari ke depan (0.67x normal)
          const forecastDays = trend === 'up' ? 45 : (trend === 'down' ? 20 : 30);
          recommendedOrder = Math.ceil(avgSales * forecastDays) - product.stock;
          
          // Min. 1, kecuali stok mencukupi
          recommendedOrder = Math.max(recommendedOrder, 0);
          
          // Jika rekomendasi lebih dari 0 tapi sangat kecil, tetapkan minimum
          if (recommendedOrder > 0 && recommendedOrder < 3) {
            recommendedOrder = 3; // Minimum order 3 unit untuk efisiensi
          }
        } else if (product.threshold && product.stock <= product.threshold) {
          // Jika tidak ada data penjualan tapi stok di bawah threshold
          recommendedOrder = product.threshold * 2 - product.stock;
        }
        
        if (recommendedOrder > 0 || daysToEmpty < 30) {
          newRecommendations[product.id] = {
            productId: product.id,
            averageSales: avgSales,
            daysToEmpty: daysToEmpty,
            recommendedOrder: recommendedOrder,
            salesTrend: trend
          };
        }
      });
      
      setRecommendations(newRecommendations);
      
      // Update kuantitas pesanan jika mode smart dipilih
      if (orderMode === 'smart') {
        const smartQuantities = { ...orderQuantities };
        
        Object.entries(newRecommendations).forEach(([productId, rec]) => {
          smartQuantities[productId] = rec.recommendedOrder;
        });
        
        setOrderQuantities(smartQuantities);
      }
      
      toast.success('Rekomendasi dibuat berdasarkan data penjualan');
      
    } catch (error) {
      console.error('Error fetching sales data:', error);
      toast.error('Gagal mendapatkan data penjualan');
    } finally {
      setLoadingRecommendations(false);
    }
  };
  
  // Apply smart recommendations based on sales data
  const applySmartRecommendations = () => {
    if (Object.keys(salesData).length === 0) {
      fetchSalesData().then(() => {
        calculateRecommendations();
      });
    } else {
      calculateRecommendations();
    }
  };

  // Calculate recommendations based on sales data
  const calculateRecommendations = () => {
    setLoadingRecommendations(true);
    
    try {
      const newRecommendations: Record<string, ProductRecommendation> = {};
      
      products.forEach(product => {
        const avgSales = salesData[product.id] || 0;
        
        // Perkiraan berapa hari stok akan habis
        const daysToEmpty = avgSales > 0 ? Math.floor(product.stock / avgSales) : 999;
        
        // Rekomendasi kuantitas pesanan
        let recommendedOrder = 0;
        
        if (avgSales > 0) {
          // Pesanan untuk 30 hari ke depan, dikurangi stok yang ada
          recommendedOrder = Math.ceil(avgSales * 30) - product.stock;
          
          // Minimal rekomendasi adalah 1
          recommendedOrder = Math.max(recommendedOrder, 1);
        } else if (product.threshold && product.stock <= product.threshold) {
          // Jika tidak ada data penjualan tapi stok di bawah threshold
          recommendedOrder = product.threshold * 2 - product.stock;
        }
        
        if (recommendedOrder > 0) {
          newRecommendations[product.id] = {
            productId: product.id,
            averageSales: avgSales,
            daysToEmpty: daysToEmpty,
            recommendedOrder: recommendedOrder,
            salesTrend: 'stable' // Default ke 'stable' jika tidak ada data trend
          };
        }
      });
      
      setRecommendations(newRecommendations);
      
      // Update kuantitas pesanan dengan rekomendasi
      const smartQuantities = { ...orderQuantities };
      
      Object.entries(newRecommendations).forEach(([productId, rec]) => {
        smartQuantities[productId] = rec.recommendedOrder;
      });
      
      setOrderQuantities(smartQuantities);
      setOrderMode('smart');
      
      // Select products with recommendations
      setSelectedProducts(Object.keys(newRecommendations));
      setSelectAll(false);
      
      toast.success('Rekomendasi cerdas diterapkan');
    } catch (error) {
      console.error('Error calculating recommendations:', error);
      toast.error('Gagal menghitung rekomendasi');
    } finally {
      setLoadingRecommendations(false);
    }
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
      setShowPrintDialog(true); // Show print/email dialog
    }, 1500);
  };

  // Kirim email purchase order
  const sendEmailPO = () => {
    if (!emailAddress) {
      toast.error('Masukkan alamat email');
      return;
    }
    
    toast.loading('Mengirim email...');
    
    // Simulasi pengiriman email
    setTimeout(() => {
      toast.dismiss();
      toast.success(`Purchase order dikirim ke ${emailAddress}`);
      setShowPrintDialog(false);
    }, 2000);
  };
  
  // Print purchase order
  const printPO = () => {
    const printContent = document.getElementById('print-po-content');
    const originalContent = document.body.innerHTML;
    
    if (printContent) {
      document.body.innerHTML = printContent.innerHTML;
      window.print();
      document.body.innerHTML = originalContent;
      window.location.reload();
    } else {
      toast.error('Konten print tidak ditemukan');
    }
  };

  // Export to CSV
  const exportToCSV = () => {
    if (selectedProducts.length === 0) {
      toast.error('Pilih minimal satu produk untuk diekspor');
      return;
    }

    // Membuat konten CSV
    const headers = ['Kode PO', 'Nama Produk', 'Kategori', 'Stok Saat Ini', 'Threshold', 'Jumlah Pesanan', 'Harga Satuan', 'Total'];
    const rows = selectedProducts.map(id => {
      const product = products.find(p => p.id === id);
      if (!product) return '';
      
      const quantity = orderQuantities[product.id] || 0;
      const totalPrice = product.price * quantity;
      
      return [
        poNumber,
        product.name,
        product.category || '-',
        product.stock,
        product.threshold || '-',
        quantity,
        product.price,
        totalPrice
      ].join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    
    // Membuat file dan mengunduhnya
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${poNumber}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('Daftar pesanan berhasil diekspor ke CSV');
  };

  // Copy to clipboard
  const copyToClipboard = () => {
    if (selectedProducts.length === 0) {
      toast.error('Pilih minimal satu produk untuk disalin');
      return;
    }

    const text = `PURCHASE ORDER #${poNumber}\n\n` + 
                `Tanggal: ${new Date().toLocaleDateString()}\n` +
                `Supplier: ${supplier || 'N/A'}\n\n` +
                selectedProducts.map(id => {
                  const product = products.find(p => p.id === id);
                  if (!product) return '';
                  
                  const quantity = orderQuantities[product.id] || 0;
                  const totalPrice = product.price * quantity;
                  
                  return `${product.name} - ${quantity} ${product.unit || 'pcs'} - ${formatRupiah(totalPrice)}`;
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

  // Get product status
  const getProductStatus = (product: Product) => {
    const recommendation = recommendations[product.id];
    
    if (!recommendation) {
      return { status: 'normal', message: 'Tidak ada rekomendasi' };
    }
    
    if (recommendation.daysToEmpty <= 7) {
      return { 
        status: 'critical', 
        message: `Stok habis dalam ${recommendation.daysToEmpty} hari`
      };
    } else if (recommendation.daysToEmpty <= 14) {
      return { 
        status: 'warning', 
        message: `Stok habis dalam ${recommendation.daysToEmpty} hari`
      };
    } else {
      return { 
        status: 'normal', 
        message: `Stok cukup untuk ${recommendation.daysToEmpty} hari`
      };
    }
  };

  // Create actual purchase order in the system
  const createPurchaseOrder = async () => {
    if (selectedProducts.length === 0) {
      toast.error('Pilih minimal satu produk untuk membuat pesanan');
      return;
    }
    
    if (!supplier) {
      toast.error('Pilih supplier terlebih dahulu');
      return;
    }
    
    setIsGeneratingPO(true);
    
    try {
      // Get selected product details
      const orderItems = selectedProducts.map(productId => {
        const product = products.find(p => p.id === productId);
        if (!product) return null;
        
        const quantity = orderQuantities[productId] || 0;
        return {
          productId,
          productName: product.name,
          quantity,
          price: product.price,
          total: product.price * quantity
        };
      }).filter(Boolean);
      
      const totalAmount = orderItems.reduce((sum, item) => sum + (item?.total || 0), 0);
      
      const purchaseOrder = {
        poNumber,
        supplierId: supplier,
        supplierName: suppliers.find(s => s.id === supplier)?.name || '',
        items: orderItems,
        totalAmount,
        status: 'pending',
        createdAt: new Date().toISOString()
      };
      
      // Normally you'd send this to your API
      console.log('Creating purchase order:', purchaseOrder);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      toast.success('Purchase Order berhasil dibuat!');
      setCreatePODialogOpen(false);
      
      // Reset selection after successful PO creation
      setSelectedProducts([]);
      setSelectAll(false);
      
    } catch (error) {
      console.error('Error creating purchase order:', error);
      toast.error('Gagal membuat Purchase Order');
    } finally {
      setIsGeneratingPO(false);
    }
  };

  return (
    <>
      <Card className="w-full">
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between">
            <div>
              <CardTitle>Saran Pembelian Produk</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Buat daftar produk yang perlu dibeli berdasarkan stok saat ini.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 mt-4 md:mt-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setOrderMode(orderMode === 'basic' ? 'smart' : 'basic');
                  if (orderMode === 'basic') {
                    applySmartRecommendations();
                  }
                }}
                className="gap-1"
                disabled={loadingRecommendations}
              >
                {loadingRecommendations ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Menghitung...</span>
                  </>
                ) : orderMode === 'basic' ? (
                  <>
                    <Brain className="h-4 w-4" />
                    <span>Mode Cerdas</span>
                  </>
                ) : (
                  <>
                    <PackageSearch className="h-4 w-4" />
                    <span>Mode Dasar</span>
                  </>
                )}
              </Button>
              
              <Select
                value={supplier}
                onValueChange={setSupplier}
              >
                <SelectTrigger className="h-9 w-full sm:w-[180px]">
                  <SelectValue placeholder="Pilih Supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <span className="text-sm font-medium">PO Number:</span>
              <Input 
                value={poNumber} 
                onChange={(e) => setPoNumber(e.target.value)}
                className="w-full sm:w-[200px] h-8 text-sm"
              />
            </div>
            
            {/* Mobile-only action buttons */}
            <div className="flex justify-between mt-2 sm:hidden">
              <Button
                variant="outline"
                size="sm"
                onClick={() => toggleSelectAll()}
                className="text-xs px-2"
              >
                {selectAll ? 'Batal Pilih' : 'Pilih Semua'}
              </Button>
              
              {selectedProducts.length > 0 && (
                <Button
                  size="sm"
                  onClick={() => setCreatePODialogOpen(true)}
                  className="text-xs px-2"
                >
                  Buat PO ({selectedProducts.length})
                </Button>
              )}
            </div>
          </div>
          
          {/* Desktop table view */}
          <div className="hidden sm:block rounded-md border overflow-hidden">
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
                  <TableHead>Avg. Penjualan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Jumlah Pesanan</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.length > 0 ? (
                  products.map((product) => {
                    const productStatus = getProductStatus(product);
                    const recommendation = recommendations[product.id];
                    const orderQty = orderQuantities[product.id] || 0;
                    const totalPrice = product.price * orderQty;
                    
                    return (
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
                        <TableCell>
                          {salesData[product.id] ? (
                            <div className="flex items-center gap-1">
                              <TrendingUp className="h-3 w-3 text-primary" />
                              <span>{salesData[product.id].toFixed(1)}/hari</span>
                            </div>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          {recommendation ? (
                            <Badge 
                              variant={
                                productStatus.status === 'critical' ? 'destructive' :
                                productStatus.status === 'warning' ? 'default' : 'outline'
                              }
                              title={productStatus.message}
                            >
                              {recommendation.daysToEmpty < 999 
                                ? `${recommendation.daysToEmpty} hari`
                                : 'Stok aman'
                              }
                            </Badge>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <FormattedNumberInput
                              value={orderQuantities[product.id] || ''}
                              onChange={(value) => updateOrderQuantity(product.id, value)}
                              className="w-20"
                              allowEmpty={true}
                            />
                            {recommendation && (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-6 px-2"
                                onClick={() => updateOrderQuantity(product.id, String(recommendation.recommendedOrder))}
                                title={`Sarankan ${recommendation.recommendedOrder} ${product.unit || 'pcs'} berdasarkan data penjualan`}
                              >
                                <Brain className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatRupiah(totalPrice)}
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10">
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
          
          {/* Mobile card view */}
          <div className="sm:hidden space-y-3">
            {products.length > 0 ? (
              products.map((product) => {
                const productStatus = getProductStatus(product);
                const recommendation = recommendations[product.id];
                const orderQty = orderQuantities[product.id] || 0;
                const totalPrice = product.price * orderQty;
                
                return (
                  <div 
                    key={product.id} 
                    className={`p-3 border rounded-lg ${
                      selectedProducts.includes(product.id) ? 'border-primary bg-primary/5' : ''
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <h4 className="font-medium line-clamp-1">{product.name}</h4>
                        <div className="text-xs text-muted-foreground flex items-center flex-wrap">
                          <span>{product.category || 'Tidak Terkategori'}</span>
                          <span className="mx-1">•</span>
                          <Badge 
                            variant={getStockVariant(product.stock, product.threshold)}
                            className="inline-flex"
                          >
                            {product.stock} {product.unit || 'pcs'}
                          </Badge>
                        </div>
                      </div>
                      <Checkbox 
                        checked={selectedProducts.includes(product.id)}
                        onCheckedChange={() => toggleProductSelection(product.id)}
                        aria-label={`Select ${product.name}`}
                        className="ml-2"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 mb-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Avg. Penjualan:</span>
                        <div>
                          {salesData[product.id] ? (
                            <div className="flex items-center gap-1">
                              <TrendingUp className="h-3 w-3 text-primary" />
                              <span>{salesData[product.id].toFixed(1)}/hari</span>
                            </div>
                          ) : (
                            '-'
                          )}
                        </div>
                      </div>
                      
                      <div>
                        <span className="text-muted-foreground">Status:</span>
                        <div>
                          {recommendation ? (
                            <Badge 
                              variant={
                                productStatus.status === 'critical' ? 'destructive' :
                                productStatus.status === 'warning' ? 'default' : 'outline'
                              }
                              title={productStatus.message}
                              className="whitespace-nowrap"
                            >
                              {recommendation.daysToEmpty < 999 
                                ? `${recommendation.daysToEmpty} hari`
                                : 'Stok aman'
                              }
                            </Badge>
                          ) : (
                            '-'
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-end mt-3">
                      <div className="w-24">
                        <label className="text-xs text-muted-foreground block mb-1">
                          Jumlah:
                        </label>
                        <div className="flex gap-1">
                          <FormattedNumberInput
                            value={orderQuantities[product.id] || ''}
                            onChange={(value) => updateOrderQuantity(product.id, value)}
                            className="w-16 h-8 text-sm px-2"
                            allowEmpty={true}
                          />
                          {recommendation && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0"
                              onClick={() => updateOrderQuantity(product.id, String(recommendation.recommendedOrder))}
                              title={`Sarankan ${recommendation.recommendedOrder} ${product.unit || 'pcs'} berdasarkan data penjualan`}
                            >
                              <Brain className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <span className="text-xs text-muted-foreground block mb-1">Total:</span>
                        <span className="font-medium">{formatRupiah(totalPrice)}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-10 border rounded">
                <ShoppingCart className="h-10 w-10 text-muted-foreground mb-2" />
                <p className="text-muted-foreground">
                  Tidak ada produk dengan stok menipis
                </p>
              </div>
            )}
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
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        disabled={generating}
                        onClick={() => setShowPrintDialog(true)}
                      >
                        <Printer className="h-4 w-4 mr-1" />
                        <span className="sm:inline hidden">Print</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        disabled={generating}
                        onClick={() => setShowPrintDialog(true)}
                      >
                        <Mail className="h-4 w-4 mr-1" />
                        <span className="sm:inline hidden">Email</span>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Print/Email Dialog */}
      <Dialog open={showPrintDialog} onOpenChange={setShowPrintDialog}>
        <DialogContent className="w-[95vw] max-w-[525px] rounded-lg">
          <DialogHeader>
            <DialogTitle>Purchase Order #{poNumber}</DialogTitle>
            <DialogDescription>
              Cetak atau kirim purchase order ke email
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <div className="text-sm font-medium">Email:</div>
              <Input 
                value={emailAddress} 
                onChange={(e) => setEmailAddress(e.target.value)}
                className="col-span-3"
                placeholder="Email tujuan pengiriman"
              />
            </div>
          </div>
          
          <div className="my-2 max-h-[300px] overflow-auto border rounded p-4" id="print-po-content">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold">PURCHASE ORDER</h2>
              <p className="text-sm text-muted-foreground">#{poNumber}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <p className="text-sm font-medium">Tanggal:</p>
                <p className="text-sm">{new Date().toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Supplier:</p>
                <p className="text-sm">{suppliers.find(s => s.id === supplier)?.name || 'N/A'}</p>
              </div>
            </div>
            
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 text-sm">Produk</th>
                  <th className="text-center py-2 text-sm">Jumlah</th>
                  <th className="text-right py-2 text-sm">Harga</th>
                  <th className="text-right py-2 text-sm">Total</th>
                </tr>
              </thead>
              <tbody>
                {selectedProducts.map(id => {
                  const product = products.find(p => p.id === id);
                  if (!product) return null;
                  
                  const quantity = orderQuantities[id] || 0;
                  const total = product.price * quantity;
                  
                  return (
                    <tr key={product.id} className="border-b">
                      <td className="py-2 text-sm">{product.name}</td>
                      <td className="py-2 text-center text-sm">{quantity} {product.unit || 'pcs'}</td>
                      <td className="py-2 text-right text-sm">{formatRupiah(product.price)}</td>
                      <td className="py-2 text-right text-sm">{formatRupiah(total)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="font-medium">
                  <td colSpan={3} className="py-2 text-right text-sm">Total:</td>
                  <td className="py-2 text-right text-sm">{formatRupiah(calculateTotalCost())}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowPrintDialog(false)} className="sm:w-auto w-full">
              Tutup
            </Button>
            <Button variant="outline" onClick={printPO} className="sm:w-auto w-full">
              <Printer className="h-4 w-4 mr-2" />
              Cetak
            </Button>
            <Button onClick={sendEmailPO} disabled={!emailAddress} className="sm:w-auto w-full">
              <Mail className="h-4 w-4 mr-2" />
              Kirim Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Add Create PO Dialog */}
      <Dialog open={createPODialogOpen} onOpenChange={setCreatePODialogOpen}>
        <DialogContent className="w-[95vw] max-w-[500px] rounded-lg">
          <DialogHeader>
            <DialogTitle>Buat Purchase Order</DialogTitle>
            <DialogDescription>
              Buat Purchase Order untuk produk yang dipilih. PO akan dikirimkan ke supplier.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="poNumber">Nomor PO</Label>
                <Input 
                  id="poNumber" 
                  value={poNumber} 
                  onChange={(e) => setPoNumber(e.target.value)}
                  placeholder="PO-230501"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="poSupplier">Supplier</Label>
                <Select
                  value={supplier}
                  onValueChange={setSupplier}
                >
                  <SelectTrigger id="poSupplier">
                    <SelectValue placeholder="Pilih Supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="border rounded-md p-2">
              <p className="text-sm font-medium mb-2">Produk yang Akan Dipesan:</p>
              <div className="max-h-[200px] overflow-y-auto space-y-2">
                {selectedProducts.length > 0 ? (
                  selectedProducts.map(id => {
                    const product = products.find(p => p.id === id);
                    if (!product) return null;
                    
                    const orderQty = orderQuantities[id] || 0;
                    const totalPrice = product.price * orderQty;
                    
                    return (
                      <div key={id} className="flex justify-between text-sm">
                        <div className="line-clamp-1 flex-1 mr-2">{product.name} x {orderQty}</div>
                        <div className="whitespace-nowrap">{formatRupiah(totalPrice)}</div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-muted-foreground">Tidak ada produk yang dipilih</p>
                )}
              </div>
              <div className="mt-2 pt-2 border-t flex justify-between font-medium">
                <div>Total:</div>
                <div>{formatRupiah(calculateTotalCost())}</div>
              </div>
            </div>
          </div>
          
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setCreatePODialogOpen(false)}
              className="sm:w-auto w-full"
            >
              Batal
            </Button>
            <Button
              onClick={createPurchaseOrder}
              disabled={isGeneratingPO || selectedProducts.length === 0 || !supplier}
              className="sm:w-auto w-full"
            >
              {isGeneratingPO ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Membuat...
                </>
              ) : (
                <>
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Buat PO
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Desktop action buttons */}
      <div className="hidden sm:block px-6 pb-4">
        <div className="flex flex-wrap justify-end gap-2 mt-4">
          <Button 
            variant="outline" 
            size="sm"
            onClick={copyToClipboard}
            disabled={selectedProducts.length === 0}
            className="gap-1"
          >
            <ClipboardCheck className="h-4 w-4" />
            Salin
          </Button>
          
          <Button 
            variant="outline" 
            size="sm"
            onClick={exportToCSV}
            disabled={selectedProducts.length === 0}
            className="gap-1"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          
          <Button
            onClick={() => setCreatePODialogOpen(true)}
            disabled={selectedProducts.length === 0}
            className="gap-2"
          >
            <ShoppingCart className="h-4 w-4" />
            Buat Purchase Order
          </Button>
        </div>
      </div>
      
      {/* Mobile floating action buttons */}
      {selectedProducts.length > 0 && (
        <div className="sm:hidden fixed bottom-4 right-4 left-4 z-10">
          <div className="flex gap-2 p-3 rounded-lg bg-card border shadow-lg">
            <Button 
              variant="outline" 
              size="sm"
              className="flex-1"
              onClick={copyToClipboard}
            >
              <ClipboardCheck className="h-4 w-4" />
            </Button>
            
            <Button 
              variant="outline" 
              size="sm"
              className="flex-1"
              onClick={exportToCSV}
            >
              <Download className="h-4 w-4" />
            </Button>
            
            <Button
              size="sm"
              className="flex-1"
              onClick={() => setCreatePODialogOpen(true)}
            >
              <ShoppingCart className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
} 