'use client';

import { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue 
} from '@/components/ui/select';
import { Product } from '@/types/product';
import { 
  CheckCheck, 
  Filter, 
  Loader2, 
  PackageSearch, 
  Save
} from 'lucide-react';
import { toast } from 'sonner';

interface ThresholdConfigProps {
  products: Product[];
  refreshData?: () => Promise<void>;
}

export default function ThresholdConfig({ products, refreshData }: ThresholdConfigProps) {
  // State untuk filter
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  // State untuk threshold per produk
  const [productThresholds, setProductThresholds] = useState<Record<string, string>>({});
  
  // State untuk mass update
  const [massValue, setMassValue] = useState<string>('');
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  
  // State untuk operasi
  const [loading, setLoading] = useState(false);
  
  // Mencari kategori unik
  const categories = Array.from(new Set(products.map(p => p.category).filter(Boolean))) as string[];
  
  // Filter produk berdasarkan pencarian dan kategori
  const filteredProducts = products.filter(product => {
    const matchesSearch = searchTerm === '' || 
      product.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = selectedCategory === 'all' || 
      product.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  // Inisialisasi nilai threshold dari produk yang ada
  useEffect(() => {
    const initThresholds: Record<string, string> = {};
    products.forEach(product => {
      initThresholds[product.id] = product.threshold !== null && product.threshold !== undefined
        ? String(product.threshold)
        : '';
    });
    setProductThresholds(initThresholds);
    setSelectedProducts([]);
    setSelectAll(false);
  }, [products]);
  
  // Handler untuk mengubah nilai threshold per produk
  const handleProductThresholdChange = (productId: string, value: string) => {
    setProductThresholds(prev => ({
      ...prev,
      [productId]: value
    }));
  };
  
  // Toggle pilihan produk untuk mass update
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
      setSelectedProducts(filteredProducts.map(p => p.id));
    }
    setSelectAll(!selectAll);
  };
  
  // Terapkan Threshold secara massal ke state lokal
  const applyMassThresholdsLocal = () => {
    if (massValue.trim() === '') {
      toast.error('Nilai threshold massal harus diisi');
      return;
    }
    
    if (selectedProducts.length === 0) {
      toast.error('Pilih minimal satu produk');
      return;
    }

    setProductThresholds(prev => {
      const updated = { ...prev };
      selectedProducts.forEach(id => {
        updated[id] = massValue;
      });
      return updated;
    });
    
    toast.success(`Diterapkan ke ${selectedProducts.length} produk. Silakan 'Simpan Perubahan'.`);
    setSelectedProducts([]);
    setSelectAll(false);
    setMassValue('');
  };

  // Update threshold untuk satu produk via API
  const updateProductThreshold = async (productId: string, thresholdValue: string) => {
    try {
      // Konversi ke number atau null
      const threshold = thresholdValue.trim() === '' ? null : parseInt(thresholdValue);
      
      const response = await fetch(`/api/products/${productId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ threshold }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update product threshold');
      }
      return true;
    } catch (error) {
      console.error('Error updating product threshold:', error);
      return false;
    }
  };
  
  // Simpan perubahan final ke database
  const saveChanges = async () => {
    setLoading(true);
    try {
      let successCount = 0;
      let errorCount = 0;
      let updateCount = 0;
      
      // Determine what actually changed
      for (const product of products) {
        const currentThresholdStr = product.threshold !== null && product.threshold !== undefined 
          ? String(product.threshold) 
          : '';
        const newThresholdStr = productThresholds[product.id] || '';
        
        if (currentThresholdStr !== newThresholdStr) {
          updateCount++;
          const success = await updateProductThreshold(product.id, newThresholdStr);
          if (success) {
            successCount++;
          } else {
            errorCount++;
          }
        }
      }

      if (updateCount === 0) {
        toast.info("Tidak ada perubahan threshold untuk disimpan");
        return;
      }
      
      if (errorCount === 0) {
        toast.success(`Berhasil menyimpan threshold untuk ${successCount} produk.`);
        if (refreshData) {
          await refreshData();
        }
      } else {
        toast.warning(`${successCount} sukses, ${errorCount} gagal disimpan.`);
      }
    } catch (error) {
      console.error('Error saving thresholds:', error);
      toast.error('Terjadi kesalahan sistem saat menyimpan.');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Konfigurasi Threshold Stok</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Top Header: Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 space-y-1">
            <Label>Cari Produk</Label>
            <div className="relative">
              <Input
                placeholder="Misal: Indomie..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10"
              />
              <PackageSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
          </div>
          <div className="sm:w-1/3 space-y-1">
            <Label>Kategori</Label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full">
                <div className="flex items-center">
                  <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Filter kategori" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kategori</SelectItem>
                {categories.map(category => (
                  <SelectItem key={category} value={category}>{category}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Mass Update Bar (Local Apply) */}
        <div className="bg-muted/40 p-4 rounded-lg flex flex-col sm:flex-row items-end gap-4 border border-border/50">
          <div className="flex-1 w-full space-y-2">
            <Label htmlFor="mass-threshold">Isi Masal ke Produk Terpilih</Label>
            <Input
              id="mass-threshold"
              type="number"
              value={massValue}
              onChange={(e) => setMassValue(e.target.value)}
              placeholder="Angka threshold baru"
              min="0"
            />
          </div>
          <Button 
            variant="secondary" 
            onClick={applyMassThresholdsLocal}
            disabled={selectedProducts.length === 0 || massValue === ''}
            className="w-full sm:w-auto mt-4 sm:mt-0"
          >
            <CheckCheck className="h-4 w-4 mr-2" />
            Terapkan ke {selectedProducts.length > 0 ? selectedProducts.length : ""} Terpilih
          </Button>
        </div>

        {/* Main Products Table */}
        <div className="rounded-md border max-h-[500px] overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10 shadow-sm border-b">
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox 
                    checked={selectAll} 
                    onCheckedChange={toggleSelectAll}
                    aria-label="Pilih semua"
                  />
                </TableHead>
                <TableHead>Nama Produk</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Stok</TableHead>
                <TableHead>Threshold</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.length > 0 ? (
                filteredProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <Checkbox 
                        checked={selectedProducts.includes(product.id)}
                        onCheckedChange={() => toggleProductSelection(product.id)}
                        aria-label={`Pilih ${product.name}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell>{product.category || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={
                        product.threshold !== null && 
                        product.threshold !== undefined && 
                        product.stock <= product.threshold 
                          ? 'destructive' 
                          : 'default'
                      } className={product.threshold !== null && product.threshold !== undefined  && product.stock <= product.threshold  ? '' : 'bg-green-100 text-green-800 hover:bg-green-100 border-none'}>
                        {product.stock} {product.unit}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={productThresholds[product.id] || ''}
                        onChange={(e) => handleProductThresholdChange(product.id, e.target.value)}
                        className="w-24 border-muted-foreground/30 focus-visible:ring-primary"
                        min="0"
                        placeholder="0"
                      />
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10">
                    <div className="flex flex-col items-center gap-2">
                      <PackageSearch className="h-10 w-10 text-muted-foreground/40" />
                      <p className="text-muted-foreground">
                        Tidak ada produk yang sesuai dengan filter
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        
        {/* Global Save Button */}
        <div className="flex justify-end pt-2 border-t mt-6">
          <Button 
            onClick={saveChanges}
            disabled={loading}
            size="lg"
            className="w-full sm:w-auto"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Simpan Semua Perubahan
          </Button>
        </div>
        
      </CardContent>
    </Card>
  );
}