"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormattedNumberInput } from "@/components/ui/formatted-input";
import { Badge } from "@/components/ui/badge";
import { Product } from "@/types/product";
import { ArrowUpDown, Filter, Search, ShoppingCart, Check, Package, ChevronRight, ChevronDown, Store, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getStockVariant, formatRupiah } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TableSkeleton } from "@/components/skeleton";
import { Skeleton } from "@/components/ui/skeleton";

interface LowStockTableProps {
  products: Product[];
  loading: boolean;
  refreshData?: () => Promise<void>;
}

interface ProductGroup {
  id: string; // supplierId or 'retail' or 'no-supplier'
  name: string;
  type: "supplier" | "retail" | "other";
  products: Product[];
}

export default function LowStockTable({ products, loading, refreshData }: LowStockTableProps) {
  const router = useRouter();
  const [sortColumn, setSortColumn] = useState("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [quantityInputs, setQuantityInputs] = useState<Record<string, string>>({});

  // State for PO selection
  const [selectedProducts, setSelectedProducts] = useState<Record<string, boolean>>({});

  // State for Group Expansion
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  // State for Open Package (Conversion) Dialog
  const [conversionDialogOpen, setConversionDialogOpen] = useState(false);
  const [productToConvert, setProductToConvert] = useState<any | null>(null);
  const [convertQuantity, setConvertQuantity] = useState("1");
  const [isConverting, setIsConverting] = useState(false);


  // Get unique categories
  const categories = Array.from(new Set(products.map((product) => product.category).filter(Boolean)));

  // Sorting function
  const sortProducts = React.useCallback((productList: Product[]) => {
    return [...productList].sort((a, b) => {
      const direction = sortDirection === "asc" ? 1 : -1;
      switch (sortColumn) {
        case "name": return a.name.localeCompare(b.name) * direction;
        case "category": return (a.category || "").localeCompare(b.category || "") * direction;
        case "stock": return ((a.stock || 0) - (b.stock || 0)) * direction;
        case "price": return ((a.price || 0) - (b.price || 0)) * direction;
        default: return 0;
      }
    });
  }, [sortColumn, sortDirection]);

  const toggleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
        setSortColumn(column);
        setSortDirection("asc");
    }
  };

  // -------------------------
  // Filtering & Grouping Logic
  // -------------------------
  const groupedProducts = useMemo(() => {
    // 1. Filter
    const filtered = products.filter((product) => {
        if (searchTerm && !product.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        if (categoryFilter && categoryFilter !== "all" && product.category !== categoryFilter) return false;
        if (statusFilter !== "all") {
            if (statusFilter === "out_of_stock" && product.stock > 0) return false;
            if (statusFilter === "low_stock" && product.stock <= 0) return false;
        }
        return true;
    });

    // 2. Sort items first (so they appear sorted within groups)
    const sorted = sortProducts(filtered);

    // 3. Group
    const groups: ProductGroup[] = [];
    const supplierGroups: Record<string, Product[]> = {};
    const retailProducts: Product[] = [];
    const noSupplierProducts: Product[] = [];

    sorted.forEach((p) => {
        // Is Retail? (Has convertedFrom parent)
        if (p.convertedFrom && p.convertedFrom.length > 0) {
            retailProducts.push(p);
        } else if (p.supplierId) {
            // Has Supplier
            if (!supplierGroups[p.supplierId]) {
                supplierGroups[p.supplierId] = [];
            }
            supplierGroups[p.supplierId].push(p);
        } else {
            // No Supplier & Not Retail
            noSupplierProducts.push(p);
        }
    });

    // Add Retail Group
    if (retailProducts.length > 0) {
        groups.push({
            id: "retail-group",
            name: "Produk Eceran (Buka Kemasan)",
            type: "retail",
            products: retailProducts
        });
    }

    // Add Supplier Groups
    Object.keys(supplierGroups).forEach(supplierId => {
        // Find supplier name from the first product
        const supplierName = supplierGroups[supplierId][0].supplier?.name || "Unknown Supplier";
        groups.push({
            id: supplierId,
            name: supplierName,
            type: "supplier",
            products: supplierGroups[supplierId]
        });
    });

    // Add No-Supplier Group
    if (noSupplierProducts.length > 0) {
        groups.push({
            id: "no-supplier",
            name: "Produk Tanpa Supplier",
            type: "other",
            products: noSupplierProducts
        });
    }

    return groups;
  }, [products, searchTerm, categoryFilter, statusFilter, sortProducts]);

  // Initial Expand UseEffect
  React.useEffect(() => {
      // Auto-expand all groups initially
      const initialExpanded: Record<string, boolean> = {};
      groupedProducts.forEach(g => initialExpanded[g.id] = true);
      setExpandedGroups(prev => ({...initialExpanded, ...prev}));
  }, [groupedProducts]);


  // -------------------------
  // Handlers
  // -------------------------

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const toggleProductSelection = (productId: string) => {
    setSelectedProducts(prev => ({ ...prev, [productId]: !prev[productId] }));
  };

  const toggleGroupSelection = (group: ProductGroup) => {
      const allSelected = group.products.every(p => selectedProducts[p.id]);
      const newSelection = { ...selectedProducts };
      
      group.products.forEach(p => {
          newSelection[p.id] = !allSelected;
      });
      setSelectedProducts(newSelection);
  };

  const handleCreatePO = (groupId?: string) => {
      let productsToOrder: Product[] = [];
      
      if (groupId) {
          const group = groupedProducts.find(g => g.id === groupId);
          if (group) {
              // Prioritize explicitly selected items within the group
              const selectedInGroup = group.products.filter(p => selectedProducts[p.id]);
              productsToOrder = selectedInGroup.length > 0 ? selectedInGroup : group.products;
          }
      } else {
          // Use manually selected from all
          productsToOrder = products.filter(p => selectedProducts[p.id]);
      }

      if (productsToOrder.length === 0) {
          toast.error("Tidak ada produk yang dipilih");
          return;
      }
      
      const productsWithQty = productsToOrder.map(p => ({
          ...p,
          _orderQty: quantityInputs[p.id] || "1"
      }));

      localStorage.setItem("selected_po_products", JSON.stringify(productsWithQty));
      router.push("/purchase-orders/create");
  };

  const openConversionDialog = (product: Product) => {
      // Find parent product
      if (product.convertedFrom && product.convertedFrom.length > 0) {
          setProductToConvert({
              ...product.convertedFrom[0], // The parent
              targetName: product.name,
              targetUnit: product.unit
          });
          setConvertQuantity("1");
          setConversionDialogOpen(true);
      } else {
          toast.error("Tidak dapat menemukan produk induk untuk konversi");
      }
  };

  const handleConvertProduct = async () => {
    if (!productToConvert || !convertQuantity) return;
    setIsConverting(true);
    try {
      const response = await fetch("/api/inventory/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceProductId: productToConvert.id,
          quantity: parseInt(convertQuantity),
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal konversi");

      toast.success(`Berhasil membuka kemasan ${convertQuantity} ${productToConvert.unit}`, {
        description: `Stok ${data.details?.target || 'item'} bertambah`
      });

      setConversionDialogOpen(false);
      if (refreshData) await refreshData();
    } catch (error) {
      console.error("Conversion error:", error);
      toast.error(error instanceof Error ? error.message : "Gagal konversi");
    } finally {
      setIsConverting(false);
    }
  };


  const renderStockStatus = (product: Product) => {
      const stock = product.stock || 0;
      const threshold = product.threshold || 5;
      const statusText = stock <= 0 ? "Habis" : "Menipis";
      return (
        <Badge variant={getStockVariant(stock, threshold)}>
          {statusText} ({stock} {product.unit || "pcs"})
        </Badge>
      );
  };

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Produk dengan Stok Menipis</CardTitle>
          <CardDescription>{loading ? <Skeleton className="h-4 w-32" /> : "Produk dengan stok menipis"}</CardDescription>
        </CardHeader>
        <CardContent>
          <TableSkeleton columnCount={5} rowCount={8} showHeader={false} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
          <div>
            <CardTitle>Produk dengan Stok Menipis</CardTitle>
            <CardDescription>{products.length} produk perlu perhatian</CardDescription>
          </div>
          
          <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleCreatePO()}
                disabled={Object.values(selectedProducts).filter(Boolean).length === 0}
              >
                <ShoppingCart className="h-4 w-4 mr-2" />
                PO dari Item Terpilih ({Object.values(selectedProducts).filter(Boolean).length})
              </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
          
        {/* Fitur Search & Filter (Simple Version) */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Cari produk..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-8" />
            </div>
            <Button variant="outline" size="icon" onClick={() => setShowFilters(!showFilters)} className={showFilters ? "bg-secondary" : ""}>
              <Filter className="h-4 w-4" />
            </Button>
        </div>
        
        {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4 bg-muted/20 p-3 rounded-md">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger><SelectValue placeholder="Kategori" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Kategori</SelectItem>
                    {categories.map(c => <SelectItem key={c} value={c || ""}>{c}</SelectItem>)}
                  </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Status</SelectItem>
                    <SelectItem value="out_of_stock">Stok Habis</SelectItem>
                    <SelectItem value="low_stock">Stok Menipis</SelectItem>
                  </SelectContent>
              </Select>
            </div>
        )}

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]"></TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort("name")}>
                   <div className="flex items-center space-x-1"><span>Produk</span>{sortColumn === "name" && <ArrowUpDown className="h-3 w-3" />}</div>
                </TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort("stock")}>
                    <div className="flex items-center space-x-1"><span>Stok</span>{sortColumn === "stock" && <ArrowUpDown className="h-3 w-3" />}</div>
                </TableHead>
                <TableHead>Harga</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
                {groupedProducts.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">Tidak ada produk ditemukan</TableCell>
                    </TableRow>
                ) : (
                    groupedProducts.map(group => {
                        const isExpanded = expandedGroups[group.id];
                        const allSelected = group.products.length > 0 && group.products.every(p => selectedProducts[p.id]);

                        return (
                            <React.Fragment key={group.id}>
                                {/* Group Header */}
                                <TableRow className="bg-muted/50 hover:bg-muted/70">
                                    <TableCell className="py-2">
                                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => toggleGroup(group.id)}>
                                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                        </Button>
                                    </TableCell>
                                    <TableCell colSpan={3} className="py-2 font-medium">
                                        <div className="flex items-center gap-2">
                                            {group.type === 'retail' ? <Package className="h-4 w-4 text-orange-500" /> : <Store className="h-4 w-4 text-blue-500" />}
                                            {group.name}
                                            <Badge variant="secondary" className="ml-2 text-xs">{group.products.length}</Badge>
                                        </div>
                                    </TableCell>
                         
                                    <TableCell colSpan={2} className="py-2 text-right">
                                        {group.type === 'supplier' ? (
                                             <div className="flex items-center justify-end gap-2">
                                                 <div className="flex items-center space-x-2 mr-4">
                                                     <input 
                                                        type="checkbox" 
                                                        className="h-4 w-4 rounded border-gray-300"
                                                        checked={allSelected}
                                                        onChange={() => toggleGroupSelection(group)}
                                                     />
                                                     <span className="text-xs text-muted-foreground">Pilih Semua</span>
                                                 </div>
                                                 <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => {
                                                     // Select only this group and create PO
                                                     // We can just call handleCreatePO with groupId
                                                     handleCreatePO(group.id);
                                                 }}>
                                                     <ShoppingCart className="h-3 w-3 mr-1" />
                                                     Buat PO Supplier Ini
                                                 </Button>
                                             </div>
                                        ) : group.type === 'retail' ? (
                                            <span className="text-xs text-muted-foreground italic flex items-center justify-end gap-1">
                                                <AlertCircle className="h-3 w-3" />
                                                Gunakan &quot;Buka Kemasan&quot; untuk restock
                                            </span>
                                        ) : null}
                                    </TableCell>
                                </TableRow>

                                {/* Group Items */}
                                {isExpanded && group.products.map(product => (
                                    <TableRow key={product.id}>
                                        <TableCell className="pl-4">
                                            {group.type !== 'retail' && (
                                                <Button 
                                                    variant={selectedProducts[product.id] ? "default" : "outline"} 
                                                    size="icon" 
                                                    className={`h-6 w-6 ${selectedProducts[product.id] ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                                                    onClick={() => toggleProductSelection(product.id)}
                                                >
                                                    {selectedProducts[product.id] && <Check className="h-3 w-3" />}
                                                </Button>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-medium">{product.name}</span>
                                                {group.type === 'other' && <span className="text-xs text-red-400">Belum ada supplier</span>}
                                            </div>
                                        </TableCell>
                                        <TableCell>{product.category || "-"}</TableCell>
                                        <TableCell>{renderStockStatus(product)}</TableCell>
                                        <TableCell>{formatRupiah(product.price)}</TableCell>
                                        <TableCell className="text-right">
                                            {group.type === 'retail' && (
                                                <div className="flex justify-end">
                                                    <Button 
                                                        variant="outline" 
                                                        size="sm"
                                                        onClick={() => openConversionDialog(product)}
                                                        className="text-orange-600 border-orange-200 hover:bg-orange-50 h-8"
                                                    >
                                                        <Package className="h-3.5 w-3.5 mr-1" />
                                                        Buka Kemasan
                                                    </Button>
                                                </div>
                                            )}
                                            {group.type !== 'retail' && (
                                                <div className="flex justify-end items-center gap-2">
                                                    <span className="text-xs text-muted-foreground whitespace-nowrap hidden sm:inline">Order:</span>
                                                    <FormattedNumberInput
                                                        value={quantityInputs[product.id] || ""}
                                                        onChange={(v) => {
                                                            setQuantityInputs(p => ({...p, [product.id]: v}));
                                                            if (v && parseFloat(v) > 0 && !selectedProducts[product.id]) {
                                                                setSelectedProducts(prev => ({...prev, [product.id]: true}));
                                                            }
                                                        }}
                                                        className="w-16 h-8 text-xs text-right"
                                                        placeholder="Qty"
                                                    />
                                                </div>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </React.Fragment>
                        );
                    })
                )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={conversionDialogOpen} onOpenChange={setConversionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Buka Kemasan</DialogTitle>
            <DialogDescription>
              Ambil stok dari <strong>{productToConvert?.name}</strong> untuk mengisi <strong>{productToConvert?.targetName}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Jumlah {productToConvert?.unit} yang akan dibuka</label>
              <Input type="number" min="1" max={productToConvert?.stock || 1} value={convertQuantity} onChange={(e) => setConvertQuantity(e.target.value)} placeholder="1" />
              <p className="text-xs text-muted-foreground">
                  Akan menambah {productToConvert && convertQuantity ? parseInt(convertQuantity) * (productToConvert.conversionRate || 0) : 0} {productToConvert?.targetUnit}.
                  (Stok Induk saat ini: {productToConvert?.stock})
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConversionDialogOpen(false)}>Batal</Button>
            <Button onClick={handleConvertProduct} disabled={isConverting || !convertQuantity || parseInt(convertQuantity) <= 0}>
              {isConverting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Konversi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
