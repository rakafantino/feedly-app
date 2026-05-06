"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FormattedNumberInput } from "@/components/ui/formatted-input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, Trash, ArrowLeft, Search, Check, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
import { formatRupiah } from "@/lib/utils";
import { Product } from "@/types/index";

interface POItem {
  id?: string;
  productId: string;
  productName: string;
  quantity: string;
  receivedQuantity: number;
  unit: string;
  price: string;
}

export default function EditPurchaseOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);
  
  const [products, setProducts] = useState<Product[]>([]);
  const [originalPO, setOriginalPO] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    supplierId: "",
    supplierName: "",
    status: "ordered",
    estimatedDelivery: "",
    notes: "",
  });
  
  const [items, setItems] = useState<POItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [itemInput, setItemInput] = useState({
    productId: "",
    quantity: "",
    unit: "",
    price: "",
  });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [poRes, productsRes] = await Promise.all([
          fetch(`/api/purchase-orders/${id}`),
          fetch(`/api/products?limit=100&excludeRetail=true`)
        ]);

        if (!poRes.ok) throw new Error("Gagal memuat PO");
        const poData = await poRes.json();
        const po = poData.purchaseOrder;
        
        if (['received', 'completed', 'cancelled'].includes(po.status)) {
          toast.error("PO ini tidak dapat diedit karena statusnya sudah selesai atau dibatalkan");
          router.push(`/purchase-orders/${id}`);
          return;
        }

        setOriginalPO(po);
        setFormData({
          supplierId: po.supplierId,
          supplierName: po.supplierName,
          status: po.status,
          estimatedDelivery: po.estimatedDelivery ? po.estimatedDelivery.split('T')[0] : "",
          notes: po.notes || "",
        });

        setItems(po.items.map((i: any) => ({
          id: i.id,
          productId: i.productId,
          productName: i.productName,
          quantity: i.quantity.toString(),
          receivedQuantity: i.receivedQuantity || 0,
          unit: i.unit,
          price: i.price.toString()
        })));

        if (productsRes.ok) {
          const prodData = await productsRes.json();
          setProducts(prodData.products || []);
        }
      } catch {
        toast.error("Terjadi kesalahan saat memuat data");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleProductSelect = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (product) {
      setSelectedProduct(product);
      setItemInput({
        productId: product.id,
        quantity: "",
        unit: product.unit || "pcs",
        price: product.purchase_price ? product.purchase_price.toString() : product.price.toString(),
      });
    }
  };

  const filteredProducts = products.filter((product) => {
    if (formData.supplierId) {
      const isSupplierProduct = product.supplierId === formData.supplierId || (product.supplier && product.supplier.id === formData.supplierId);
      const supplierHasProducts = products.some((p) => p.supplierId === formData.supplierId || (p.supplier && p.supplier.id === formData.supplierId));
      if (supplierHasProducts && !isSupplierProduct) return false;
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return product.name.toLowerCase().includes(query) || ((product as any).barcode && String((product as any).barcode).toLowerCase().includes(query));
    }
    return true;
  });

  const handleItemInputChange = (name: string, value: string) => {
    setItemInput((prev) => ({ ...prev, [name]: value }));
  };

  const addItem = () => {
    if (!selectedProduct || !itemInput.quantity || parseFloat(itemInput.quantity) <= 0 || !itemInput.price || parseFloat(itemInput.price) <= 0) {
      toast.error("Pilih produk dan masukkan jumlah serta harga yang valid");
      return;
    }

    const newItem: POItem = {
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      quantity: itemInput.quantity,
      receivedQuantity: 0,
      unit: itemInput.unit,
      price: itemInput.price,
    };

    setItems((prev) => [...prev, newItem]);
    setSelectedProduct(null);
    setItemInput({ productId: "", quantity: "", unit: "", price: "" });
  };

  const removeItem = (index: number) => {
    if (items[index].receivedQuantity > 0) {
      toast.error("Tidak dapat menghapus item yang sudah pernah diterima");
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateItemQuantity = (index: number, value: string) => {
    const numValue = parseFloat(value) || 0;
    if (numValue < items[index].receivedQuantity) {
      toast.error(`Kuantitas tidak boleh kurang dari yang sudah diterima (${items[index].receivedQuantity})`);
      return;
    }
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], quantity: value };
      return updated;
    });
  };

  const updateItemPrice = (index: number, value: string) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], price: value };
      return updated;
    });
  };

  const calculateTotal = useCallback(() => {
    return items.reduce((total, item) => total + parseFloat(item.quantity || "0") * parseFloat(item.price || "0"), 0);
  }, [items]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      toast.error("Tambahkan minimal satu item produk");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        notes: formData.notes,
        estimatedDelivery: formData.estimatedDelivery,
        items: items.map((item) => ({
          productId: item.productId,
          quantity: Number(item.quantity),
          unit: item.unit,
          price: Number(item.price),
        })),
      };

      const res = await fetch(`/api/purchase-orders/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Gagal memperbarui PO");
      }

      toast.success("Purchase Order berhasil diperbarui");
      router.push(`/purchase-orders/${id}`);
    } catch (error) {
      console.error("Error editing PO:", error);
      toast.error(error instanceof Error ? error.message : "Gagal memperbarui Purchase Order");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div>Memuat...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Edit Purchase Order {originalPO?.poNumber}</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Informasi Purchase Order</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Supplier</Label>
                <Input disabled value={formData.supplierName} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="estimatedDelivery">Estimasi Pengiriman</Label>
                <Input id="estimatedDelivery" name="estimatedDelivery" type="date" value={formData.estimatedDelivery} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Catatan</Label>
                <Textarea id="notes" name="notes" value={formData.notes} onChange={handleChange} rows={3} />
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2 lg:col-span-1">
            <CardHeader>
              <CardTitle>Tambah Item</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="product">Produk</Label>
                <Popover open={productDropdownOpen} onOpenChange={setProductDropdownOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" aria-expanded={productDropdownOpen} className="w-full justify-between font-normal" disabled={loading}>
                      {itemInput.productId ? products.find((product) => product.id === itemInput.productId)?.name : "Pilih produk..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0" align="start">
                    <div className="flex items-center border-b px-3">
                      <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                      <input
                        className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                        placeholder="Cari produk..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                    <div className="max-h-[300px] overflow-y-auto p-1">
                      {filteredProducts.filter((product) => !items.some((item) => item.productId === product.id)).map((product) => (
                        <div
                          key={product.id}
                          className={`relative flex cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground ${itemInput.productId === product.id ? "bg-accent" : ""}`}
                          onClick={() => {
                            handleProductSelect(product.id);
                            setProductDropdownOpen(false);
                            setSearchQuery("");
                          }}
                        >
                          <Check className={`mr-2 h-4 w-4 ${itemInput.productId === product.id ? "opacity-100" : "opacity-0"}`} />
                          <span>{product.name}</span>
                        </div>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Jumlah</Label>
                  <FormattedNumberInput value={itemInput.quantity} onChange={(value) => handleItemInputChange("quantity", value)} />
                </div>
                <div className="space-y-2">
                  <Label>Satuan</Label>
                  <Input value={itemInput.unit} onChange={(e) => handleItemInputChange("unit", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Harga Satuan</Label>
                  <FormattedNumberInput value={itemInput.price} onChange={(value) => handleItemInputChange("price", value)} />
                </div>
              </div>
              <Button type="button" onClick={addItem} disabled={!selectedProduct || !itemInput.quantity || !itemInput.price} className="w-full">
                <Plus className="mr-2 h-4 w-4" /> Tambah Item
              </Button>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Daftar Item</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produk</TableHead>
                      <TableHead className="text-right">Sudah Diterima</TableHead>
                      <TableHead className="text-right">Target Jumlah</TableHead>
                      <TableHead className="text-right">Harga Satuan</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{item.productName}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{item.receivedQuantity} {item.unit}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <FormattedNumberInput value={item.quantity} onChange={(value) => updateItemQuantity(index, value)} className="w-20 text-right" />
                            <span>{item.unit}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <FormattedNumberInput value={item.price} onChange={(value) => updateItemPrice(index, value)} className="w-28 text-right" />
                        </TableCell>
                        <TableCell className="text-right">{formatRupiah(parseFloat(item.quantity) * parseFloat(item.price))}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => removeItem(index)} disabled={item.receivedQuantity > 0}>
                            <Trash className={`h-4 w-4 ${item.receivedQuantity > 0 ? "text-muted-foreground" : "text-destructive"}`} />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={4} className="text-right font-bold">Total</TableCell>
                      <TableCell className="text-right font-bold">{formatRupiah(calculateTotal())}</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <div className="md:col-span-2 flex justify-end space-x-4">
            <Button type="button" variant="outline" onClick={() => router.back()} disabled={submitting}>Batal</Button>
            <Button type="submit" disabled={submitting || items.length === 0}>
              {submitting ? "Menyimpan..." : "Simpan Perubahan"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}