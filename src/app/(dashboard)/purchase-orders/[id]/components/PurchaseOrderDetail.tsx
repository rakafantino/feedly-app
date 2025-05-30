'use client';

import React from 'react';
import { useState, useEffect, useCallback } from 'react';
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
import { ArrowLeft, Printer, TrashIcon, Truck } from 'lucide-react';

interface Supplier {
  id: string;
  name: string;
  phone: string;
  address: string;
  email?: string;
}

interface PurchaseOrderItem {
  id: string;
  productId: string;
  productName: string;
  quantity: string;
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

// Definisikan PurchaseOrderStatus type
type PurchaseOrderStatus = 'draft' | 'sent' | 'processing' | 'partially_received' | 'received' | 'cancelled';

// Helper function to get status badge
const getStatusBadge = (status: string) => {
  switch (status) {
    case 'draft':
      return <Badge variant="outline">Draft</Badge>;
    case 'sent':
      return <Badge variant="secondary">Terkirim</Badge>;
    case 'processing':
      return <Badge variant="default">Diproses</Badge>;
    case 'partially_received':
      return <Badge variant="secondary">Diterima Sebagian</Badge>;
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
  const [selectedStatus, setSelectedStatus] = useState<PurchaseOrderStatus | ''>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

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
      router.push('/low-stock');  
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
        <Button onClick={() => router.push('/purchase-orders')}>
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
            onClick={() => router.back()}
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
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="sent">Terkirim</SelectItem>
                    <SelectItem value="processing">Diproses</SelectItem>
                    <SelectItem value="partially_received">Diterima Sebagian</SelectItem>
                    <SelectItem value="received">Diterima</SelectItem>
                    <SelectItem value="cancelled">Dibatalkan</SelectItem>
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


        {(purchaseOrder.status === 'sent' || purchaseOrder.status === 'processing') && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Penerimaan Barang</CardTitle>
              <CardDescription>
                Catat penerimaan barang dari supplier
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button>
                <Truck className="mr-2 h-4 w-4" />
                Catat Penerimaan Barang
              </Button>
              <p className="text-sm text-muted-foreground mt-2">
                Fitur ini akan segera tersedia pada pembaruan berikutnya.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

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