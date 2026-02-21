import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { ProductBatch } from "@/types/product";
import { format as formatDate } from "date-fns";
import { formatRupiah } from "@/lib/utils";
import { Pencil, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface BatchListProps {
  batches: ProductBatch[];
  onUpdate?: () => void;
}

export function BatchList({ batches, onUpdate }: BatchListProps) {
  const [editingBatch, setEditingBatch] = useState<ProductBatch | null>(null);
  const [formData, setFormData] = useState({
    batchNumber: "",
    expiryDate: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
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
              <TableHead className="text-right">Aksi</TableHead>
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
                  <TableCell className="text-right">
                    <Button 
                      type="button"
                      variant="ghost" 
                      size="icon" 
                      onClick={() => {
                        setEditingBatch(batch);
                        setFormData({
                          batchNumber: batch.batchNumber || "",
                          expiryDate: batch.expiryDate ? new Date(batch.expiryDate).toISOString().split('T')[0] : "",
                        });
                      }}
                      title="Edit Detail Batch"
                    >
                      <Pencil className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editingBatch} onOpenChange={(open) => !open && setEditingBatch(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Batch</DialogTitle>
            <DialogDescription>
              Ubah detail spesifik untuk batch ini.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit_batch_number">Nomor Batch</Label>
              <Input 
                id="edit_batch_number"
                value={formData.batchNumber} 
                onChange={(e) => setFormData(prev => ({ ...prev, batchNumber: e.target.value }))}
                placeholder="Misal: BATCH-001"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_expiry_date">Tanggal Kadaluarsa</Label>
              <Input 
                id="edit_expiry_date"
                type="date"
                value={formData.expiryDate} 
                onChange={(e) => setFormData(prev => ({ ...prev, expiryDate: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditingBatch(null)} disabled={isSubmitting}>
              Batal
            </Button>
            <Button 
              type="button"
              onClick={async () => {
                if (!editingBatch) return;
                setIsSubmitting(true);
                try {
                  const res = await fetch(`/api/batches/${editingBatch.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                  });
                  
                  if (!res.ok) throw new Error("Gagal memperbarui batch");
                  
                  toast.success("Batch berhasil diperbarui");
                  setEditingBatch(null);
                  if (onUpdate) onUpdate();
                } catch (error) {
                  console.error(error);
                  toast.error("Terjadi kesalahan saat memperbarui batch");
                } finally {
                  setIsSubmitting(false);
                }
              }} 
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                "Simpan Perubahan"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
