"use client";

import { useState, useEffect, useRef } from "react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Product } from "@/types/product";
import { useRouter } from "next/navigation";
import { formatRupiah, getStockVariant } from "@/lib/utils";
import { Pencil, Trash2, Search, Plus, Package, Filter } from "lucide-react";
import { ProductsSkeleton } from "@/components/skeleton/ProductsSkeleton";
import { ProductCard } from "./ProductCard";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue 
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { CsvImportExport } from "./CsvImportExport";

// Local component untuk ProductsCardSkeleton
function ProductsCardSkeleton() {
  // Buat array skeleton cards
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
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearchQuery, setActiveSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [categories, setCategories] = useState<string[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();

  const fetchProducts = async (page = 1, search = "", category = "") => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('page', page.toString());
      if (search) queryParams.append('search', search);
      if (category) queryParams.append('category', category);
      
      const response = await fetch(`/api/products?${queryParams.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to fetch products");
      }
      
      const data = await response.json();
      
      // Perbarui state produk
      setProducts(data.products || []);
      
      // Perbarui total halaman
      const calculatedTotalPages = Math.ceil(data.pagination?.total / data.pagination?.limit) || 1;
      setTotalPages(calculatedTotalPages);
      
      // Pastikan currentPage tidak lebih dari totalPages
      if (page > calculatedTotalPages && calculatedTotalPages > 0) {
        setCurrentPage(calculatedTotalPages);
      } else {
        setCurrentPage(page);
      }
      
      // Extract unique categories
      if (data.products && data.products.length > 0) {
        const uniqueCategories = Array.from(
          new Set(
            data.products
              .map((p: Product) => p.category)
              .filter((c: string | null) => c && c.trim() !== "")
          )
        );
        setCategories(uniqueCategories as string[]);
      }
    } catch (error) {
      console.error("Error fetching products:", error);
      toast.error("Gagal memuat data produk");
    } finally {
      setLoading(false);
    }
  };

  // Effect untuk load awal dan perubahan paginasi, filter aktif, atau pencarian aktif
  useEffect(() => {
    const loadProducts = async () => {
      // Initial load
      if (currentPage === 1 && !activeSearchQuery && categoryFilter === 'all') {
        await fetchProducts(1, '', '');
      } else {
        // Load berdasarkan filter aktif
        await fetchProducts(currentPage, activeSearchQuery, categoryFilter === 'all' ? '' : categoryFilter);
      }
    };
    
    loadProducts();
  }, [currentPage, activeSearchQuery, categoryFilter]);

  // Handler untuk input pencarian
  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    
    // Clear any existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // Set a new timeout for debouncing
    if (value.length >= 3 || value === '') {
      searchTimeoutRef.current = setTimeout(() => {
        setCurrentPage(1);
        setActiveSearchQuery(value);
      }, 800);
    }
  };

  // Clean up the timeout on component unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Manual search button handler
  const handleSearchButtonClick = () => {
    // Tidak melakukan pencarian jika query kosong
    if (!searchQuery.trim()) {
      return;
    }

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

  const handleDeleteProduct = async () => {
    if (!productToDelete) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/products/${productToDelete}`, {
        method: "DELETE",
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete product");
      }
      
      // Tambahkan notifikasi sukses
      toast.success("Produk berhasil dihapus");
      
      // Cek apakah ini produk terakhir di halaman saat ini
      const isLastProductOnPage = products.length === 1;
      
      // Jika produk terakhir di halaman dan bukan halaman pertama, kembali ke halaman sebelumnya
      const targetPage = isLastProductOnPage && currentPage > 1 ? currentPage - 1 : currentPage;
      
      // Ubah currentPage jika perlu (jika halaman berubah)
      if (targetPage !== currentPage) {
        setCurrentPage(targetPage);
      } else {
        // Jika halaman sama, perlu langsung fetch data baru karena useEffect tidak akan dipicu
        await fetchProducts(targetPage, activeSearchQuery, categoryFilter === 'all' ? '' : categoryFilter);
      }
    } catch (error) {
      console.error("Error deleting product:", error);
      toast.error(error instanceof Error ? error.message : "Gagal menghapus produk");
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setProductToDelete(null);
    }
  };

  // Helper for empty state
  const renderEmptyState = () => (
    <div className="text-center py-10 space-y-3">
      {activeSearchQuery || (categoryFilter && categoryFilter !== 'all') ? (
        <div className="flex flex-col items-center">
          <Search className="h-10 w-10 mb-2 text-muted-foreground" />
          <p>Tidak ada produk yang sesuai dengan filter</p>
          <p className="text-sm text-muted-foreground">
            {activeSearchQuery && (
              <span>
                Pencarian: <Badge variant="secondary" className="ml-1">{activeSearchQuery}</Badge>
              </span>
            )}
            {categoryFilter && categoryFilter !== 'all' && (
              <span className="ml-2">
                Kategori: <Badge variant="secondary" className="ml-1">{categoryFilter}</Badge>
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
              fetchProducts(1, "", "");
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

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <div className="relative flex-1 min-w-[200px]">
              {loading ? (
                <div className="absolute right-2.5 top-2.5">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
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
                    {categories.map(category => (
                      <SelectItem key={category} value={category}>{category}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            <Button 
              onClick={handleSearchButtonClick} 
              className="sm:w-auto w-full"
              disabled={!searchQuery.trim()}
            >
              Cari
            </Button>
          </div>
          
          <div className="flex sm:flex-row flex-col gap-2 w-full sm:w-auto">
            <div className="sm:block hidden">
              <CsvImportExport 
                onRefresh={() => fetchProducts(currentPage, activeSearchQuery, categoryFilter === 'all' ? '' : categoryFilter)} 
              />
            </div>
            <div className="sm:hidden block">
              <CsvImportExport 
                onRefresh={() => fetchProducts(currentPage, activeSearchQuery, categoryFilter === 'all' ? '' : categoryFilter)}
                showAsDropdown={true}
              />
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
                    products.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell>{product.category || '-'}</TableCell>
                        <TableCell className="max-w-xs truncate">{product.description || '-'}</TableCell>
                        <TableCell>{formatRupiah(product.price)}</TableCell>
                        <TableCell>
                          <Badge variant={getStockVariant(product.stock, product.threshold)}>
                            {product.stock}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleEditProduct(product.id)}
                              className="flex items-center gap-1"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Edit
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => openDeleteDialog(product.id)}
                              className="flex items-center gap-1 text-destructive border-destructive hover:bg-destructive/10"
                            >
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
                    />
                  ))}
                </div>
              ) : (
                <div className="border rounded-lg bg-card text-card-foreground shadow">
                  {renderEmptyState()}
                </div>
              )}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center space-x-2 py-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                >
                  Sebelumnya
                </Button>
                
                <div className="hidden sm:flex items-center space-x-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
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
                </div>
                
                <div className="sm:hidden">
                  <span className="text-sm">
                    {currentPage} dari {totalPages}
                  </span>
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                >
                  Selanjutnya
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Produk</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus produk ini? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Batal</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteProduct} 
              className="bg-destructive text-white font-medium hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  <span>Menghapus...</span>
                </div>
              ) : (
                "Hapus"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
} 