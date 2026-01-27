'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { FormattedNumberInput } from '@/components/ui/formatted-input';
import { Plus, Trash, Calendar, ArrowLeft, UserPlus, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { formatRupiah } from '@/lib/utils';
import { Product as ProductType } from '@/types/product';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose
} from '@/components/ui/dialog';

// Menambahkan fields yang diperlukan ke tipe Product
interface Product extends ProductType {
  supplierId?: string | null;
  supplier?: {
    id: string;
    name: string;
    phone?: string;
    address?: string;
    email?: string;
  };
}

// Define interfaces
interface Supplier {
  id: string;
  name: string;
  phone: string;
  address: string;
  email?: string;
}

interface POItem {
  id?: string;
  productId: string;
  productName: string;
  quantity: string;
  unit: string;
  price: string;
}

export default function CreatePurchaseOrderPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [formData, setFormData] = useState({
    supplierId: '',
    status: 'ordered',
    estimatedDelivery: '',
    notes: ''
  });
  const [items, setItems] = useState<POItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [itemInput, setItemInput] = useState({
    productId: '',
    quantity: '',
    unit: '',
    price: ''
  });

  // State untuk form supplier baru
  const [newSupplier, setNewSupplier] = useState({
    code: '',
    name: '',
    phone: '',
    address: '',
    email: ''
  });
  const [creatingSupplier, setCreatingSupplier] = useState(false);
  const [showSupplierDialog, setShowSupplierDialog] = useState(false);

  // Fetch suppliers and products on mount
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch suppliers
        const suppliersRes = await fetch('/api/suppliers');
        let fetchedSuppliers: Supplier[] = [];
        if (suppliersRes.ok) {
          const data = await suppliersRes.json();
          fetchedSuppliers = data.suppliers || [];
          setSuppliers(fetchedSuppliers);
        }

        // Fetch products
        const productsRes = await fetch('/api/products?limit=100&excludeRetail=true');
        if (productsRes.ok) {
          const data = await productsRes.json();
          setProducts(data.products || []);
        }

        // Load selected products from localStorage AFTER data is fetched
        loadSelectedProducts(fetchedSuppliers);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Gagal memuat data supplier dan produk');
      } finally {
        setLoading(false);
      }
    };

    // Cek apakah ada produk terpilih di localStorage
    const loadSelectedProducts = (availableSuppliers: Supplier[]) => {
      try {
        const selectedProductsJson = localStorage.getItem('selected_po_products');
        if (selectedProductsJson) {
          const selectedProducts = JSON.parse(selectedProductsJson);

          // Konversi produk terpilih menjadi item PO
          if (Array.isArray(selectedProducts) && selectedProducts.length > 0) {
            const poItems = selectedProducts.map((product: Product) => ({
              productId: product.id,
              productName: product.name,
              quantity: '1', // Default quantity
              unit: product.unit || 'pcs',
              price: product.purchase_price ? product.purchase_price.toString() : product.price.toString()
            }));

            setItems(poItems);

            // Auto-select supplier jika semua produk memiliki supplierId yang sama
            const supplierIds = selectedProducts
              .map((p: Product) => p.supplierId || p.supplier?.id)
              .filter((id: string | null | undefined): id is string => !!id);

            // Jika semua produk memiliki supplier yang sama, auto-select
            const uniqueSupplierIds = [...new Set(supplierIds)];
            if (uniqueSupplierIds.length === 1) {
              const supplierId = uniqueSupplierIds[0];
              // Verify supplier exists in the loaded list
              const supplierExists = availableSuppliers.some(s => s.id === supplierId);
              if (supplierExists) {
                setFormData(prev => ({ ...prev, supplierId }));
                toast.info('Supplier otomatis dipilih berdasarkan produk');
              } else {
                toast.warning('Supplier produk tidak ditemukan, silakan pilih supplier secara manual');
              }
            } else if (uniqueSupplierIds.length > 1) {
              toast.warning('Produk memiliki supplier berbeda, silakan pilih supplier secara manual');
            } else if (uniqueSupplierIds.length === 0) {
              toast.info('Produk belum memiliki supplier, silakan pilih supplier secara manual');
            }

            // Hapus data dari localStorage setelah digunakan
            localStorage.removeItem('selected_po_products');
          }
        }
      } catch (error) {
        console.error('Error loading selected products:', error);
      }
    };

    fetchData();
  }, []);

  // Handle form field changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Handle select field changes
  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));

    // Filter produk berdasarkan supplier yang dipilih
    if (name === 'supplierId' && value) {
      // Reset selected product if supplier changes
      setSelectedProduct(null);
      setItemInput({
        productId: '',
        quantity: '',
        unit: '',
        price: ''
      });

      // Filter produk berdasarkan supplierId
      // Jika supplier baru dipilih, tampilkan hanya produk dari supplier tersebut
      const supplierProducts = products.filter(product =>
        product.supplierId === value ||
        (product.supplier && product.supplier.id === value)
      );

      if (supplierProducts.length > 0) {
        setFilteredProducts(supplierProducts);
      } else {
        // Jika tidak ada produk untuk supplier ini, tampilkan semua produk
        // dengan indikasi bahwa produk belum dihubungkan dengan supplier
        setFilteredProducts(products);
        toast.info('Tidak ada produk terhubung dengan supplier ini. Menampilkan semua produk.');
      }
    }
  };

  // Handle product selection
  const handleProductSelect = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      setSelectedProduct(product);
      setItemInput({
        productId: product.id,
        quantity: '',
        unit: product.unit || 'pcs',
        price: product.purchase_price ? product.purchase_price.toString() : product.price.toString()
      });
    }
  };

  // Handle item input changes
  const handleItemInputChange = (name: string, value: string) => {
    setItemInput(prev => ({ ...prev, [name]: value }));
  };

  // Add item to the PO
  const addItem = () => {
    if (!selectedProduct || !itemInput.quantity || parseFloat(itemInput.quantity) <= 0 || !itemInput.price || parseFloat(itemInput.price) <= 0) {
      toast.error('Pilih produk dan masukkan jumlah serta harga yang valid');
      return;
    }

    // Cek apakah produk ini belum terhubung dengan supplier yang dipilih
    const productHasSupplier = selectedProduct.supplierId === formData.supplierId ||
      (selectedProduct.supplier && selectedProduct.supplier.id === formData.supplierId);

    // Jika produk belum terhubung dengan supplier, tanyakan user apakah ingin menghubungkannya
    if (!productHasSupplier) {
      // Notifikasi bahwa produk akan dihubungkan dengan supplier ini untuk order berikutnya
      toast.info(`Produk "${selectedProduct.name}" belum terhubung dengan supplier ini.`, {
        description: "Produk akan ditambahkan ke PO tanpa mengubah relasi supplier permanen."
      });
    }

    const newItem: POItem = {
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      quantity: itemInput.quantity,
      unit: itemInput.unit,
      price: itemInput.price
    };

    setItems(prev => [...prev, newItem]);
    setSelectedProduct(null);
    setItemInput({
      productId: '',
      quantity: '',
      unit: '',
      price: ''
    });
  };

  // Remove item from the PO
  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  // Update item quantity
  const updateItemQuantity = (index: number, value: string) => {
    setItems(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        quantity: value
      };
      return updated;
    });
  };

  // Update item price
  const updateItemPrice = (index: number, value: string) => {
    setItems(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        price: value
      };
      return updated;
    });
  };

  // Calculate total PO value
  const calculateTotal = () => {
    return items.reduce((total, item) => {
      return total + (parseFloat(item.quantity) * parseFloat(item.price));
    }, 0);
  };

  // Handle new supplier input changes
  const handleSupplierChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewSupplier(prev => ({ ...prev, [name]: value }));
  };

  // Generate supplier code automatically
  const handleGenerateSupplierCode = () => {
    if (newSupplier.name) {
      // Ambil 3 karakter pertama dari nama (uppercase)
      const cleanName = newSupplier.name.replace(/[^a-zA-Z]/g, '');
      let code = cleanName.substring(0, 3).toUpperCase();
      // Tambahkan nomor acak
      code += '-' + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      setNewSupplier(prev => ({ ...prev, code }));
    } else {
      toast.error('Masukkan nama supplier terlebih dahulu');
    }
  };
  // Submit new supplier
  const handleCreateSupplier = async () => {
    if (!newSupplier.code || !newSupplier.name || !newSupplier.phone || !newSupplier.address) {
      toast.error('Kode, nama, telepon, dan alamat supplier wajib diisi');
      return;
    }

    setCreatingSupplier(true);

    try {
      const response = await fetch('/api/suppliers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newSupplier)
      });

      if (!response.ok) {
        throw new Error('Gagal membuat supplier baru');
      }

      const data = await response.json();

      // Tambahkan supplier baru ke daftar
      const newSupplierWithId = {
        ...newSupplier,
        id: data.supplier.id
      };

      setSuppliers(prev => [...prev, newSupplierWithId]);

      // Set supplier baru sebagai supplier yang dipilih
      setFormData(prev => ({ ...prev, supplierId: data.supplier.id }));

      // Reset form
      setNewSupplier({
        code: '',
        name: '',
        phone: '',
        address: '',
        email: ''
      });

      setShowSupplierDialog(false);
      toast.success('Supplier baru berhasil ditambahkan');
    } catch (error) {
      console.error('Error creating supplier:', error);
      toast.error('Gagal menambahkan supplier baru');
    } finally {
      setCreatingSupplier(false);
    }
  };

  // Submit the form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.supplierId) {
      toast.error('Pilih supplier terlebih dahulu');
      return;
    }

    if (items.length === 0) {
      toast.error('Tambahkan minimal satu item produk');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/purchase-orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          items: items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            unit: item.unit,
            price: item.price
          }))
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Gagal membuat Purchase Order');
      }

      toast.success('Purchase Order berhasil dibuat');
      setTimeout(() => {
        router.push('/low-stock?tab=purchase');
      }, 1000);
    } catch (error) {
      console.error('Error creating PO:', error);
      toast.error(error instanceof Error ? error.message : 'Gagal membuat Purchase Order');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">Buat Purchase Order</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Informasi Purchase Order</CardTitle>
              <CardDescription>
                Informasi dasar untuk pembuatan purchase order
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="supplierId">Supplier</Label>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <Select
                      value={formData.supplierId}
                      onValueChange={(value) => handleSelectChange('supplierId', value)}
                      disabled={loading}
                    >
                      <SelectTrigger id="supplierId">
                        <SelectValue placeholder="Pilih supplier" />
                      </SelectTrigger>
                      <SelectContent>
                        {suppliers.map((supplier) => (
                          <SelectItem key={supplier.id} value={supplier.id}>
                            {supplier.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Dialog open={showSupplierDialog} onOpenChange={setShowSupplierDialog}>
                    <DialogTrigger asChild>
                      <Button variant="outline" type="button">
                        <UserPlus className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                      <DialogHeader>
                        <DialogTitle>Tambah Supplier Baru</DialogTitle>
                        <DialogDescription>
                          Isi data supplier untuk menambahkan ke daftar
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="supplier-code">Kode Supplier</Label>
                          <div className="flex gap-2">
                            <Input
                              id="supplier-code"
                              name="code"
                              value={newSupplier.code}
                              onChange={handleSupplierChange}
                              placeholder="SUP-001"
                              className="flex-1"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={handleGenerateSupplierCode}
                              title="Generate Kode"
                            >
                              <Zap className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="supplier-name">Nama Supplier</Label>
                          <Input
                            id="supplier-name"
                            name="name"
                            value={newSupplier.name}
                            onChange={handleSupplierChange}
                            placeholder="PT Supplier Pakan"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="supplier-phone">Nomor Telepon</Label>
                          <Input
                            id="supplier-phone"
                            name="phone"
                            value={newSupplier.phone}
                            onChange={handleSupplierChange}
                            placeholder="08123456789"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="supplier-address">Alamat</Label>
                          <Textarea
                            id="supplier-address"
                            name="address"
                            value={newSupplier.address}
                            onChange={handleSupplierChange}
                            placeholder="Jl. Contoh No. 123, Jakarta"
                            rows={3}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="supplier-email">Email (Opsional)</Label>
                          <Input
                            id="supplier-email"
                            name="email"
                            type="email"
                            value={newSupplier.email}
                            onChange={handleSupplierChange}
                            placeholder="supplier@example.com"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <DialogClose asChild>
                          <Button variant="outline" type="button">Batal</Button>
                        </DialogClose>
                        <Button
                          onClick={handleCreateSupplier}
                          disabled={!newSupplier.name || !newSupplier.phone || !newSupplier.address || creatingSupplier}
                          type="button"
                        >
                          {creatingSupplier ? 'Menyimpan...' : 'Tambah Supplier'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>



              <div className="space-y-2">
                <Label htmlFor="estimatedDelivery">Estimasi Pengiriman</Label>
                <div className="relative">
                  <Input
                    id="estimatedDelivery"
                    name="estimatedDelivery"
                    type="date"
                    value={formData.estimatedDelivery}
                    onChange={handleChange}
                    className="pr-10 block [&::-webkit-calendar-picker-indicator]:hidden"
                  />
                  <div 
                    className="absolute inset-y-0 right-0 flex items-center pr-3 cursor-pointer"
                    onClick={() => {
                      const input = document.getElementById('estimatedDelivery') as HTMLInputElement;
                      if (input && 'showPicker' in input) {
                        (input as any).showPicker();
                      } else {
                        input?.click(); // Fallback
                      }
                    }}
                  >
                    <Calendar className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Catatan</Label>
                <Textarea
                  id="notes"
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  placeholder="Catatan tambahan untuk PO ini"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2 lg:col-span-1">
            <CardHeader>
              <CardTitle>Tambah Item</CardTitle>
              <CardDescription>
                Tambahkan produk ke dalam purchase order ini
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="product">Produk</Label>
                <Select
                  value={itemInput.productId}
                  onValueChange={handleProductSelect}
                  disabled={loading || !formData.supplierId}
                >
                  <SelectTrigger id="product">
                    <SelectValue placeholder={!formData.supplierId ? "Pilih supplier terlebih dahulu" : "Pilih produk"} />
                  </SelectTrigger>
                  <SelectContent>
                    {(filteredProducts.length > 0 ? filteredProducts : products)
                      .filter(product => !items.some(item => item.productId === product.id))
                      .map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name} ({product.category || ''})
                          {product.supplier && product.supplier.id === formData.supplierId &&
                            " ★"} {/* Tandai produk yang sudah terhubung dengan supplier yang dipilih */}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="quantity">Jumlah</Label>
                  <FormattedNumberInput
                    id="quantity"
                    value={itemInput.quantity}
                    onChange={(value) => handleItemInputChange('quantity', value)}
                    placeholder="0"
                    allowEmpty={true}
                    disabled={!selectedProduct}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="unit">Satuan</Label>
                  <Input
                    id="unit"
                    value={itemInput.unit}
                    onChange={(e) => handleItemInputChange('unit', e.target.value)}
                    placeholder="pcs, box, kg, dsb"
                    disabled={!selectedProduct}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="price">Harga Satuan </Label>
                  <FormattedNumberInput
                    id="price"
                    value={itemInput.price}
                    onChange={(value) => handleItemInputChange('price', value)}
                    placeholder="0"
                    allowEmpty={true}
                    disabled={!selectedProduct}
                  />
                </div>
              </div>

              <Button
                type="button"
                onClick={addItem}
                disabled={!selectedProduct || !itemInput.quantity || !itemInput.price}
                className="w-full"
              >
                <Plus className="mr-2 h-4 w-4" /> Tambah Item
              </Button>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Daftar Item</CardTitle>
              <CardDescription>
                Item yang akan dibeli dalam purchase order ini
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[300px]">Produk</TableHead>
                      <TableHead className="text-right">Jumlah</TableHead>
                      <TableHead className="text-right">Harga Satuan</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                      <TableHead className="w-[70px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center">
                          Belum ada item yang ditambahkan
                        </TableCell>
                      </TableRow>
                    ) : (
                      items.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">
                            {item.productName}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <FormattedNumberInput
                                value={item.quantity}
                                onChange={(value) => updateItemQuantity(index, value)}
                                className="w-20 text-right"
                                allowEmpty={false}
                              />
                              <span>{item.unit}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <FormattedNumberInput
                              value={item.price}
                              onChange={(value) => updateItemPrice(index, value)}
                              className="w-28 text-right"
                              allowEmpty={false}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            {formatRupiah(parseFloat(item.quantity) * parseFloat(item.price))}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeItem(index)}
                            >
                              <Trash className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                    {items.length > 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-right font-bold">
                          Total
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {formatRupiah(calculateTotal())}
                        </TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <div className="md:col-span-2 flex justify-end space-x-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={submitting}
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={submitting || items.length === 0 || !formData.supplierId}
            >
              {submitting ? 'Menyimpan...' : 'Buat Purchase Order'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
} 