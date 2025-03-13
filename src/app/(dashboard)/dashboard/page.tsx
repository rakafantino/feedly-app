"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useEffect } from "react";
import { useProductStore } from "@/store/useProductStore";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, Package, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const { getLowStockProducts, fetchProducts } = useProductStore();
  const [lowStockProducts, setLowStockProducts] = useState<Array<any>>([]);
  const router = useRouter();

  useEffect(() => {
    fetchProducts().then(() => {
      setLowStockProducts(getLowStockProducts());
    });
  }, [fetchProducts, getLowStockProducts]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Penjualan (Hari Ini)
            </CardTitle>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-4 w-4 text-muted-foreground"
            >
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Rp 1.250.000</div>
            <p className="text-xs text-muted-foreground">
              +20.1% dari kemarin
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Produk Terjual Hari Ini
            </CardTitle>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-4 w-4 text-muted-foreground"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">28 item</div>
            <p className="text-xs text-muted-foreground">
              5 transaksi hari ini
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Stok Menipis
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lowStockProducts.length}</div>
            <p className="text-xs text-muted-foreground">
              Produk perlu diisi ulang
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="low-stock">Stok Menipis</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Metrics Overview (Chart and other visuals will go here) */}
            <Card className="col-span-2">
              <CardHeader>
                <CardTitle>Penjualan Bulan Ini</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[200px] flex items-center justify-center bg-muted/20 rounded-md">
                  <p className="text-muted-foreground">Chart Penjualan (Coming Soon)</p>
                </div>
              </CardContent>
            </Card>
            <Card className="col-span-2">
              <CardHeader>
                <CardTitle>Produk Terlaris</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[200px] flex items-center justify-center bg-muted/20 rounded-md">
                  <p className="text-muted-foreground">Top Produk (Coming Soon)</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="low-stock" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Daftar Produk dengan Stok Menipis</CardTitle>
            </CardHeader>
            <CardContent>
              {lowStockProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="bg-primary/10 text-primary rounded-full p-3 mb-3">
                    <Package className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-medium mb-1">Semua stok dalam kondisi baik</h3>
                  <p className="text-muted-foreground max-w-md">
                    Saat ini tidak ada produk yang stoknya mendekati nilai minimum (threshold)
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left whitespace-nowrap px-4 py-2 font-medium">Produk</th>
                          <th className="text-center whitespace-nowrap px-4 py-2 font-medium">Stok Saat Ini</th>
                          <th className="text-center whitespace-nowrap px-4 py-2 font-medium">Stok Minimum</th>
                          <th className="text-center whitespace-nowrap px-4 py-2 font-medium">Status</th>
                          <th className="text-right whitespace-nowrap px-4 py-2 font-medium">Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lowStockProducts.map((product) => (
                          <tr key={product.id} className="border-b">
                            <td className="px-4 py-2">
                              <div>
                                <div className="font-medium">{product.name}</div>
                                <div className="text-xs text-muted-foreground">{product.category}</div>
                              </div>
                            </td>
                            <td className="text-center px-4 py-2">
                              <div className="text-center font-medium">
                                {product.stock} {product.unit}
                              </div>
                            </td>
                            <td className="text-center px-4 py-2">
                              <div className="text-center">
                                {product.threshold} {product.unit}
                              </div>
                            </td>
                            <td className="text-center px-4 py-2">
                              <Badge 
                                variant={product.stock === 0 ? "destructive" : "warning"}
                                className="justify-center"
                              >
                                {product.stock === 0 ? "Habis" : "Menipis"}
                              </Badge>
                            </td>
                            <td className="text-right px-4 py-2">
                              <Button 
                                onClick={() => router.push(`/products/edit/${product.id}`)}
                                variant="outline" 
                                size="sm"
                                className="h-8 w-8 p-0"
                              >
                                <ExternalLink className="h-4 w-4" />
                                <span className="sr-only">Edit produk</span>
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 