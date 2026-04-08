"use client";

import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatRupiah, formatDate } from "@/lib/utils";
import { ChevronRight, Package, AlertCircle } from "lucide-react";

interface PurchaseReturn {
  id: string;
  purchaseOrderId: string;
  totalAmount: number;
  reason: string | null;
  notes: string | null;
  createdAt: string;
  items: Array<{
    id: string;
    productId: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    product: {
      id: string;
      name: string;
      unit: string;
    };
  }>;
  purchaseOrder: {
    id: string;
    poNumber: string;
  };
  supplier: {
    id: string;
    name: string;
  };
}

interface PurchaseReturnListProps {
  returns: PurchaseReturn[];
  isLoading?: boolean;
}

export function PurchaseReturnList({ returns, isLoading }: PurchaseReturnListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="border rounded-lg p-4 animate-pulse">
            <div className="h-16 bg-muted rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (returns.length === 0) {
    return (
      <div className="text-center py-12 border rounded-lg bg-muted/20">
        <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
        <p className="text-muted-foreground">Belum ada data retur pembelian.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {returns.map((retur) => (
        <div key={retur.id} className="border rounded-lg overflow-hidden">
          <div
            className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => toggleExpand(retur.id)}
          >
            <div className="flex items-center gap-3">
              <ChevronRight
                className={`w-4 h-4 transition-transform ${expandedId === retur.id ? "rotate-90" : ""}`}
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{formatRupiah(retur.totalAmount)}</span>
                  {retur.reason && (
                    <Badge variant="outline" className="text-xs">
                      {retur.reason}
                    </Badge>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  {formatDate(retur.createdAt)} • {retur.purchaseOrder.poNumber} • {retur.supplier.name}
                </div>
                {retur.notes && <div className="text-xs text-muted-foreground mt-1">{retur.notes}</div>}
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              {retur.items.length} item{retur.items.length !== 1 ? "s" : ""}
            </div>
          </div>

          {expandedId === retur.id && (
            <div className="border-t bg-muted/30 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Package className="w-4 h-4 text-muted-foreground" />
                <p className="text-xs font-medium text-muted-foreground">Rincian Item Retur:</p>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Produk</TableHead>
                    <TableHead className="text-right text-xs">Qty</TableHead>
                    <TableHead className="text-right text-xs">Harga Unit</TableHead>
                    <TableHead className="text-right text-xs">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {retur.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-sm">
                        <div className="font-medium">{item.product.name}</div>
                        <div className="text-xs text-muted-foreground">{item.product.unit}</div>
                      </TableCell>
                      <TableCell className="text-right text-sm">{item.quantity}</TableCell>
                      <TableCell className="text-right text-sm text-red-600">{formatRupiah(item.unitPrice)}</TableCell>
                      <TableCell className="text-right text-sm font-medium text-red-600">
                        {formatRupiah(item.totalPrice)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2">
                    <TableCell colSpan={3} className="font-bold">
                      TOTAL RETUR
                    </TableCell>
                    <TableCell className="text-right font-bold text-red-600">{formatRupiah(retur.totalAmount)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
