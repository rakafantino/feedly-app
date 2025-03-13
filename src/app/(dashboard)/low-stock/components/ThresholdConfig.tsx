'use client';

import { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';
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
  Save, 
  Sliders 
} from 'lucide-react';
import { toast } from 'sonner';

interface ThresholdConfigProps {
  products: Product[];
}

export default function ThresholdConfig({ products }: ThresholdConfigProps) {
  // State untuk filter
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeTab, setActiveTab] = useState('individual');
  
  // State untuk threshold per kategori
  const [categoryThresholds, setCategoryThresholds] = useState<Record<string, number>>({});
  
  // State untuk threshold per produk
  const [productThresholds, setProductThresholds] = useState<Record<string, number | null>>({});
  
  // State untuk mass update
  const [massValue, setMassValue] = useState<number | ''>('');
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
    const initThresholds: Record<string, number | null> = {};
    const initCategoryThresholds: Record<string, number> = {};
    
    products.forEach(product => {
      initThresholds[product.id] = product.threshold;
      
      // Hitung rata-rata threshold per kategori
      if (product.category && product.threshold !== null && product.threshold !== undefined) {
        if (!initCategoryThresholds[product.category]) {
          initCategoryThresholds[product.category] = 0;
          let count = 0;
          let sum = 0;
          
          products
            .filter(p => p.category === product.category && p.threshold !== null && p.threshold !== undefined)
            .forEach(p => {
              sum += p.threshold!;
              count++;
            });
          
          if (count > 0) {
            initCategoryThresholds[product.category] = Math.round(sum / count);
          }
        }
      }
    });
    
    setProductThresholds(initThresholds);
    setCategoryThresholds(initCategoryThresholds);
  }, [products]);
  
  // Handler untuk mengubah nilai threshold per produk
  const handleProductThresholdChange = (productId: string, value: string) => {
    const numValue = value === '' ? null : parseInt(value);
    
    setProductThresholds(prev => ({
      ...prev,
      [productId]: numValue
    }));
  };
  
  // Handler untuk mengubah nilai threshold per kategori
  const handleCategoryThresholdChange = (category: string, value: string) => {
    const numValue = parseInt(value) || 0;
    
    setCategoryThresholds(prev => ({
      ...prev,
      [category]: numValue
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
  
  // Update threshold untuk satu produk
  const updateProductThreshold = async (productId: string, threshold: number | null) => {
    try {
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
  
  // Simpan perubahan threshold per produk
  const saveIndividualThresholds = async () => {
    setLoading(true);
    try {
      let successCount = 0;
      let errorCount = 0;
      
      // Process updates sequentially to avoid overwhelming the API
      for (const productId in productThresholds) {
        const success = await updateProductThreshold(
          productId, 
          productThresholds[productId]
        );
        
        if (success) {
          successCount++;
        } else {
          errorCount++;
        }
      }
      
      if (errorCount === 0) {
        toast.success(`Threshold ${successCount} produk berhasil diperbarui`);
      } else {
        toast.warning(`${successCount} berhasil, ${errorCount} gagal diperbarui`);
      }
    } catch (error) {
      console.error('Error saving thresholds:', error);
      toast.error('Gagal menyimpan perubahan threshold');
    } finally {
      setLoading(false);
    }
  };
  
  // Simpan perubahan threshold per kategori
  const saveCategoryThresholds = async () => {
    setLoading(true);
    try {
      let successCount = 0;
      let errorCount = 0;
      
      for (const category in categoryThresholds) {
        const threshold = categoryThresholds[category];
        const productsInCategory = products.filter(p => p.category === category);
        
        for (const product of productsInCategory) {
          const success = await updateProductThreshold(product.id, threshold);
          
          if (success) {
            // Update local state too
            setProductThresholds(prev => ({
              ...prev,
              [product.id]: threshold
            }));
            
            successCount++;
          } else {
            errorCount++;
          }
        }
      }
      
      if (errorCount === 0) {
        toast.success(`Threshold ${successCount} produk berhasil diperbarui`);
      } else {
        toast.warning(`${successCount} berhasil, ${errorCount} gagal diperbarui`);
      }
    } catch (error) {
      console.error('Error saving category thresholds:', error);
      toast.error('Gagal menyimpan perubahan threshold kategori');
    } finally {
      setLoading(false);
    }
  };
  
  // Update threshold secara massal
  const updateMassThresholds = async () => {
    if (massValue === '') {
      toast.error('Nilai threshold harus diisi');
      return;
    }
    
    if (selectedProducts.length === 0) {
      toast.error('Pilih minimal satu produk');
      return;
    }
    
    setLoading(true);
    try {
      let successCount = 0;
      let errorCount = 0;
      
      for (const productId of selectedProducts) {
        const success = await updateProductThreshold(productId, massValue as number);
        
        if (success) {
          // Update local state too
          setProductThresholds(prev => ({
            ...prev,
            [productId]: massValue as number
          }));
          
          successCount++;
        } else {
          errorCount++;
        }
      }
      
      // Reset selection
      setSelectedProducts([]);
      setSelectAll(false);
      setMassValue('');
      
      if (errorCount === 0) {
        toast.success(`Threshold ${successCount} produk berhasil diperbarui`);
      } else {
        toast.warning(`${successCount} berhasil, ${errorCount} gagal diperbarui`);
      }
    } catch (error) {
      console.error('Error updating mass thresholds:', error);
      toast.error('Gagal memperbarui threshold massal');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Konfigurasi Threshold Stok</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs 
          value={activeTab} 
          onValueChange={setActiveTab}
          className="space-y-4"
        >
          <TabsList>
            <TabsTrigger value="individual">Per Produk</TabsTrigger>
            <TabsTrigger value="category">Per Kategori</TabsTrigger>
            <TabsTrigger value="mass">Update Massal</TabsTrigger>
          </TabsList>
          
          {/* Filter & Search */}
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <div className="relative flex-1">
              <Input
                placeholder="Cari produk..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
              <PackageSearch className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
            
            <div className="sm:w-1/3">
              <Select
                value={selectedCategory}
                onValueChange={setSelectedCategory}
              >
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
          
          {/* Per Produk Tab */}
          <TabsContent value="individual" className="space-y-4">
            <div className="rounded-md border max-h-[500px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama Produk</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Stok Saat Ini</TableHead>
                    <TableHead>Threshold</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.length > 0 ? (
                    filteredProducts.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell>{product.category || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={
                            product.threshold !== null && product.stock <= product.threshold 
                              ? 'warning' 
                              : 'default'
                          }>
                            {product.stock} {product.unit}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={productThresholds[product.id] === null ? '' : productThresholds[product.id]}
                            onChange={(e) => handleProductThresholdChange(product.id, e.target.value)}
                            className="w-20"
                            min="0"
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-10">
                        <div className="flex flex-col items-center gap-2">
                          <PackageSearch className="h-10 w-10 text-muted-foreground" />
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
            
            <div className="flex justify-end">
              <Button 
                onClick={saveIndividualThresholds}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Simpan Perubahan
              </Button>
            </div>
          </TabsContent>
          
          {/* Per Kategori Tab */}
          <TabsContent value="category" className="space-y-4">
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Jumlah Produk</TableHead>
                    <TableHead>Threshold</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.length > 0 ? (
                    categories.map((category) => (
                      <TableRow key={category}>
                        <TableCell className="font-medium">{category}</TableCell>
                        <TableCell>
                          {products.filter(p => p.category === category).length} produk
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={categoryThresholds[category] || ''}
                            onChange={(e) => handleCategoryThresholdChange(category, e.target.value)}
                            className="w-20"
                            min="0"
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8">
                        Tidak ada kategori ditemukan
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            
            <div className="flex justify-end">
              <Button 
                onClick={saveCategoryThresholds}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sliders className="h-4 w-4 mr-2" />
                )}
                Update Threshold Kategori
              </Button>
            </div>
            
            <div className="bg-muted/50 p-4 rounded-md text-sm">
              <p className="text-muted-foreground">
                <strong>Catatan:</strong> Update threshold berdasarkan kategori akan mengganti nilai threshold 
                untuk semua produk dalam kategori tersebut dengan nilai yang ditentukan.
              </p>
            </div>
          </TabsContent>
          
          {/* Update Massal Tab */}
          <TabsContent value="mass" className="space-y-4">
            <div className="border rounded-md p-4 space-y-4">
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
                <div className="space-y-2 flex-1">
                  <Label htmlFor="mass-threshold">Threshold Baru</Label>
                  <Input
                    id="mass-threshold"
                    type="number"
                    value={massValue}
                    onChange={(e) => setMassValue(e.target.value === '' ? '' : parseInt(e.target.value))}
                    placeholder="Masukkan nilai threshold"
                    className="w-full"
                    min="0"
                  />
                </div>
                <Button 
                  onClick={updateMassThresholds}
                  disabled={loading || massValue === '' || selectedProducts.length === 0}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCheck className="h-4 w-4 mr-2" />
                  )}
                  Update Produk Terpilih
                </Button>
              </div>
              
              <div className="rounded-md border max-h-[400px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox 
                          checked={selectAll} 
                          onCheckedChange={toggleSelectAll}
                          aria-label="Select all"
                        />
                      </TableHead>
                      <TableHead>Nama Produk</TableHead>
                      <TableHead>Kategori</TableHead>
                      <TableHead>Stok Saat Ini</TableHead>
                      <TableHead>Threshold Saat Ini</TableHead>
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
                              aria-label={`Select ${product.name}`}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{product.name}</TableCell>
                          <TableCell>{product.category || '-'}</TableCell>
                          <TableCell>{product.stock} {product.unit}</TableCell>
                          <TableCell>{product.threshold ?? '-'}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-10">
                          <div className="flex flex-col items-center gap-2">
                            <PackageSearch className="h-10 w-10 text-muted-foreground" />
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
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
} 