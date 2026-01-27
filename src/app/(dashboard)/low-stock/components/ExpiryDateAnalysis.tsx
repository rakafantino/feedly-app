import React, { useState, useEffect } from 'react';
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
import { Clock, CalendarClock, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { calculateExpiringItems } from '@/lib/stock-utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Trash2 } from 'lucide-react';

interface ExpiryDateAnalysisProps {
  products: Product[];
  notificationDays?: number;
}

export default function ExpiryDateAnalysis({ products, notificationDays = 30 }: ExpiryDateAnalysisProps) {
  const [expiringProducts, setExpiringProducts] = useState<Array<Product & { daysLeft: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [displayCount, setDisplayCount] = useState(5);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  // Discard Dialog State
  const [openDiscard, setOpenDiscard] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<any>(null);
  const [discardQty, setDiscardQty] = useState('');
  const [discardReason, setDiscardReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleGroup = (productId: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [productId]: !prev[productId]
    }));
  };

  // Calculate expiry date status
  const getExpiryStatus = (daysLeft: number) => {
    if (daysLeft < 0) return { status: 'expired', variant: 'destructive' as const, message: 'Sudah kadaluarsa' };
    if (daysLeft < 7) return { status: 'critical', variant: 'destructive' as const, message: 'Kritis (<7 hari)' };
    if (daysLeft < notificationDays) return { status: 'warning', variant: 'default' as const, message: `Perhatian (<${notificationDays} hari)` };
    if (daysLeft < notificationDays * 2) return { status: 'attention', variant: 'secondary' as const, message: `Perhatian (<${notificationDays * 2} hari)` };
    return { status: 'good', variant: 'outline' as const, message: 'Masih lama' };
  };

  const handleDiscardClick = (product: Product, batch: any) => {
    setSelectedBatch({
      ...batch, 
      productName: product.name, 
      productId: product.id,
      unit: product.unit
    });
    setDiscardQty(batch.stock.toString()); // Default to all
    setDiscardReason('Kadaluarsa');
    setOpenDiscard(true);
  };

  const handleConfirmDiscard = async () => {
    if (!selectedBatch || !discardQty) return;
    
    setIsSubmitting(true);
    try {
        const qty = parseFloat(discardQty);
        if (isNaN(qty) || qty <= 0) {
            toast.error('Jumlah tidak valid');
            return;
        }

        const response = await fetch('/api/inventory/adjustment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                storeId: selectedBatch.storeId || products[0]?.storeId,
                productId: selectedBatch.productId,
                batchId: selectedBatch.batchId, // Use real batch ID from utils
                quantity: -qty, // Negative for removal
                type: 'EXPIRED', 
                reason: discardReason || 'Kadaluarsa'
            })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Gagal memusnahkan stok');
        }

        toast.success('Stok berhasil dimusnahkan');
        setOpenDiscard(false);
        // Refresh page or data (ideally pass a refresh callback props, but for now reload window is simplest to ensure consistency across components)
        window.location.reload();
        
    } catch (e: any) {
        toast.error(e.message);
    } finally {
        setIsSubmitting(false);
    }
  };

  // Handler untuk tombol "Lihat Lainnya"
  const handleShowMore = () => {
    // Tambahkan 5 produk lagi atau tampilkan semua jika kurang dari 5 tersisa
    // Logic updated for groups below, but simple increment works for displayCount
    setDisplayCount(prevCount => prevCount + 5);
  };

  // Filter products/batches with expiry dates and sort by closest to expiry
  useEffect(() => {
    setLoading(true);
    try {
      // Use DRY shared helper
      const filteredAndSorted = calculateExpiringItems(products);
      setExpiringProducts(filteredAndSorted);
    } catch (error) {
      console.error('Error processing expiry dates:', error);
      toast.error('Gagal memproses data kadaluarsa');
    } finally {
      setLoading(false);
    }
  }, [products, notificationDays]);

  // Group products by ID (handling batches)
  const groupedProducts = expiringProducts.reduce((acc, product) => {
    const parentId = (product as any).originalId || product.id || 'unknown';
    if (!acc[parentId]) {
      acc[parentId] = {
        id: parentId,
        name: product.name,
        category: product.category || undefined,
        items: [],
        unit: product.unit,
        minDaysLeft: product.daysLeft, // Track worst case
        totalStock: 0
      };
    }
    acc[parentId].items.push(product);
    acc[parentId].totalStock += product.stock;
    if (product.daysLeft < acc[parentId].minDaysLeft) {
      acc[parentId].minDaysLeft = product.daysLeft;
    }
    return acc;
  }, {} as Record<string, { 
    id: string; 
    name: string; 
    category?: string; 
    items: (Product & { daysLeft: number })[];
    unit?: string;
    minDaysLeft: number;
    totalStock: number;
  }>);

  const sortedGroups = Object.values(groupedProducts).sort((a, b) => a.minDaysLeft - b.minDaysLeft);

  // Calculate total stock value at risk of expiring soon (<30 days)
  const expiringValue = expiringProducts
    .filter(product => product.daysLeft < notificationDays)
    .reduce((sum, product) => sum + ((product.purchase_price || product.price) * product.stock), 0);

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
            {sortedGroups.length > 0 ? (
              <>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="text-sm font-medium mb-1">Stok Berisiko</p>
                    <p className="text-2xl font-bold">
                      {expiringProducts.filter(p => p.daysLeft < notificationDays).length}
                      <span className="text-sm font-normal text-muted-foreground ml-1">item</span>
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
                    <p className="text-xs text-muted-foreground">dalam {notificationDays} hari ke depan</p>
                  </div>
                </div>

                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produk</TableHead>
                        <TableHead>Stok Total</TableHead>
                        <TableHead>Status Kadaluarsa</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedGroups.slice(0, displayCount).map((group) => {
                        const worstStatus = getExpiryStatus(group.minDaysLeft);
                        const isExpanded = expandedGroups[group.id];
                        // Always show toggle if it's a group, or maybe check if has batches?
                        // "ketika ada produk dengan batch tertentu ... ada semacam penanda"
                        // Any grouped item essentially can expand to show details (even if single batch, to see exact date)
                        
                        return (
                          <React.Fragment key={group.id}>
                            {/* Parent Row */}
                            <TableRow 
                              className={`cursor-pointer hover:bg-muted/50 ${isExpanded ? 'bg-muted/30' : ''}`}
                              onClick={() => toggleGroup(group.id)}
                            >
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                    <div>
                                        {group.name}
                                        <div className="text-xs text-muted-foreground">{group.category || '-'}</div>
                                    </div>
                                    {/* Indicator if critical */}
                                    {group.minDaysLeft < notificationDays && (
                                        <AlertTriangle size={14} className={group.minDaysLeft < 0 ? "text-red-500" : "text-orange-500"} />
                                    )}
                                </div>
                              </TableCell>
                              <TableCell>
                                  {group.totalStock} {group.unit || 'pcs'}
                                  {group.items.length > 1 && <span className="text-xs text-muted-foreground ml-1">({group.items.length} batch)</span>}
                              </TableCell>
                              <TableCell>
                                  {/* Show range or worst date */}
                                  {group.minDaysLeft < 0 ? (
                                      <span className="text-destructive font-medium">Terdapat Batch Kadaluarsa</span>
                                  ) : (
                                      <span className={group.minDaysLeft < 7 ? "text-destructive" : ""}>
                                          {group.minDaysLeft} hari lagi (tercepat)
                                      </span>
                                  )}
                              </TableCell>
                              <TableCell>
                                <Badge variant={worstStatus.variant}>
                                   {worstStatus.message}
                                </Badge>
                              </TableCell>
                            </TableRow>

                            {/* Child Rows (Batches) */}
                            {isExpanded && group.items.map(item => {
                                const itemStatus = getExpiryStatus(item.daysLeft);
                                return (
                                    <TableRow key={item.id} className="bg-slate-50/50 hover:bg-slate-100/80 border-0">
                                        <TableCell className="pl-10 py-2">
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline" className="font-normal text-xs h-5">
                                                    Batch: {(item as any).batch_number || '-'}
                                                </Badge>
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-2 text-sm">{item.stock} {item.unit || 'pcs'}</TableCell>
                                        <TableCell className="py-2 text-sm">
                                            {item.expiry_date ? format(new Date(item.expiry_date), 'dd MMM yyyy') : '-'}
                                        </TableCell>
                                        <TableCell className="py-2">
                                            <div className="flex items-center gap-2">
                                              <Badge variant={itemStatus.variant} className="scale-90 origin-left">
                                                  {item.daysLeft < 0 
                                                    ? `${Math.abs(item.daysLeft)} hari terlambat` 
                                                    : `${item.daysLeft} hari lagi`}
                                              </Badge>
                                              <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                title="Musnahkan Stok"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDiscardClick(group as any as Product, item);
                                                }}
                                              >
                                                  <Trash2 size={14} />
                                              </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                          </React.Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                
                {sortedGroups.length > displayCount && (
                  <div className="mt-3 text-center">
                    <Button variant="outline" size="sm" onClick={handleShowMore}>
                      Lihat {sortedGroups.length - displayCount} produk lainnya
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

        <Dialog open={openDiscard} onOpenChange={setOpenDiscard}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Musnahkan Stok Kadaluarsa</DialogTitle>
                    <DialogDescription>
                        Tindakan ini akan mengurangi stok secara permanen dan mencatatnya sebagai kerugian.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                        <Label>Produk</Label>
                        <div className="font-medium text-sm border p-2 rounded bg-muted">
                            {selectedBatch?.productName} <br/>
                            <span className="text-xs text-muted-foreground">Batch: {selectedBatch?.batch_number}</span>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-2">
                            <Label>Stok Saat Ini</Label>
                            <Input disabled value={`${selectedBatch?.stock} ${selectedBatch?.unit}`} />
                         </div>
                         <div className="space-y-2">
                            <Label>Jumlah Dimusnahkan</Label>
                            <Input 
                                type="number" 
                                value={discardQty} 
                                onChange={(e) => setDiscardQty(e.target.value)}
                                min="0"
                                max={selectedBatch?.stock}
                            />
                         </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Alasan</Label>
                        <Textarea 
                            value={discardReason} 
                            onChange={(e) => setDiscardReason(e.target.value)} 
                            placeholder="Contoh: Barang sudah busuk/tidak layak jual"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpenDiscard(false)} disabled={isSubmitting}>Batal</Button>
                    <Button variant="destructive" onClick={handleConfirmDiscard} disabled={isSubmitting}>
                        {isSubmitting ? "Memproses..." : "Konfirmasi Musnahkan"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}