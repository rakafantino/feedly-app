'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
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
import { toast } from 'sonner';
import { formatRupiah, formatDate } from '@/lib/utils';
import { ArrowLeft, Printer, TrashIcon, Truck, Plus, Minus, Zap } from 'lucide-react';
import { generateBatchNumber } from '@/lib/batch-utils';

interface Supplier {
  id: string;
  name: string;
  phone: string;
  address: string;
  email?: string;
  code?: string;
}

interface PurchaseOrderItem {
  id: string;
  productId: string;
  productName: string;
  quantity: string;
  receivedQuantity?: number;
  unit: string;
  price: string;
}

interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierName?: string;
  supplier?: Supplier;
  status: string;
  createdAt: string;
  estimatedDelivery: string | null;
  notes: string | null;
  items: PurchaseOrderItem[];
}

// New interface for Batch Entry
interface BatchEntry {
  quantity: number;
  expiryDate?: string;
  batchNumber?: string;
}

// Definisikan PurchaseOrderStatus type
type PurchaseOrderStatus = 'draft' | 'ordered' | 'received' | 'partially_received' | 'cancelled';

// Helper function to get status badge
const getStatusBadge = (status: string) => {
  switch (status) {
    case 'draft':
      return <Badge variant="outline">Draft</Badge>;
    case 'ordered':
    case 'sent': // Legacy support
    case 'processing': // Legacy support
      return <Badge variant="secondary">Dipesan</Badge>;
    case 'partially_received':
      return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Diterima Sebagian</Badge>;
    case 'received':
      return <Badge variant="default">Diterima</Badge>;
    case 'cancelled':
      return <Badge variant="destructive">Dibatalkan</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

export default function PurchaseOrderDetail({ id }: { id: string }) {
  const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false);
  
  // NEW STATE: Keyed by Item ID -> Array of Batch Entries
  const [receiveBatches, setReceiveBatches] = useState<Record<string, BatchEntry[]>>({});

  const [closePo, setClosePo] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<PurchaseOrderStatus | ''>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();


  // Reset form when dialog opens
  useEffect(() => {
    if (receiveDialogOpen && purchaseOrder) {
      const initialBatches: Record<string, BatchEntry[]> = {};
      
      purchaseOrder.items.forEach(item => {
        const remaining = parseFloat(item.quantity) - (item.receivedQuantity || 0);
        if (remaining > 0) {
           // Default to one empty batch row with remaining quantity
           initialBatches[item.id] = [{ quantity: remaining, batchNumber: '', expiryDate: '' }];
        } else {
           initialBatches[item.id] = [];
        }
      });
      setReceiveBatches(initialBatches);
      setClosePo(false);
    }
  }, [receiveDialogOpen, purchaseOrder]);

  const handleBatchChange = (itemId: string, index: number, field: keyof BatchEntry, value: any) => {
    setReceiveBatches(prev => {
      const currentBatches = [...(prev[itemId] || [])];
      currentBatches[index] = { ...currentBatches[index], [field]: value };
      return { ...prev, [itemId]: currentBatches };
    });
  };

  const addBatchRow = (itemId: string) => {
    setReceiveBatches(prev => ({
      ...prev,
      [itemId]: [...(prev[itemId] || []), { quantity: 0, batchNumber: '', expiryDate: '' }]
    }));
  };

  const removeBatchRow = (itemId: string, index: number) => {
    setReceiveBatches(prev => {
      const currentBatches = [...(prev[itemId] || [])];
      currentBatches.splice(index, 1);
      return { ...prev, [itemId]: currentBatches };
    });
  };

  const calculateTotalReceivedForItem = (itemId: string) => {
    const batches = receiveBatches[itemId] || [];
    return batches.reduce((sum, b) => sum + (b.quantity || 0), 0);
  };

  const handleReceiveGoods = async () => {
    setIsSubmitting(true);
    try {
      // Construct payload items with non-zero received quantities
      const itemsToReceive = purchaseOrder?.items.map(item => {
        const batches = receiveBatches[item.id] || [];
        const validBatches = batches.filter(b => b.quantity > 0);
        const totalReceived = validBatches.reduce((sum, b) => sum + b.quantity, 0);

        return {
          id: item.id,
          receivedQuantity: totalReceived,
          batches: validBatches // Send detailed batch info
        };
      }).filter(i => i.receivedQuantity > 0 || closePo); 

      if (!itemsToReceive || (itemsToReceive.length === 0 && !closePo)) {
        toast.error("Masukkan jumlah yang diterima atau tandai PO selesai");
        setIsSubmitting(false);
        return;
      }

      const response = await fetch(`/api/purchase-orders/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: itemsToReceive,
          closePo: closePo
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Gagal mencatat penerimaan barang');
      }

      const data = await response.json();

      if (data.purchaseOrder) {
        const updatedPO = {
          ...data.purchaseOrder,
          items: data.purchaseOrder.items || purchaseOrder?.items || []
        };
        setPurchaseOrder(updatedPO);
        toast.success('Penerimaan barang berhasil dicatat');
        setReceiveDialogOpen(false);
        router.push('/low-stock?tab=purchase');
      } else {
        fetchPurchaseOrder();
        setReceiveDialogOpen(false);
      }

    } catch (error: any) {
      console.error('Error receiving goods:', error);
      toast.error(error.message || 'Gagal mencatat penerimaan barang');
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchPurchaseOrder = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/purchase-orders/${id}`);
      const data = await response.json();

      if (response.ok) {
        setPurchaseOrder(data.purchaseOrder);
      } else {
        const errorMsg = data.error || "Failed to fetch purchase order";
        setError(errorMsg);
        toast.error(errorMsg);
      }
    } catch (error) {
      const errorMsg = "An error occurred while fetching the purchase order";
      setError(errorMsg);
      toast.error(errorMsg);
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchPurchaseOrder();
  }, [fetchPurchaseOrder]);

  // Calculate total PO value
  const calculateTotal = () => {
    if (!purchaseOrder) return 0;
    return purchaseOrder.items.reduce((total, item) => {
      return total + (parseFloat(item.quantity) * parseFloat(item.price));
    }, 0);
  };

  // Update PO status
  const updateStatus = async () => {
    if (!purchaseOrder || selectedStatus === purchaseOrder.status) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/purchase-orders/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: selectedStatus
        }),
      });

      if (!response.ok) {
        throw new Error('Gagal mengubah status Purchase Order');
      }

      const data = await response.json();
      console.log('Data response update status:', data);

      // Pastikan data.purchaseOrder ada dan lengkap
      if (data.purchaseOrder) {
        // Jika items tidak ada di response, gunakan items dari state saat ini
        const updatedPO = {
          ...data.purchaseOrder,
          items: data.purchaseOrder.items || purchaseOrder.items || []
        };
        setPurchaseOrder(updatedPO);
        toast.success('Status Purchase Order berhasil diperbarui');
      } else {
        toast.warning('Status diperbarui, tapi data tidak lengkap');
        // Refresh data untuk mendapatkan data lengkap
        fetchPurchaseOrder();
      }
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Gagal mengubah status Purchase Order');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete purchase order
  const deletePurchaseOrder = async () => {
    try {
      const response = await fetch(`/api/purchase-orders/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Gagal menghapus Purchase Order');
      }

      toast.success('Purchase Order berhasil dihapus');
      router.push('/low-stock?tab=purchase');
    } catch (error) {
      console.error('Error deleting purchase order:', error);
      toast.error('Gagal menghapus Purchase Order');
    } finally {
      setDeleteDialogOpen(false);
    }
  };

  if (loading) return <div className="p-4">Loading...</div>;

  if (error && !purchaseOrder) {
    return (
      <div className="p-4 text-red-500">
        <p>Error: {error}</p>
        <Button onClick={fetchPurchaseOrder} className="mt-2">
          Try Again
        </Button>
      </div>
    );
  }

  if (!purchaseOrder) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <h2 className="text-xl font-semibold mb-4">Purchase Order tidak ditemukan</h2>
        <Button onClick={() => router.push('/low-stock?tab=purchase')}>
          Kembali ke Daftar PO
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/low-stock?tab=purchase')}
            className="h-8 w-8"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">
            PO: {purchaseOrder.poNumber}
          </h1>
        </div>
        <div className="flex space-x-2 self-end sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDeleteDialogOpen(true)}
            className="h-8"
          >
            <TrashIcon className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Hapus</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="h-8"
          >
            <Printer className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Cetak</span>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base sm:text-lg">Informasi Purchase Order</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div>
                <p className="text-muted-foreground">Nomor PO</p>
                <p className="font-medium">{purchaseOrder.poNumber}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Tanggal Dibuat</p>
                <p className="font-medium">{formatDate(purchaseOrder.createdAt)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Status</p>
                <div className="flex items-center mt-1">
                  {getStatusBadge(purchaseOrder.status)}
                </div>
              </div>
              <div>
                <p className="text-muted-foreground">Estimasi Pengiriman</p>
                <p className="font-medium">
                  {purchaseOrder.estimatedDelivery
                    ? formatDate(purchaseOrder.estimatedDelivery)
                    : '-'}
                </p>
              </div>
            </div>

            {purchaseOrder.notes && (
              <div className="text-sm">
                <p className="text-muted-foreground">Catatan</p>
                <p className="font-medium break-words">{purchaseOrder.notes}</p>
              </div>
            )}

            <div className="border-t pt-4 mt-4">
              <p className="text-sm text-muted-foreground mb-2">Ubah Status</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Select
                  value={selectedStatus}
                  onValueChange={(value) => setSelectedStatus(value as PurchaseOrderStatus | '')}
                  disabled={isSubmitting}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Pilih status" />
                  </SelectTrigger>
                  <SelectContent>
                    {['ordered', 'cancelled']
                      .filter(s => s !== purchaseOrder.status)
                      .filter(s => !(purchaseOrder.status === 'partially_received' && s === 'ordered'))
                      .map((status) => (
                      <SelectItem key={status} value={status}>
                        {status === 'ordered' ? 'Dipesan' : 
                         status === 'cancelled' ? 'Dibatalkan' : status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={updateStatus}
                  disabled={isSubmitting || selectedStatus === purchaseOrder.status}
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Informasi Supplier</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {purchaseOrder.supplier ? (
                <>
                  <div>
                    <p className="text-sm text-muted-foreground">Nama Supplier</p>
                    <p className="font-medium">{purchaseOrder.supplier.name || 'Tidak ada nama'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Nomor Telepon</p>
                    <p className="font-medium">{purchaseOrder.supplier.phone || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Alamat</p>
                    <p className="font-medium">{purchaseOrder.supplier.address || '-'}</p>
                  </div>
                  {purchaseOrder.supplier.email && (
                    <div>
                      <p className="text-sm text-muted-foreground">Email</p>
                      <p className="font-medium">{purchaseOrder.supplier.email}</p>
                    </div>
                  )}
                </>
              ) : (
                <div>
                  <p className="text-sm text-muted-foreground">Supplier</p>
                  <p className="font-medium">{purchaseOrder.supplierName || 'Tidak ada informasi supplier'}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Daftar Item</CardTitle>
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchaseOrder?.items?.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {item.productName}
                      </TableCell>
                      <TableCell className="text-right">
                        {parseFloat(item.quantity).toLocaleString()} {item.unit}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatRupiah(parseFloat(item.price))}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatRupiah(parseFloat(item.quantity) * parseFloat(item.price))}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell colSpan={3} className="text-right font-bold">
                      Total
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {formatRupiah(calculateTotal())}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>


        {(purchaseOrder.status === 'ordered' || purchaseOrder.status === 'partially_received') && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Penerimaan Barang</CardTitle>
              <CardDescription>
                Catat penerimaan barang dari supplier
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => setReceiveDialogOpen(true)}>
                <Truck className="mr-2 h-4 w-4" />
                Catat Penerimaan Barang
              </Button>
              <p className="text-sm text-muted-foreground mt-2">
                Klik tombol di atas jika barang sudah diterima lengkap. Stok produk akan bertambah otomatis.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={receiveDialogOpen} onOpenChange={setReceiveDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Penerimaan Barang</DialogTitle>
            <DialogDescription>
              Input jumlah barang yang diterima saat ini. Sisa yang belum diterima akan tetap berstatus Dipesan kecuali Anda menutup PO.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {/* Desktop Table - Hidden on Mobile */}
            <Table className="hidden md:table">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[25%]">Produk</TableHead>
                  <TableHead className="text-right w-[10%]">Sisa</TableHead>
                  <TableHead className="w-[65%]">Detail Penerimaan (Batch)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchaseOrder?.items.map((item) => {
                  const ordered = parseFloat(item.quantity);
                  const previouslyReceived = item.receivedQuantity || 0;
                  const remaining = Math.max(0, ordered - previouslyReceived);
                  const batches = receiveBatches[item.id] || [];
                  const currentTotalReceived = calculateTotalReceivedForItem(item.id);

                  if (remaining <= 0 && !closePo) return null;

                  return (
                    <TableRow key={item.id} className="align-top">
                      <TableCell className="font-medium pt-4">
                        {item.productName}
                        <div className="text-xs text-muted-foreground">{item.unit}</div>
                      </TableCell>
                      <TableCell className="text-right pt-4">{remaining}</TableCell>
                      <TableCell>
                        <div className="space-y-2">
                           {batches.map((batch, index) => (
                             <div key={index} className="flex gap-2 items-center">
                               <div className="grid grid-cols-3 gap-2 flex-1">
                                 <div>
                                   <Input
                                     placeholder="Qty"
                                     type="number"
                                     min="0"
                                     value={batch.quantity || ''}
                                     onChange={(e) => handleBatchChange(item.id, index, 'quantity', parseFloat(e.target.value))}
                                     className="h-8 text-right"
                                   />
                                   {index === 0 && <span className="text-[10px] text-muted-foreground">Jumlah</span>}
                                 </div>
                                 <div className="flex flex-col gap-1">
                                    <div className="flex gap-1">
                                        <div className="flex-1">
                                            <Input
                                                placeholder="Batch No (Opsional)"
                                                value={batch.batchNumber || ''}
                                                onChange={(e) => handleBatchChange(item.id, index, 'batchNumber', e.target.value)}
                                                className="h-8"
                                            />
                                        </div>
                                        <Button
                                            variant="ghost" 
                                            size="icon"
                                            className="h-8 w-8 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-100"
                                            title="Generate Batch Number"
                                            onClick={() => {
                                                const newBatchNo = generateBatchNumber(purchaseOrder?.supplier?.name, purchaseOrder?.supplier?.code);
                                                handleBatchChange(item.id, index, 'batchNumber', newBatchNo);
                                            }}
                                        >
                                            <Zap className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <div className="h-4">
                                        {index === 0 && <span className="text-[10px] text-muted-foreground block w-full">Batch #</span>}
                                    </div>
                                 </div>
                                 <div>
                                    <Input
                                      type="date"
                                      value={batch.expiryDate ? batch.expiryDate.split('T')[0] : ''}
                                      onChange={(e) => handleBatchChange(item.id, index, 'expiryDate', e.target.value)}
                                      className="h-8"
                                    />
                                    {index === 0 && <span className="text-[10px] text-muted-foreground">Expired</span>}
                                 </div>
                               </div>
                               <Button 
                                 variant="ghost" 
                                 size="icon" 
                                 className="h-8 w-8 text-destructive"
                                 onClick={() => removeBatchRow(item.id, index)}
                                 disabled={batches.length === 1 && index === 0}
                               >
                                 <Minus className="h-4 w-4" />
                               </Button>
                             </div>
                           ))}
                           <Button 
                             variant="outline" 
                             size="sm" 
                             className="h-7 text-xs w-full border-dashed"
                             onClick={() => addBatchRow(item.id)}
                           >
                             <Plus className="h-3 w-3 mr-1" /> Split Batch / Tambah Baris
                           </Button>
                           <div className="text-right text-xs font-medium text-muted-foreground">
                              Total Diterima: {currentTotalReceived} / {remaining}
                           </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            
            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
              {purchaseOrder?.items.map((item) => {
                const ordered = parseFloat(item.quantity);
                const previouslyReceived = item.receivedQuantity || 0;
                const remaining = Math.max(0, ordered - previouslyReceived);
                const batches = receiveBatches[item.id] || [];
                const currentTotalReceived = calculateTotalReceivedForItem(item.id);

                if (remaining <= 0 && !closePo) return null;

                return (
                  <div key={item.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium">{item.productName}</div>
                        <div className="text-xs text-muted-foreground">{item.unit}</div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Sisa: <span className="font-bold text-foreground">{remaining}</span>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      {batches.map((batch, index) => (
                        <div key={index} className="border rounded p-3 space-y-2 bg-muted/30">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium">Batch {index + 1}</span>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-6 w-6 text-destructive"
                              onClick={() => removeBatchRow(item.id, index)}
                              disabled={batches.length === 1 && index === 0}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] text-muted-foreground">Jumlah</label>
                              <Input
                                placeholder="Qty"
                                type="number"
                                min="0"
                                value={batch.quantity || ''}
                                onChange={(e) => handleBatchChange(item.id, index, 'quantity', parseFloat(e.target.value))}
                                className="h-8 text-right"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-muted-foreground">Batch #</label>
                              <div className="flex gap-1">
                                <Input
                                  placeholder="Opsional"
                                  value={batch.batchNumber || ''}
                                  onChange={(e) => handleBatchChange(item.id, index, 'batchNumber', e.target.value)}
                                  className="h-8"
                                />
                                <Button
                                  variant="ghost" 
                                  size="icon"
                                  className="h-8 w-8 text-yellow-600"
                                  onClick={() => {
                                    const newBatchNo = generateBatchNumber(purchaseOrder?.supplier?.name, purchaseOrder?.supplier?.code);
                                    handleBatchChange(item.id, index, 'batchNumber', newBatchNo);
                                  }}
                                >
                                  <Zap className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground">Tanggal Kadaluarsa</label>
                            <Input
                              type="date"
                              value={batch.expiryDate ? batch.expiryDate.split('T')[0] : ''}
                              onChange={(e) => handleBatchChange(item.id, index, 'expiryDate', e.target.value)}
                              className="h-8"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full border-dashed text-xs h-8"
                      onClick={() => addBatchRow(item.id)}
                    >
                      <Plus className="h-3 w-3 mr-1" /> Tambah Batch
                    </Button>
                    <div className="text-right text-xs font-medium">
                      Total Diterima: {currentTotalReceived} / {remaining}
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="flex items-center space-x-2 mt-6 p-4 bg-muted/50 rounded-md">
              <Checkbox
                id="closePo"
                checked={closePo}
                onCheckedChange={(checked) => setClosePo(checked as boolean)}
              />
              <div className="grid gap-1.5 leading-none">
                <label
                  htmlFor="closePo"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Tandai PO Selesai (Close PO)
                </label>
                <p className="text-sm text-muted-foreground">
                  Centang jika tidak ada lagi barang yang akan dikirim untuk PO ini.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" type="button" disabled={isSubmitting}>
                Batal
              </Button>
            </DialogClose>
            <Button
              onClick={handleReceiveGoods}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Memproses...' : 'Simpan Penerimaan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Purchase Order</DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin menghapus purchase order {purchaseOrder.poNumber}?
              Tindakan ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" type="button">
                Batal
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={deletePurchaseOrder}
            >
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 