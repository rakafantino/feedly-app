'use client';

import { useEffect, useState, Fragment } from 'react';
import { formatRupiah } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

import { ChevronDown, ChevronRight, Eye, Search, Wallet } from 'lucide-react';
import { PageSkeleton } from "@/components/skeleton";
import { toast } from 'sonner';

interface DebtItem {
  id: string; // PO ID
  poNumber: string;
  date: string;
  dueDate: string | null;
  supplierId: string;
  supplierName: string;
  contactInfo: string;
  totalAmount: number;
  amountPaid: number;
  remainingAmount: number;
  paymentStatus: string;
  status: string;
}

interface SupplierGroup {
  supplierId: string;
  supplierName: string;
  contactInfo: string;
  totalDebt: number;
  totalPaid: number;
  totalAmount: number;
  poCount: number;
  items: DebtItem[];
}

export default function SupplierDebtReportPage() {
  const [data, setData] = useState<DebtItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [totalOutstanding, setTotalOutstanding] = useState(0);
  const [expandedSuppliers, setExpandedSuppliers] = useState<Set<string>>(new Set());

  const fetchReport = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/reports/supplier-debt');
      if (!res.ok) throw new Error('Gagal mengambil laporan');
      const json = await res.json();
      setData(json || []);
      
      const total = json.reduce((acc: number, curr: DebtItem) => acc + curr.remainingAmount, 0);
      setTotalOutstanding(total);
    } catch (error) {
      console.error(error);
      toast.error('Gagal memuat laporan hutang supplier');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  const toggleExpand = (supplierId: string) => {
    const newExpanded = new Set(expandedSuppliers);
    if (newExpanded.has(supplierId)) {
      newExpanded.delete(supplierId);
    } else {
      newExpanded.add(supplierId);
    }
    setExpandedSuppliers(newExpanded);
  };

  // Group data by supplier
  const groupedData: SupplierGroup[] = data.reduce((acc: SupplierGroup[], item) => {
    const existingGroup = acc.find(g => g.supplierId === item.supplierId);
    if (existingGroup) {
      existingGroup.totalDebt += item.remainingAmount;
      existingGroup.totalPaid += item.amountPaid;
      existingGroup.totalAmount += item.totalAmount;
      existingGroup.poCount += 1;
      existingGroup.items.push(item);
    } else {
      acc.push({
        supplierId: item.supplierId,
        supplierName: item.supplierName,
        contactInfo: item.contactInfo,
        totalDebt: item.remainingAmount,
        totalPaid: item.amountPaid,
        totalAmount: item.totalAmount,
        poCount: 1,
        items: [item]
      });
    }
    return acc;
  }, []);

  const filteredGroups = groupedData.filter(group => {
    const searchLower = searchQuery.toLowerCase();
    return (
      group.supplierName.toLowerCase().includes(searchLower) ||
      group.items.some(item => item.poNumber.toLowerCase().includes(searchLower))
    );
  });

  return (
    <div className="space-y-6 container mx-auto p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Laporan Hutang Supplier</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Hutang Belum Lunas</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatRupiah(totalOutstanding)}</div>
            <p className="text-xs text-muted-foreground">{groupedData.length} Supplier, {data.length} PO Belum Lunas</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Cari supplier atau No. PO..." 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
            className="pl-8" 
          />
        </div>
      </div>

      {isLoading ? (
        <PageSkeleton />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]"></TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead className="text-right">Total Tagihan</TableHead>
                  <TableHead className="text-right">Sudah Dibayar</TableHead>
                  <TableHead className="text-right">Sisa Hutang</TableHead>
                  <TableHead className="text-center">Jumlah PO</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredGroups.length > 0 ? (
                  filteredGroups.map((group) => (
                    <Fragment key={group.supplierId}>
                      <TableRow 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => toggleExpand(group.supplierId)}
                      >
                        <TableCell>
                          {expandedSuppliers.has(group.supplierId) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                             <span className="font-medium">{group.supplierName}</span>
                             <span className="text-xs text-muted-foreground">{group.contactInfo}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">{formatRupiah(group.totalAmount)}</TableCell>
                        <TableCell className="text-right text-green-600">{formatRupiah(group.totalPaid)}</TableCell>
                        <TableCell className="text-right text-red-600 font-bold">{formatRupiah(group.totalDebt)}</TableCell>
                        <TableCell className="text-center">{group.poCount}</TableCell>
                      </TableRow>
                      
                      {expandedSuppliers.has(group.supplierId) && (
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableCell colSpan={6} className="p-0">
                            <div className="px-4 py-2">
                              <Table>
                                <TableHeader>
                                  <TableRow className="border-b-0">
                                    <TableHead className="text-xs">No. PO</TableHead>
                                    <TableHead className="text-xs">Tgl. Jatuh Tempo</TableHead>
                                    <TableHead className="text-right text-xs">Total</TableHead>
                                    <TableHead className="text-right text-xs">Sisa</TableHead>
                                    <TableHead className="text-center text-xs">Status</TableHead>
                                    <TableHead className="text-right text-xs">Aksi</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {group.items.map((item) => (
                                    <TableRow key={item.id} className="border-0">
                                      <TableCell className="py-2 text-sm font-medium">{item.poNumber}</TableCell>
                                      <TableCell className="py-2 text-sm">
                                        {item.dueDate ? new Date(item.dueDate).toLocaleDateString('id-ID') : '-'}
                                      </TableCell>
                                      <TableCell className="py-2 text-right text-sm">{formatRupiah(item.totalAmount)}</TableCell>
                                      <TableCell className="py-2 text-right text-sm font-bold text-red-600">{formatRupiah(item.remainingAmount)}</TableCell>
                                      <TableCell className="py-2 text-center">
                                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                          item.paymentStatus === 'PARTIAL' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                                        }`}>
                                          {item.paymentStatus}
                                        </span>
                                      </TableCell>
                                      <TableCell className="py-2 text-right">
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-8 w-8"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              window.location.href = `/purchase-orders/${item.id}`;
                                            }}
                                        >
                                          <Eye className="w-4 h-4" />
                                        </Button>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      Tidak ada data hutang supplier.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
