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
          
          // Format date untuk display jika ada
          const formatDate = (dateString: string | null) => {
            if (!dateString) return "";
            const date = new Date(dateString);
            return date.toISOString().split('T')[0]; // Format YYYY-MM-DD
          };
          
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
          });
        } catch (error) {
          console.error("Error fetching product:", error);
          setError("Failed to load product data");
        } finally {
          setLoading(false);
        }
      };

      fetchProduct();
    }
  }, [productId]);

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

  if (loading) {
    return <FormSkeleton />
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
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

      <div className="space-y-2">
        <Label htmlFor="name">Product Name *</Label>
        <Input
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          placeholder="Enter product name"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          placeholder="Enter product description"
          rows={4}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="barcode">Barcode</Label>
        <div className="flex gap-2">
          <Input
            id="barcode"
            name="barcode"
            value={formData.barcode}
            onChange={handleChange}
            placeholder="Enter product barcode"
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
      </div>

      <div className="space-y-2">
        <Label htmlFor="category">Category</Label>
        {showNewCategoryInput ? (
          <div className="flex gap-2">
            <Input
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="Enter new category name"
              className="flex-1"
            />
            <Button 
              type="button" 
              onClick={handleAddNewCategory}
              className="flex items-center"
              disabled={!newCategory.trim()}
            >
              Add
            </Button>
            <Button 
              type="button" 
              variant="outline"
              onClick={() => setShowNewCategoryInput(false)}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Select
              value={formData.category}
              onValueChange={handleCategoryChange}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a category" />
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
                    Add New Category
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="price">Price (Rp) *</Label>
          <FormattedNumberInput
            id="price"
            name="price"
            value={formData.price}
            onChange={(value) => handleNumberChange('price', value)}
            placeholder="0"
            required
            allowEmpty={true}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="stock">Stock *</Label>
          <FormattedNumberInput
            id="stock"
            name="stock"
            value={formData.stock}
            onChange={(value) => handleNumberChange('stock', value)}
            placeholder="0"
            required
            allowEmpty={true}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="unit">Unit</Label>
        <Input
          id="unit"
          name="unit"
          value={formData.unit}
          onChange={handleChange}
          placeholder="Enter product unit"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="threshold">
          Stok Minimum (Threshold)
          <span className="text-sm ml-1 text-muted-foreground">- Untuk alert</span>
        </Label>
        <FormattedNumberInput
          id="threshold"
          name="threshold"
          value={formData.threshold}
          onChange={(value) => handleNumberChange('threshold', value)}
          placeholder="Kosongkan jika tidak menggunakan alert"
          allowEmpty={true}
        />
        <p className="text-xs text-muted-foreground">
          Jika stok tersisa kurang dari atau sama dengan nilai ini, produk akan muncul di daftar &quot;Stok Menipis&quot;
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="purchase_price">
            Harga Beli (Rp)
            <span className="text-sm ml-1 text-muted-foreground">- Untuk perhitungan margin</span>
          </Label>
          <FormattedNumberInput
            id="purchase_price"
            name="purchase_price"
            value={formData.purchase_price}
            onChange={(value) => handleNumberChange('purchase_price', value)}
            placeholder="0"
            allowEmpty={true}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="min_selling_price">
            Harga Jual Minimum (Rp)
            <span className="text-sm ml-1 text-muted-foreground">- Untuk margin minimum</span>
          </Label>
          <FormattedNumberInput
            id="min_selling_price"
            name="min_selling_price"
            value={formData.min_selling_price}
            onChange={(value) => handleNumberChange('min_selling_price', value)}
            placeholder="0"
            allowEmpty={true}
          />
        </div>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="batch_number">
          Nomor Batch
          <span className="text-sm ml-1 text-muted-foreground">- Untuk pelacakan stok</span>
        </Label>
        <Input
          id="batch_number"
          name="batch_number"
          value={formData.batch_number}
          onChange={handleChange}
          placeholder="Nomor batch produk"
        />
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="purchase_date">
            Tanggal Pembelian
            <span className="text-sm ml-1 text-muted-foreground">- Pengecekan umur stok</span>
          </Label>
          <Input
            id="purchase_date"
            name="purchase_date"
            type="date"
            value={formData.purchase_date}
            onChange={handleChange}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="expiry_date">
            Tanggal Kadaluwarsa
            <span className="text-sm ml-1 text-muted-foreground">- Untuk alert</span>
          </Label>
          <Input
            id="expiry_date"
            name="expiry_date"
            type="date"
            value={formData.expiry_date}
            onChange={handleChange}
          />
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : productId ? "Update Product" : "Add Product"}
        </Button>
      </div>
    </form>
  );
} 