"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/textarea";
import { Label } from "@/components/ui/label";
import { Zap, Plus } from "lucide-react";
import { toast } from "sonner";
import { FormSkeleton } from "@/components/skeleton/FormSkeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormattedNumberInput } from '@/components/ui/formatted-input';

interface Supplier {
  id: string;
  name: string;
  phone: string;
  address: string;
  email?: string;
}

interface ProductFormProps {
  productId?: string;
}

export default function ProductForm({ productId }: ProductFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  
  // Supplier states
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [showNewSupplierInput, setShowNewSupplierInput] = useState(false);
  const [newSupplier, setNewSupplier] = useState({
    name: "",
    phone: "",
    address: "",
    email: ""
  });
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    barcode: "",
    category: "",
    price: "",
    stock: "",
    unit: "pcs", // default unit
    threshold: "", // batas minimum stok untuk alert
    purchase_price: "",
    min_selling_price: "",
    batch_number: "",
    expiry_date: "",
    purchase_date: "",
    supplier_id: ""  // New field for supplier
  });

  // Fetch categories when component mounts
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch('/api/categories');
        if (!response.ok) {
          throw new Error("Failed to fetch categories");
        }
        const data = await response.json();
        setCategories(data.categories);
      } catch (error) {
        console.error("Error fetching categories:", error);
      }
    };

    fetchCategories();
  }, []);

  // Fetch suppliers
  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const response = await fetch('/api/suppliers');
        if (!response.ok) {
          throw new Error("Failed to fetch suppliers");
        }
        const data = await response.json();
        setSuppliers(data.suppliers || []);
      } catch (error) {
        console.error("Error fetching suppliers:", error);
        // If API doesn't exist yet, use dummy data
        setSuppliers([
          { 
            id: "supp1", 
            name: "PT Pakan Ternak Sejahtera", 
            phone: "081234567890",
            address: "Jl. Peternakan No. 123, Jakarta"
          },
          { 
            id: "supp2", 
            name: "CV Makmur Pakan", 
            phone: "082345678901",
            address: "Jl. Raya Pakan No. 45, Bandung" 
          },
        ]);
      }
    };

    fetchSuppliers();
  }, []);

  // Fetch product data if editing
  useEffect(() => {
    if (productId) {
      const fetchProduct = async () => {
        setLoading(true);
        try {
          const response = await fetch(`/api/products/${productId}`);
          if (!response.ok) {
            throw new Error("Failed to fetch product");
          }
          const data = await response.json();
          
          const formatDate = (dateString: string | null) => {
            if (!dateString) return "";
            const date = new Date(dateString);
            return date.toISOString().split('T')[0]; // Format YYYY-MM-DD
          };
          
          // Debug log untuk melihat data
          console.log("Fetched product:", data.product);
          
          // Set formData terlebih dahulu
          setFormData({
            name: data.product.name,
            description: data.product.description || "",
            barcode: data.product.barcode || "",
            category: data.product.category || "",
            price: data.product.price.toString(),
            stock: data.product.stock.toString(),
            unit: data.product.unit || "pcs",
            threshold: data.product.threshold?.toString() || "",
            purchase_price: data.product.purchase_price?.toString() || "",
            min_selling_price: data.product.min_selling_price?.toString() || "",
            batch_number: data.product.batch_number || "",
            expiry_date: formatDate(data.product.expiry_date),
            purchase_date: formatDate(data.product.purchase_date),
            supplier_id: data.product.supplierId || (data.product.supplier?.id || ""),
          });
          
          // Jika ada data supplier di respons, tambahkan ke daftar suppliers jika belum ada
          if (data.product.supplier && data.product.supplier.id) {
            // Memastikan supplier hanya ditambahkan ke daftar jika belum ada
            setSuppliers(prevSuppliers => {
              const supplierExists = prevSuppliers.some(s => s.id === data.product.supplier.id);
              if (!supplierExists) {
                return [
                  ...prevSuppliers,
                  {
                    id: data.product.supplier.id,
                    name: data.product.supplier.name,
                    phone: data.product.supplier.phone || '',
                    address: data.product.supplier.address || '',
                    email: data.product.supplier.email || null
                  }
                ];
              }
              return prevSuppliers;
            });
          }

          // Debug - Tampilkan data produk ke konsol
          console.log("Supplier data:", data.product.supplier);
        } catch (error) {
          console.error("Error fetching product:", error);
          setError("Failed to load product data");
        } finally {
          setLoading(false);
        }
      };

      fetchProduct();
    }
  }, [productId, suppliers]);

  // Update selectedSupplier when formData.supplier_id changes or suppliers list changes
  useEffect(() => {
    if (formData.supplier_id && suppliers.length > 0) {
      // Cari dalam daftar yang ada terlebih dahulu
      const supplier = suppliers.find(s => s.id === formData.supplier_id);
      
      // Jika tidak ditemukan dan ada productId, ambil dari API produk
      if (!supplier && productId) {
        fetch(`/api/products/${productId}`)
          .then(response => response.json())
          .then(data => {
            if (data.product.supplier && data.product.supplier.id === formData.supplier_id) {
              // Pastikan supplier belum ada di daftar
              const exists = suppliers.some(s => s.id === data.product.supplier.id);
              if (!exists) {
                const newSupplier = {
                  id: data.product.supplier.id,
                  name: data.product.supplier.name,
                  phone: data.product.supplier.phone || '',
                  address: data.product.supplier.address || '',
                  email: data.product.supplier.email || null
                };
                
                // Tambahkan ke daftar suppliers dan atur sebagai selected
                setSuppliers(prev => [...prev.filter(s => s.id !== newSupplier.id), newSupplier]);
                setSelectedSupplier(newSupplier);
              }
            }
          })
          .catch(err => console.error("Error fetching product for supplier:", err));
      } else if (supplier) {
        setSelectedSupplier(supplier);
      } else {
        setSelectedSupplier(null);
      }
    } else {
      setSelectedSupplier(null);
    }
  }, [formData.supplier_id, suppliers, productId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Handler untuk nilai number dari FormattedNumberInput
  const handleNumberChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCategoryChange = (value: string) => {
    if (value === "new-category") {
      setShowNewCategoryInput(true);
    } else {
      setFormData((prev) => ({ ...prev, category: value }));
    }
  };

  const handleAddNewCategory = () => {
    if (newCategory.trim()) {
      // Add to categories list
      setCategories(prev => [...prev, newCategory.trim()]);
      // Set as current category
      setFormData(prev => ({ ...prev, category: newCategory.trim() }));
      // Reset state
      setNewCategory("");
      setShowNewCategoryInput(false);
    }
  };

  const handleSupplierChange = (value: string) => {
    if (value === "new-supplier") {
      setShowNewSupplierInput(true);
    } else {
      setFormData(prev => ({ ...prev, supplier_id: value }));
    }
  };

  const handleAddNewSupplier = async () => {
    if (newSupplier.name.trim() && newSupplier.phone.trim()) {
      try {
        // In a real application, you'd send this to your API
        // For now, we'll just simulate adding it locally
        const newSupplierId = `new-${Date.now()}`;
        const supplierToAdd = {
          id: newSupplierId,
          name: newSupplier.name.trim(),
          phone: newSupplier.phone.trim(),
          address: newSupplier.address.trim(),
          email: newSupplier.email.trim()
        };
        
        // Add to suppliers list
        setSuppliers(prev => [...prev, supplierToAdd]);
        
        // Set as current supplier
        setFormData(prev => ({ ...prev, supplier_id: newSupplierId }));
        
        // Reset state
        setNewSupplier({
          name: "",
          phone: "",
          address: "",
          email: ""
        });
        setShowNewSupplierInput(false);
        
        toast.success("Supplier baru berhasil ditambahkan");
      } catch (error) {
        console.error("Error adding supplier:", error);
        toast.error("Gagal menambahkan supplier baru");
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      // Validate form data
      if (!formData.name.trim()) {
        throw new Error("Product name is required");
      }

      const price = parseFloat(formData.price);
      if (isNaN(price) || price < 0) {
        throw new Error("Price must be a positive number");
      }

      const stock = parseInt(formData.stock);
      if (isNaN(stock) || stock < 0) {
        throw new Error("Stock must be a positive number");
      }

      // Parse threshold as number or null if empty
      let threshold = null;
      if (formData.threshold.trim() !== '') {
        threshold = parseInt(formData.threshold);
        if (isNaN(threshold) || threshold < 0) {
          throw new Error("Threshold must be a positive number");
        }
      }
      
      // Parse purchase_price and min_selling_price if not empty
      let purchase_price = null;
      if (formData.purchase_price.trim() !== '') {
        purchase_price = parseFloat(formData.purchase_price);
        if (isNaN(purchase_price) || purchase_price < 0) {
          throw new Error("Purchase price must be a positive number");
        }
      }
      
      let min_selling_price = null;
      if (formData.min_selling_price.trim() !== '') {
        min_selling_price = parseFloat(formData.min_selling_price);
        if (isNaN(min_selling_price) || min_selling_price < 0) {
          throw new Error("Minimum selling price must be a positive number");
        }
      }
      
      // Parse dates
      let expiry_date = null;
      if (formData.expiry_date.trim() !== '') {
        expiry_date = new Date(formData.expiry_date);
        if (isNaN(expiry_date.getTime())) {
          throw new Error("Invalid expiry date");
        }
      }
      
      let purchase_date = null;
      if (formData.purchase_date.trim() !== '') {
        purchase_date = new Date(formData.purchase_date);
        if (isNaN(purchase_date.getTime())) {
          throw new Error("Invalid purchase date");
        }
      }

      // Prepare data for API
      const productData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        barcode: formData.barcode.trim() || null,
        category: formData.category.trim() || null,
        price,
        stock,
        unit: formData.unit,
        threshold,
        purchase_price,
        min_selling_price,
        batch_number: formData.batch_number.trim() || null,
        expiry_date,
        purchase_date,
        supplier_id: formData.supplier_id || null,
      };

      // Determine if creating or updating
      const url = productId ? `/api/products/${productId}` : "/api/products";
      const method = productId ? "PUT" : "POST";

      // For debugging
      console.log('Sending data to API:', {
        url,
        method,
        data: productData
      });

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(productData),
      });

      const responseData = await response.json();

      if (!response.ok) {
        console.error('API Error:', responseData);
        throw new Error(responseData.error || "Failed to save product");
      }

      console.log('API Success:', responseData);

      // Show success message and redirect
      const successMessage = productId ? "Produk berhasil diperbarui" : "Produk berhasil ditambahkan";
      toast.success(successMessage);

      // Redirect after a short delay to ensure success message is seen
      setTimeout(() => {
        router.push("/products");
        router.refresh();
      }, 500);
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("An unexpected error occurred");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Generate random barcode
  const generateBarcode = () => {
    // Generate random 13 digit barcode (EAN-13 format)
    const prefix = "200"; // Custom prefix for store's products
    const randomDigits = Math.floor(Math.random() * 10000000000).toString().padStart(9, '0');
    const barcode = prefix + randomDigits;
    
    // Update form data with the generated barcode
    setFormData(prev => ({
      ...prev,
      barcode: barcode
    }));
  };

  // Generate batch number based on date, supplier, and sequence
  const generateBatchNumber = () => {
    // Get current date in YYMMDD format
    const today = new Date();
    const dateStr = today.getFullYear().toString().substr(-2) + 
                   (today.getMonth() + 1).toString().padStart(2, '0') + 
                   today.getDate().toString().padStart(2, '0');
    
    // Get supplier code (first 2 letters of supplier name or "XX" if none)
    const supplierCode = selectedSupplier 
      ? selectedSupplier.name.substring(0, 2).toUpperCase() 
      : "XX";
    
    // Random 3-digit sequence
    const sequence = Math.floor(Math.random() * 900 + 100).toString();
    
    // Format: YYMMDD-SP-123
    const batchNumber = `${dateStr}-${supplierCode}-${sequence}`;
    
    // Update form data
    setFormData(prev => ({
      ...prev,
      batch_number: batchNumber
    }));
  };

  if (loading) {
    return <FormSkeleton />
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-full">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded flex flex-col">
          <div className="flex items-center mb-2">
            <span className="font-semibold">Error: </span>
            <span className="ml-1">{error}</span>
          </div>
          {productId && (
            <p className="text-sm">
              Terjadi kesalahan saat memperbarui produk. Pastikan semua kolom terisi dengan benar.
            </p>
          )}
        </div>
      )}

      {/* Informasi Dasar Produk - 2 kolom di desktop */}
      <div className="md:grid md:grid-cols-2 md:gap-8 space-y-6 md:space-y-0">
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Nama Produk *</Label>
            <Input
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Masukkan nama produk"
              required
            />
            <p className="text-xs text-muted-foreground">
              Nama produk yang akan ditampilkan di sistem
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Deskripsi</Label>
            <Textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Masukkan deskripsi produk"
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              Informasi tambahan tentang produk (opsional)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="barcode">Barcode</Label>
            <div className="flex gap-2">
              <Input
                id="barcode"
                name="barcode"
                value={formData.barcode}
                onChange={handleChange}
                placeholder="Masukkan barcode produk"
                className="flex-1"
              />
              <Button 
                type="button" 
                variant="outline" 
                onClick={generateBarcode}
                className="flex items-center gap-1"
                title="Generate random barcode"
              >
                <Zap className="h-4 w-4" />
                Generate
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Barcode untuk pemindaian produk (opsional)
            </p>
          </div>
        </div>
        
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="category">Kategori</Label>
            {showNewCategoryInput ? (
              <div className="flex gap-2">
                <Input
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="Masukkan nama kategori baru"
                  className="flex-1"
                />
                <Button 
                  type="button" 
                  onClick={handleAddNewCategory}
                  className="flex items-center"
                  disabled={!newCategory.trim()}
                >
                  Tambah
                </Button>
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => setShowNewCategoryInput(false)}
                >
                  Batal
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Select
                  value={formData.category}
                  onValueChange={handleCategoryChange}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Pilih kategori" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                    <SelectItem value="new-category" className="text-blue-600 font-medium">
                      <div className="flex items-center gap-1">
                        <Plus className="h-4 w-4" />
                        Tambah Kategori Baru
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Pengelompokan produk untuk pelaporan dan analisis
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price">Harga Jual (Rp) *</Label>
              <FormattedNumberInput
                id="price"
                name="price"
                value={formData.price}
                onChange={(value) => handleNumberChange('price', value)}
                placeholder="0"
                required
                allowEmpty={true}
              />
              <p className="text-xs text-muted-foreground">
                Harga jual kepada pelanggan
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="stock">Stok *</Label>
              <FormattedNumberInput
                id="stock"
                name="stock"
                value={formData.stock}
                onChange={(value) => handleNumberChange('stock', value)}
                placeholder="0"
                required
                allowEmpty={true}
              />
              <p className="text-xs text-muted-foreground">
                Jumlah persediaan saat ini
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="unit">Satuan</Label>
              <Input
                id="unit"
                name="unit"
                value={formData.unit}
                onChange={handleChange}
                placeholder="Contoh: kg, pcs, box"
              />
              <p className="text-xs text-muted-foreground">
                Satuan ukuran produk (default: pcs)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="threshold">Batas Stok Minimum</Label>
              <FormattedNumberInput
                id="threshold"
                name="threshold"
                value={formData.threshold}
                onChange={(value) => handleNumberChange('threshold', value)}
                placeholder="0"
                allowEmpty={true}
              />
              <p className="text-xs text-muted-foreground">
                Sistem akan memberi notifikasi saat stok mencapai batas ini
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Informasi Harga dan Detail Pembelian - 2 kolom di desktop */}
      <div className="md:grid md:grid-cols-2 md:gap-8 space-y-6 md:space-y-0">
        <div className="space-y-6">
          <h3 className="text-lg font-medium border-b pb-2">Informasi Harga</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="purchase_price">Harga Beli (Rp)</Label>
              <FormattedNumberInput
                id="purchase_price"
                name="purchase_price"
                value={formData.purchase_price}
                onChange={(value) => handleNumberChange('purchase_price', value)}
                placeholder="0"
                allowEmpty={true}
              />
              <p className="text-xs text-muted-foreground">
                Harga pembelian dari supplier untuk perhitungan margin
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="min_selling_price">Harga Jual Minimum (Rp)</Label>
              <FormattedNumberInput
                id="min_selling_price"
                name="min_selling_price"
                value={formData.min_selling_price}
                onChange={(value) => handleNumberChange('min_selling_price', value)}
                placeholder="0"
                allowEmpty={true}
              />
              <p className="text-xs text-muted-foreground">
                Batas harga minimum untuk keuntungan yang diharapkan
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <h3 className="text-lg font-medium border-b pb-2">Informasi Batch & Kadaluarsa</h3>
          
          <div className="space-y-2">
            <Label htmlFor="batch_number">Nomor Batch</Label>
            <div className="flex gap-2">
              <Input
                id="batch_number"
                name="batch_number"
                value={formData.batch_number}
                onChange={handleChange}
                placeholder="Contoh: 231123-PT-001"
                className="flex-1"
              />
              <Button 
                type="button" 
                variant="outline" 
                onClick={generateBatchNumber}
                className="flex items-center gap-1"
                title="Generate batch number otomatis"
              >
                <Zap className="h-4 w-4" />
                Generate
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Format: Tanggal-KodeSupplier-Urut (otomatis jika kosong)
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="purchase_date">Tanggal Pembelian</Label>
              <Input
                id="purchase_date"
                name="purchase_date"
                type="date"
                value={formData.purchase_date}
                onChange={handleChange}
              />
              <p className="text-xs text-muted-foreground">
                Tanggal produk dibeli dari supplier
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="expiry_date">Tanggal Kadaluarsa</Label>
              <Input
                id="expiry_date"
                name="expiry_date"
                type="date"
                value={formData.expiry_date}
                onChange={handleChange}
              />
              <p className="text-xs text-muted-foreground">
                Tanggal produk akan kadaluarsa untuk sistem peringatan
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Informasi Supplier */}
      <div className="space-y-6">
        <h3 className="text-lg font-medium border-b pb-2">Informasi Supplier</h3>
        
        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-2">
            <Label htmlFor="supplier_id">Supplier</Label>
            {showNewSupplierInput ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Input
                    placeholder="Nama supplier baru"
                    value={newSupplier.name}
                    onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Input
                    placeholder="Nomor WhatsApp supplier"
                    value={newSupplier.phone}
                    onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Input
                    placeholder="Alamat supplier"
                    value={newSupplier.address}
                    onChange={(e) => setNewSupplier({ ...newSupplier, address: e.target.value })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Input
                    placeholder="Email supplier (opsional)"
                    value={newSupplier.email}
                    onChange={(e) => setNewSupplier({ ...newSupplier, email: e.target.value })}
                  />
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    type="button" 
                    onClick={handleAddNewSupplier}
                    disabled={!newSupplier.name.trim() || !newSupplier.phone.trim()}
                  >
                    Tambah Supplier
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={() => setShowNewSupplierInput(false)}
                  >
                    Batal
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <Select
                  value={formData.supplier_id}
                  onValueChange={handleSupplierChange}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Pilih supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                    <SelectItem value="new-supplier" className="text-blue-600 font-medium">
                      <div className="flex items-center gap-1">
                        <Plus className="h-4 w-4" />
                        Tambah Supplier Baru
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-2">
                  Pilih supplier untuk memudahkan pemesanan ulang produk
                </p>
              </div>
            )}
          </div>


          {/* Informasi Supplier yang dipilih */}
          {selectedSupplier && !showNewSupplierInput && (
            <div className="p-4 rounded-md bg-muted/50">
              <h4 className="font-medium">{selectedSupplier.name}</h4>
              <p className="text-sm mt-2">
                <span className="font-medium text-xs">WhatsApp:</span> {selectedSupplier.phone}
              </p>
              {selectedSupplier.address && (
                <p className="text-sm mt-1">
                  <span className="font-medium text-xs">Alamat:</span> {selectedSupplier.address}
                </p>
              )}
              {selectedSupplier.email && (
                <p className="text-sm mt-1">
                  <span className="font-medium text-xs">Email:</span> {selectedSupplier.email}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-4 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={submitting}
        >
          Batal
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Menyimpan..." : productId ? "Perbarui Produk" : "Tambah Produk"}
        </Button>
      </div>
    </form>
  );
} 