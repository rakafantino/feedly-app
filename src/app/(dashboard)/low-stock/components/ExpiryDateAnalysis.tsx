'use client';

import { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatRupiah } from '@/lib/utils';
import { Product } from '@/types/product';
import { Clock, CalendarClock } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { format, differenceInDays } from 'date-fns';

interface ExpiryDateAnalysisProps {
  products: Product[];
}

export default function ExpiryDateAnalysis({ products }: ExpiryDateAnalysisProps) {
  const [expiringProducts, setExpiringProducts] = useState<Array<Product & { daysLeft: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [displayCount, setDisplayCount] = useState(5);

  // Calculate expiry date status
  const getExpiryStatus = (daysLeft: number) => {
    if (daysLeft < 0) return { status: 'expired', variant: 'destructive' as const, message: 'Sudah kadaluarsa' };
    if (daysLeft < 7) return { status: 'critical', variant: 'destructive' as const, message: 'Kritis (<7 hari)' };
    if (daysLeft < 30) return { status: 'warning', variant: 'default' as const, message: 'Perhatian (<30 hari)' };
    if (daysLeft < 60) return { status: 'attention', variant: 'secondary' as const, message: 'Perhatian (<60 hari)' };
    return { status: 'good', variant: 'outline' as const, message: 'Masih lama' };
  };

  // Handler untuk tombol "Lihat Lainnya"
  const handleShowMore = () => {
    // Tambahkan 5 produk lagi atau tampilkan semua jika kurang dari 5 tersisa
    const remaining = expiringProducts.length - displayCount;
    const increment = remaining > 5 ? 5 : remaining;
    setDisplayCount(prevCount => prevCount + increment);
  };

  // Filter products with expiry dates and sort by closest to expiry
  useEffect(() => {
    setLoading(true);
    try {
      // Filter products that have expiry_date field
      const filteredProducts = products
        .filter(product => 
          product.expiry_date && 
          product.stock > 0 && 
          !product.isDeleted
        )
        .map(product => {
          const expiryDate = new Date(product.expiry_date as Date);
          const today = new Date();
          const daysLeft = differenceInDays(expiryDate, today);
          
          return {
            ...product,
            daysLeft
          };
        })
        .sort((a, b) => a.daysLeft - b.daysLeft);
      
      setExpiringProducts(filteredProducts);
    } catch (error) {
      console.error('Error processing expiry dates:', error);
      toast.error('Gagal memproses data kadaluarsa');
    } finally {
      setLoading(false);
    }
  }, [products]);

  // Calculate total stock value at risk of expiring soon (<30 days)
  const expiringValue = expiringProducts
    .filter(product => product.daysLeft < 30)
    .reduce((sum, product) => sum + (product.price * product.stock), 0);

  const criticalCount = expiringProducts.filter(product => product.daysLeft < 7).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-medium flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-primary" />
          Analisis Kadaluarsa Produk
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <>
            {expiringProducts.length > 0 ? (
              <>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="text-sm font-medium mb-1">Stok Berisiko</p>
                    <p className="text-2xl font-bold">
                      {expiringProducts.filter(p => p.daysLeft < 30).length}
                      <span className="text-sm font-normal text-muted-foreground ml-1">produk</span>
                    </p>
                    {criticalCount > 0 && (
                      <Badge variant="destructive" className="mt-1">
                        {criticalCount} kritis (&lt;7 hari)
                      </Badge>
                    )}
                  </div>
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="text-sm font-medium mb-1">Nilai Terancam</p>
                    <p className="text-lg md:text-xl lg:text-2xl font-bold truncate">
                      {formatRupiah(expiringValue)}
                    </p>
                    <p className="text-xs text-muted-foreground">dalam 30 hari ke depan</p>
                  </div>
                </div>

                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produk</TableHead>
                        <TableHead>Stok</TableHead>
                        <TableHead>Tanggal Kadaluarsa</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expiringProducts.slice(0, displayCount).map((product) => {
                        const expiryStatus = getExpiryStatus(product.daysLeft);
                        
                        return (
                          <TableRow key={product.id}>
                            <TableCell className="font-medium">
                              {product.name}
                              <p className="text-xs text-muted-foreground">{product.category || '-'}</p>
                            </TableCell>
                            <TableCell>{product.stock} {product.unit || 'pcs'}</TableCell>
                            <TableCell>
                              {product.expiry_date && (
                                <span className="whitespace-nowrap">
                                  {format(new Date(product.expiry_date), 'dd MMM yyyy')}
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant={expiryStatus.variant}>
                                {product.daysLeft < 0 
                                  ? `${Math.abs(product.daysLeft)} hari terlambat` 
                                  : `${product.daysLeft} hari lagi`}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                
                {expiringProducts.length > displayCount && (
                  <div className="mt-3 text-center">
                    <Button variant="outline" size="sm" onClick={handleShowMore}>
                      Lihat {expiringProducts.length - displayCount} produk lainnya
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="py-8 text-center">
                <Clock className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">
                  Tidak ada produk yang akan kadaluarsa dalam waktu dekat
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Pastikan untuk mengisi tanggal kadaluarsa untuk setiap produk
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
} 