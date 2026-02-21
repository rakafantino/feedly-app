"use client";

import { useState, useRef, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useRouter } from "next/navigation";
import { formatRupiah, getStockVariant } from "@/lib/utils";
import { Pencil, Trash2, Search, Plus, Package, Filter, RefreshCw, Loader2 } from "lucide-react";
import { ProductsSkeleton } from "@/components/skeleton/ProductsSkeleton";
import { ProductCard } from "./ProductCard";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { CsvImportExport } from "./CsvImportExport";
import { useProducts, useDeleteProduct, useSyncStock, useConvertInventory } from "@/hooks/useProducts";
import { useCategories } from "@/hooks/useCategories";

// Local component untuk ProductsCardSkeleton
function ProductsCardSkeleton() {
  const skeletonCards = Array.from({ length: 4 }, (_, i) => i);

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-3">
        <Skeleton className="h-8 w-[250px]" />
        <Skeleton className="h-4 w-[350px]" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {skeletonCards.map((index) => (
          <Card key={index} className="h-full">
            <CardContent className="pt-6">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <Skeleton className="h-5 w-[180px] mb-2" />
                  <Skeleton className="h-4 w-full max-w-[240px]" />
                </div>
                <Skeleton className="h-6 w-16 ml-2" />
              </div>

              <div className="mt-4 flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-20" />
              </div>
            </CardContent>

            <CardFooter className="border-t p-3 flex gap-2">
              <Skeleton className="h-9 flex-1" />
              <Skeleton className="h-9 flex-1" />
            </CardFooter>
          </Card>
        ))}
      </div>

      <div className="flex items-center justify-center">
        <Skeleton className="h-8 w-72" />
      </div>
    </div>
  );
}

export default function ProductTable() {
  const router = useRouter();

  // State untuk filter dan search
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearchQuery, setActiveSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [isStateLoaded, setIsStateLoaded] = useState(false);

  // Load state dari sessionStorage saat komponen di-mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedPage = sessionStorage.getItem("product_list_page");
      if (savedPage) setCurrentPage(parseInt(savedPage, 10));

      const savedSearch = sessionStorage.getItem("product_list_search");
      if (savedSearch) setSearchQuery(savedSearch);

      const savedActiveSearch = sessionStorage.getItem("product_list_active_search");
      if (savedActiveSearch) setActiveSearchQuery(savedActiveSearch);

      const savedCategory = sessionStorage.getItem("product_list_category");
      if (savedCategory) setCategoryFilter(savedCategory);

      setIsStateLoaded(true);
    }
  }, []);

  // Simpan state ke sessionStorage setiap kali ada perubahan
  useEffect(() => {
    if (isStateLoaded && typeof window !== "undefined") {
      sessionStorage.setItem("product_list_page", currentPage.toString());
      sessionStorage.setItem("product_list_search", searchQuery);
      sessionStorage.setItem("product_list_active_search", activeSearchQuery);
      sessionStorage.setItem("product_list_category", categoryFilter);
    }
  }, [currentPage, searchQuery, activeSearchQuery, categoryFilter, isStateLoaded]);

  // State untuk delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);


  // State for Conversion Dialog
  const [conversionDialogOpen, setConversionDialogOpen] = useState(false);
  const [productToConvert, setProductToConvert] = useState<any | null>(null);
  const [convertQuantity, setConvertQuantity] = useState("1");

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Menggunakan React Query hook
  const {
    data,
    isLoading: loading,
    isError,
    refetch,
  } = useProducts({
    page: currentPage,
    search: activeSearchQuery,
    category: categoryFilter === "all" ? "" : categoryFilter,
  });

  const products = data?.products || [];
  const pagination = data?.pagination;
  const totalPages = pagination?.totalPages || 1;

  // Use categories hook for proper category list
  const { data: categoriesData } = useCategories();
  const categories = categoriesData?.map(c => c.name) || Array.from(new Set(products.map((p) => p.category).filter(Boolean))) as string[];

  // Use mutation hooks
  const deleteMutation = useDeleteProduct();
  const syncMutation = useSyncStock();
  const convertMutation = useConvertInventory();

  // Get loading states from mutations (must be after mutations)
  const isDeleting = deleteMutation.isPending;
  const isConverting = convertMutation.isPending;

  // Handler untuk input pencarian
  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);

    // Clear any existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Set a new timeout for debouncing
    if (value.length >= 3 || value === "") {
      searchTimeoutRef.current = setTimeout(() => {
        setCurrentPage(1);
        setActiveSearchQuery(value);
      }, 800);
    }
  };

  // Manual search button handler
  const handleSearchButtonClick = () => {
    if (!searchQuery.trim()) return;

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    setCurrentPage(1);
    setActiveSearchQuery(searchQuery);
  };

  const handleCategoryChange = (value: string) => {
    setCategoryFilter(value);
    setCurrentPage(1);
  };

  const handleAddProduct = () => {
    router.push("/products/add");
  };

  const handleEditProduct = (id: string) => {
    router.push(`/products/edit/${id}`);
  };

  const openDeleteDialog = (id: string) => {
    setProductToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleDeleteProduct = () => {
    if (!productToDelete) return;

    deleteMutation.mutate(productToDelete, {
      onSuccess: () => {
        toast.success("Produk berhasil dihapus");
        const isLastProductOnPage = products.length === 1;
        if (isLastProductOnPage && currentPage > 1) {
          setCurrentPage(currentPage - 1);
        }
      },
      onError: (error) => {
        toast.error(error.message || "Gagal menghapus produk");
      },
      onSettled: () => {
        setDeleteDialogOpen(false);
        setProductToDelete(null);
      },
    });
  };

  const openConversionDialog = (product: any) => {
    setProductToConvert(product);
    setConvertQuantity("1");
    setConversionDialogOpen(true);
  };

  const handleConvertProduct = () => {
    if (!productToConvert || !convertQuantity) return;

    convertMutation.mutate({
      productId: productToConvert.id,
      quantity: parseInt(convertQuantity),
      unit: productToConvert.unit,
      convertedUnit: productToConvert.unit,
      convertFromBatch: false,
    }, {
      onSuccess: (data) => {
        toast.success(`Berhasil membuka kemasan ${convertQuantity} ${productToConvert.unit}`, {
          description: `Stok ${data.details?.target} bertambah ${data.details?.resultAmount}`,
        });
        setConversionDialogOpen(false);
      },
      onError: (error) => {
        toast.error(error.message || "Gagal konversi produk");
      },
    });
  };

  const handleSyncStock = (productId: string, productName: string) => {
    toast.loading("Menyinkronkan stok...", { id: "sync-toast" });
    
    syncMutation.mutate(productId, {
      onSuccess: (data) => {
        if (data.previousStock !== undefined) {
          toast.success(`Stok ${productName} diperbarui: ${data.previousStock} -> ${data.newStock}`, { id: "sync-toast" });
        } else {
          toast.info(`Stok ${productName} sudah sinkron`, { id: "sync-toast" });
        }
      },
      onError: () => {
        toast.error("Gagal sinkronisasi stok", { id: "sync-toast" });
      },
    });
  };

  // Helper for empty state
  const renderEmptyState = () => (
    <div className="text-center py-10 space-y-3">
      {activeSearchQuery || (categoryFilter && categoryFilter !== "all") ? (
        <div className="flex flex-col items-center">
          <Search className="h-10 w-10 mb-2 text-muted-foreground" />
          <p>Tidak ada produk yang sesuai dengan filter</p>
          <p className="text-sm text-muted-foreground">
            {activeSearchQuery && (
              <span>
                Pencarian:{" "}
                <Badge variant="secondary" className="ml-1">
                  {activeSearchQuery}
                </Badge>
              </span>
            )}
            {categoryFilter && categoryFilter !== "all" && (
              <span className="ml-2">
                Kategori:{" "}
                <Badge variant="secondary" className="ml-1">
                  {categoryFilter}
                </Badge>
              </span>
            )}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => {
              setSearchQuery("");
              setCategoryFilter("all");
              setActiveSearchQuery("");
              setCurrentPage(1);
            }}
          >
            Reset Filter
          </Button>
        </div>
      ) : (
        <>
          <Package className="h-16 w-16 mx-auto text-muted-foreground" />
          <p className="text-lg font-medium">Belum ada produk</p>
          <p className="text-muted-foreground">Silakan tambahkan produk baru untuk mulai mengelola inventaris Anda.</p>
          <Button onClick={handleAddProduct} className="mt-2">
            <Plus className="h-4 w-4 mr-2" />
            Tambah Produk
          </Button>
        </>
      )}
    </div>
  );

  if (isError) {
    return (
      <div className="text-center py-10 text-red-500">
        Terjadi kesalahan saat memuat data produk.
        <Button variant="outline" onClick={() => refetch()} className="ml-2">
          Coba Lagi
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <div className="relative flex-1 min-w-[200px]">
              {loading ? (
                <div className="absolute right-2.5 top-2.5">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : (
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              )}
              <Input
                placeholder="Cari produk..."
                value={searchQuery}
                onChange={handleSearchInputChange}
                className={loading ? "pl-3 pr-8" : "pl-8"}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSearchButtonClick();
                  }
                }}
              />
            </div>

            {categories.length > 0 && (
              <div className="relative min-w-[160px]">
                <Select value={categoryFilter} onValueChange={handleCategoryChange}>
                  <SelectTrigger>
                    <div className="flex items-center">
                      <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                      <SelectValue placeholder="Kategori" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Kategori</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button onClick={handleSearchButtonClick} className="sm:w-auto w-full" disabled={!searchQuery.trim()}>
              Cari
            </Button>
          </div>

          <div className="flex sm:flex-row flex-col gap-2 w-full sm:w-auto">
            <div className="sm:block hidden">
              <CsvImportExport onRefresh={() => refetch()} />
            </div>
            <div className="sm:hidden block">
              <CsvImportExport onRefresh={() => refetch()} showAsDropdown={true} />
            </div>
            <Button onClick={handleAddProduct} className="sm:w-auto w-full">
              <Plus className="h-4 w-4 mr-2" />
              Tambah Produk
            </Button>
          </div>
        </div>

        {loading ? (
          <>
            <div className="hidden md:block">
              <ProductsSkeleton />
            </div>
            <div className="md:hidden">
              <ProductsCardSkeleton />
            </div>
          </>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Deskripsi</TableHead>
                    <TableHead>Harga</TableHead>
                    <TableHead>Stok</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.length > 0 ? (
                    products.map((product: any) => (
                      <TableRow key={product.id}>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell>{product.category || "-"}</TableCell>
                        <TableCell className="max-w-xs truncate">{product.description || "-"}</TableCell>
                        <TableCell>{formatRupiah(product.price)}</TableCell>
                        <TableCell>
                          <Badge variant={getStockVariant(product.stock, product.threshold)}>{product.stock}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => handleEditProduct(product.id)} className="flex items-center gap-1">
                              <Pencil className="h-3.5 w-3.5" />
                              Edit
                            </Button>

                            {product.conversionTargetId && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openConversionDialog(product)}
                                className="flex items-center gap-1 text-blue-600 border-blue-200 hover:bg-blue-50"
                                title={`Konversi ke ${product.conversionRate}x unit eceran`}
                              >
                                <Package className="h-3.5 w-3.5" />
                                Buka
                              </Button>
                            )}
                            
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleSyncStock(product.id, product.name)}
                                className="flex items-center gap-1 text-orange-600 border-orange-200 hover:bg-orange-50"
                                title="Sinkronisasi Stok dengan Batch"
                            >
                                <RefreshCw className="h-3.5 w-3.5" />
                            </Button>

                            <Button variant="outline" size="sm" onClick={() => openDeleteDialog(product.id)} className="flex items-center gap-1 text-destructive border-destructive hover:bg-destructive/10">
                              <Trash2 className="h-3.5 w-3.5" />
                              Hapus
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24">
                        {renderEmptyState()}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden">
              {products.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {products.map((product) => (
                    <ProductCard 
                      key={product.id} 
                      product={product} 
                      onEdit={handleEditProduct} 
                      onDelete={openDeleteDialog}
                      onConvert={openConversionDialog}
                      onSync={handleSyncStock}
                    />
                  ))}
                </div>
              ) : (
                <div className="border rounded-lg bg-card text-card-foreground shadow">{renderEmptyState()}</div>
              )}
            </div>

            {/* Pagination - Always visible, mobile-friendly */}
            <div className="flex items-center justify-center space-x-2 py-4">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))} 
                disabled={currentPage === 1}
                className="flex-1 sm:flex-none"
              >
                ← Prev
              </Button>

              {/* Desktop: Show all page numbers */}
              <div className="hidden sm:flex items-center space-x-1">
                {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1).map((page) => (
                  <Button 
                    key={page} 
                    variant={currentPage === page ? "default" : "outline"} 
                    size="sm" 
                    onClick={() => setCurrentPage(page)} 
                    className="w-9"
                  >
                    {page}
                  </Button>
                ))}
                {totalPages > 10 && (
                  <span className="text-muted-foreground px-2">...</span>
                )}
              </div>

              {/* Mobile: Show current page */}
              <div className="sm:hidden flex-1 flex justify-center">
                <span className="text-sm text-muted-foreground">
                  {currentPage} / {totalPages}
                </span>
              </div>

              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))} 
                disabled={currentPage === totalPages}
                className="flex-1 sm:flex-none"
              >
                Next →
              </Button>
            </div>
          </>
        )}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Produk</AlertDialogTitle>
            <AlertDialogDescription>Apakah Anda yakin ingin menghapus produk ini? Tindakan ini tidak dapat dibatalkan.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteProduct} className="bg-destructive text-white font-medium hover:bg-destructive/90" disabled={isDeleting}>
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Menghapus...
                </>
              ) : (
                "Hapus"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Conversion Dialog */}
      <Dialog open={conversionDialogOpen} onOpenChange={setConversionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Buka Kemasan</DialogTitle>
            <DialogDescription>
              Konversi stok <strong>{productToConvert?.name}</strong> menjadi eceran.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Jumlah yang akan dibuka ({productToConvert?.unit || "unit"})</label>
              <Input type="number" min="1" max={productToConvert?.stock || 1} value={convertQuantity} onChange={(e) => setConvertQuantity(e.target.value)} placeholder="1" />
              <p className="text-xs text-muted-foreground">Estimasi hasil: {productToConvert && convertQuantity ? parseInt(convertQuantity) * (productToConvert.conversionRate || 0) : 0} unit eceran.</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConversionDialogOpen(false)} disabled={isConverting}>
              Batal
            </Button>
            <Button onClick={handleConvertProduct} disabled={isConverting || !convertQuantity || parseInt(convertQuantity) <= 0}>
              {isConverting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Memproses...
                </>
              ) : (
                "Konversi Sekarang"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
