'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  ArrowUpDown,
  Filter,
  Loader2,
  Plus,
  Search,
  FilterX,
  FileText,
  MoreHorizontal,
  Eye,
  Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import { formatRupiah, formatDate } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Define types - gunakan any terlebih dahulu untuk mengatasi masalah kompatibilitas
interface PurchaseOrderItem {
  id: string;
  productId: string;
  productName: string;
  quantity: string | number;
  unit: string;
  price: string | number;
}

interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  status: string;
  createdAt: string;
  estimatedDelivery: string | null;
  notes: string | null | undefined;
  items: PurchaseOrderItem[];
}

interface PurchaseOrdersListProps {
  purchaseOrders: any[]; // Gunakan any[] untuk mengatasi masalah kompatibilitas
  loading: boolean;
  refreshData?: () => Promise<void>;
}

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
    case 'completed': // Legacy support
      return <Badge variant="default">Diterima</Badge>;
    case 'cancelled':
      return <Badge variant="destructive">Dibatalkan</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

export default function PurchaseOrdersList({
  purchaseOrders,
  loading,
  refreshData
}: PurchaseOrdersListProps) {
  const router = useRouter();
  const [sortColumn, setSortColumn] = useState('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [poToDelete, setPoToDelete] = useState<PurchaseOrder | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Sort function
  const sortPurchaseOrders = (a: PurchaseOrder, b: PurchaseOrder) => {
    const direction = sortDirection === 'asc' ? 1 : -1;

    switch (sortColumn) {
      case 'poNumber':
        return a.poNumber.localeCompare(b.poNumber) * direction;
      case 'supplierName':
        return a.supplierName.localeCompare(b.supplierName) * direction;
      case 'status':
        return a.status.localeCompare(b.status) * direction;
      case 'createdAt':
        return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * direction;
      case 'estimatedDelivery':
        // Handle null values for estimatedDelivery
        if (!a.estimatedDelivery && !b.estimatedDelivery) return 0;
        if (!a.estimatedDelivery) return 1 * direction;
        if (!b.estimatedDelivery) return -1 * direction;
        return (new Date(a.estimatedDelivery).getTime() - new Date(b.estimatedDelivery).getTime()) * direction;
      default:
        return 0;
    }
  };

  // Toggle sort
  const toggleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  // Calculate total amount of purchase order
  const calculatePOTotal = (order: PurchaseOrder) => {
    return order.items.reduce((total, item) => {
      const quantity = typeof item.quantity === 'string' ? parseFloat(item.quantity) : item.quantity;
      const price = typeof item.price === 'string' ? parseFloat(item.price) : item.price;
      return total + (quantity * price);
    }, 0);
  };

  // View PO detail
  const viewPurchaseOrder = (poId: string) => {
    router.push(`/purchase-orders/${poId}`);
  };

  // Create new PO
  const createNewPO = () => {
    router.push('/purchase-orders/create');
  };

  // Delete PO
  const handleDeletePO = async () => {
    if (!poToDelete) return;

    setDeleting(true);

    try {
      const response = await fetch(`/api/purchase-orders/${poToDelete.id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Gagal menghapus purchase order');
      }


      // Refresh data
      if (refreshData) {
        await refreshData();
      }
    } catch (error) {
      console.error('Error deleting purchase order:', error);
      toast.error('Gagal menghapus purchase order');
    } finally {
      setDeleting(false);
      setPoToDelete(null);
    }
  };

  // Filter POs
  const allFilteredPOs = [...purchaseOrders]
    .filter(po => {
      // Filter by search term (PO number or supplier name)
      if (searchTerm &&
        !po.poNumber.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !po.supplierName.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }

      // Filter by status
      if (statusFilter !== 'all' && po.status !== statusFilter) {
        return false;
      }
      
      // Filter by date range
      if (startDate) {
          const poDate = new Date(po.createdAt);
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          if (poDate < start) return false;
      }
      
      if (endDate) {
          const poDate = new Date(po.createdAt);
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          if (poDate > end) return false;
      }

      return true;
    })
    .sort(sortPurchaseOrders);

  // Pagination Logic
  const totalPages = Math.ceil(allFilteredPOs.length / itemsPerPage);
  const paginatedPOs = allFilteredPOs.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>Purchase Orders</CardTitle>
            <CardDescription>
              Daftar pesanan pembelian untuk supplier
            </CardDescription>
          </div>
          <Button onClick={createNewPO}>
            <Plus className="h-4 w-4 mr-2" />
            Buat PO Baru
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari PO atau supplier..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowFilters(!showFilters)}
              className={showFilters ? 'bg-secondary' : ''}
            >
              <Filter className="h-4 w-4" />
            </Button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <Label className="text-xs mb-1 block">Status</Label>
                <Select
                  value={statusFilter}
                  onValueChange={setStatusFilter}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Filter status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Status</SelectItem>
                    <SelectItem value="ordered">Dipesan</SelectItem>
                    <SelectItem value="partially_received">Diterima Sebagian</SelectItem>
                    <SelectItem value="received">Diterima</SelectItem>
                    <SelectItem value="cancelled">Dibatalkan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs mb-1 block">Dari Tanggal</Label>
                <Input 
                   type="date" 
                   value={startDate}
                   onChange={(e) => setStartDate(e.target.value)}
                   className="w-full"
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Sampai Tanggal</Label>
                <Input 
                   type="date" 
                   value={endDate}
                   onChange={(e) => setEndDate(e.target.value)}
                   className="w-full"
                />
              </div>
              <div className="flex items-end justify-end">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSearchTerm('');
                    setStatusFilter('all');
                    setStartDate('');
                    setEndDate('');
                    setCurrentPage(1);
                  }}
                  className="w-full md:w-auto"
                >
                  <FilterX className="h-4 w-4 mr-2" />
                  Reset Filter
                </Button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="h-24 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="rounded-md border hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                     <TableHead className="w-[50px]">#</TableHead>
                    <TableHead
                      className="cursor-pointer w-[120px]"
                      onClick={() => toggleSort('poNumber')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Nomor PO</span>
                        {sortColumn === 'poNumber' && (
                          <ArrowUpDown className={`h-4 w-4 ${sortDirection === 'desc' ? 'rotate-180' : ''} transition-transform`} />
                        )}
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer"
                      onClick={() => toggleSort('supplierName')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Supplier</span>
                        {sortColumn === 'supplierName' && (
                          <ArrowUpDown className={`h-4 w-4 ${sortDirection === 'desc' ? 'rotate-180' : ''} transition-transform`} />
                        )}
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer"
                      onClick={() => toggleSort('status')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Status</span>
                        {sortColumn === 'status' && (
                          <ArrowUpDown className={`h-4 w-4 ${sortDirection === 'desc' ? 'rotate-180' : ''} transition-transform`} />
                        )}
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer"
                      onClick={() => toggleSort('createdAt')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Tanggal Dibuat</span>
                        {sortColumn === 'createdAt' && (
                          <ArrowUpDown className={`h-4 w-4 ${sortDirection === 'desc' ? 'rotate-180' : ''} transition-transform`} />
                        )}
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer"
                      onClick={() => toggleSort('estimatedDelivery')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Estimasi Pengiriman</span>
                        {sortColumn === 'estimatedDelivery' && (
                          <ArrowUpDown className={`h-4 w-4 ${sortDirection === 'desc' ? 'rotate-180' : ''} transition-transform`} />
                        )}
                      </div>
                    </TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="w-[70px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedPOs.length > 0 ? (
                    paginatedPOs.map((po, idx) => (
                      <TableRow key={po.id}>
                        <TableCell className="text-xs text-muted-foreground">
                            {(currentPage - 1) * itemsPerPage + idx + 1}
                        </TableCell>
                        <TableCell className="font-medium">
                          {po.poNumber}
                        </TableCell>
                        <TableCell>{po.supplierName}</TableCell>
                        <TableCell>{getStatusBadge(po.status)}</TableCell>
                        <TableCell>{formatDate(po.createdAt)}</TableCell>
                        <TableCell>
                          {po.estimatedDelivery ? formatDate(po.estimatedDelivery) : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatRupiah(calculatePOTotal(po))}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <span className="sr-only">Buka menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Aksi</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => viewPurchaseOrder(po.id)}>
                                <Eye className="h-4 w-4 mr-2" />
                                Lihat Detail
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => setPoToDelete(po)} className="text-destructive">
                                <Trash2 className="h-4 w-4 mr-2" />
                                Hapus
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="h-24 text-center">
                        {searchTerm || statusFilter || startDate || endDate ? (
                          <div className="flex flex-col items-center justify-center space-y-1">
                            <Search className="h-5 w-5 text-muted-foreground" />
                            <div className="text-sm text-muted-foreground">
                              Tidak ada purchase order ditemukan
                            </div>
                            <Button
                              variant="link"
                              className="text-xs"
                              onClick={() => {
                                setSearchTerm('');
                                setStatusFilter('all');
                                setStartDate('');
                                setEndDate('');
                              }}
                            >
                              Reset pencarian
                            </Button>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center space-y-1">
                            <FileText className="h-5 w-5 text-muted-foreground" />
                            <div className="text-sm text-muted-foreground">
                              Belum ada purchase order
                            </div>
                            <Button
                              variant="link"
                              className="text-xs"
                              onClick={createNewPO}
                            >
                              Buat PO Baru
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {!loading && (
            <div className="grid grid-cols-1 gap-3 sm:hidden">
              {paginatedPOs.length > 0 ? (
                paginatedPOs.map((po) => (
                  <div key={po.id} className="border rounded-lg p-3">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <h3 className="font-medium">{po.poNumber}</h3>
                        <p className="text-xs text-muted-foreground">{po.supplierName}</p>
                      </div>
                      <div className="ml-2">
                        {getStatusBadge(po.status)}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-1 text-xs mb-2">
                      <div>
                        <span className="text-muted-foreground">Tanggal:</span>
                        <span className="ml-1 font-medium">{formatDate(po.createdAt)}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-muted-foreground">Pengiriman:</span>
                        <span className="ml-1 font-medium">
                          {po.estimatedDelivery ? formatDate(po.estimatedDelivery) : '-'}
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center mt-2">
                      <div>
                        <span className="text-muted-foreground text-xs">Total:</span>
                        <span className="ml-1 font-bold">
                          {formatRupiah(calculatePOTotal(po))}
                        </span>
                      </div>
                      <div className="flex">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => viewPurchaseOrder(po.id)}
                        >
                          <Eye className="h-4 w-4" />
                          <span className="sr-only">Lihat detail</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive"
                          onClick={() => setPoToDelete(po)}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Hapus</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center p-8 border rounded-lg">
                  {searchTerm || statusFilter || startDate || endDate ? (
                    <div className="flex flex-col items-center justify-center space-y-1">
                      <Search className="h-5 w-5 text-muted-foreground" />
                      <div className="text-sm text-muted-foreground">
                        Tidak ada purchase order ditemukan
                      </div>
                      <Button
                        variant="link"
                        className="text-xs"
                        onClick={() => {
                          setSearchTerm('');
                          setStatusFilter('');
                          setStartDate('');
                          setEndDate('');
                        }}
                      >
                        Reset pencarian
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center space-y-1">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <div className="text-sm text-muted-foreground">
                        Belum ada purchase order
                      </div>
                      <Button
                        variant="link"
                        className="text-xs"
                        onClick={createNewPO}
                      >
                        Buat PO Baru
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          
          {/* Pagination Controls */}
          {!loading && totalPages > 1 && (
              <div className="flex items-center justify-between border-t pt-4">
                  <div className="text-sm text-muted-foreground">
                      Halaman {currentPage} dari {totalPages} ({allFilteredPOs.length} item)
                  </div>
                  <div className="flex gap-2">
                      <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          disabled={currentPage === 1}
                      >
                          Sebelumnya
                      </Button>
                      <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                          disabled={currentPage === totalPages}
                      >
                          Selanjutnya
                      </Button>
                  </div>
              </div>
          )}
        </div>
      </CardContent>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!poToDelete} onOpenChange={(open) => !open && setPoToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Purchase Order</DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin menghapus purchase order {poToDelete?.poNumber}?
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
              onClick={handleDeletePO}
              disabled={deleting}
            >
              {deleting ? 'Menghapus...' : 'Hapus'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
} 