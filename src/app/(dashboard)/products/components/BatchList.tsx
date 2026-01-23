import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProductBatch } from "@/types/product";
import { format as formatDate } from "date-fns";
import { formatRupiah } from "@/lib/utils";

interface BatchListProps {
  batches: ProductBatch[];
}

export function BatchList({ batches }: BatchListProps) {
  if (!batches || batches.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium border-b pb-2">Daftar Batch Aktif</h3>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>No. Batch</TableHead>
              <TableHead>Stok</TableHead>
              <TableHead>Kadaluarsa</TableHead>
              <TableHead>Harga Beli</TableHead>
              <TableHead>Tgl Masuk</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {batches.map((batch) => {
              const expiryDate = batch.expiryDate ? new Date(batch.expiryDate as string) : null;
              const isExpired = expiryDate && expiryDate < new Date();
              const isNearExpiry = expiryDate && 
                expiryDate > new Date() && 
                expiryDate.getTime() - new Date().getTime() < 30 * 24 * 60 * 60 * 1000; // 30 days

              return (
                <TableRow key={batch.id}>
                  <TableCell className="font-medium">{batch.batchNumber || "-"}</TableCell>
                  <TableCell>{batch.stock}</TableCell>
                  <TableCell>
                    {expiryDate ? (
                      formatDate(expiryDate, "dd MMM yyyy")
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>{batch.purchasePrice ? formatRupiah(batch.purchasePrice) : "-"}</TableCell>
                  <TableCell>{formatDate(new Date(batch.inDate), "dd MMM yyyy")}</TableCell>
                  <TableCell>
                    {isExpired ? (
                      <Badge variant="destructive">Kadaluarsa</Badge>
                    ) : isNearExpiry ? (
                      <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
                        Hampir Exp
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        Baik
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
