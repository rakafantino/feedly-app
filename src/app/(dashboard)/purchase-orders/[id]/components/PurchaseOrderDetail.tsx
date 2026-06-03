"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { formatRupiah, formatDate, formatQuantity } from "@/lib/utils";
import { ArrowLeft, Printer, TrashIcon, Truck, Plus, Minus, Zap, Wallet, RotateCcw, Edit, AlertCircle, CheckCircle2, Circle, Package } from "lucide-react";
import { PageSkeleton } from "@/components/skeleton";
import { PurchaseReturnDialog } from "./PurchaseReturnDialog";
import { Supplier } from "@/types/index";
import { generateBatchNumber } from "@/lib/batch-utils";

interface PurchaseOrderItem {
  id: string;
  productId: string;
  productName: string;
  quantity: string;
  receivedQuantity?: number;
  unit: string;
  price: string;
}

interface PurchaseOrderPayment {
  id: string;
  amount: number;
  paymentMethod: string;
  notes: string | null;
  paidAt: string;
  remainingDebtBefore?: number;
  remainingDebtAfter?: number;
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
  paymentStatus?: string;
  amountPaid?: number;
  remainingAmount?: number;
  totalAmount?: number;
  dueDate?: string | null;
  payments?: PurchaseOrderPayment[];
}

// New interface for Batch Entry
interface BatchEntry {
  quantity: number;
  expiryDate?: string;
  batchNumber?: string;
}

// Definisikan PurchaseOrderStatus type
type PurchaseOrderStatus = "draft" | "ordered" | "received" | "partially_received" | "cancelled";

// Helper function to get status badge
const getStatusBadge = (status: string) => {
  switch (status) {
    case "draft":
      return <Badge variant="outline">Draft</Badge>;
    case "ordered":
    case "sent": // Legacy support
    case "processing": // Legacy support
      return <Badge variant="secondary">Dipesan</Badge>;
    case "partially_received":
      return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Diterima Sebagian</Badge>;
    case "received":
      return <Badge variant="default">Diterima</Badge>;
    case "cancelled":
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
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);

  // NEW STATE: Keyed by Item ID -> Array of Batch Entries
  const [receiveBatches, setReceiveBatches] = useState<Record<string, BatchEntry[]>>({});

  const [closePo, setClosePo] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<PurchaseOrderStatus | "">("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  // New State for Retroactive Price Editing
  const [isEditingPrices, setIsEditingPrices] = useState(false);
  const [editedPrices, setEditedPrices] = useState<Record<string, string>>({});

  const router = useRouter();
  const queryClient = useQueryClient();

  // Reset form when dialog opens
  useEffect(() => {
    if (receiveDialogOpen && purchaseOrder) {
      const initialBatches: Record<string, BatchEntry[]> = {};

      purchaseOrder.items.forEach((item) => {
        const remaining = parseFloat(item.quantity) - (item.receivedQuantity || 0);
        if (remaining > 0) {
          // Start with one empty batch row. The user only types a value for
          // items that have actually arrived; empty/0 means "not received yet".
          initialBatches[item.id] = [{ quantity: 0, batchNumber: "", expiryDate: "" }];
        } else {
          initialBatches[item.id] = [];
        }
      });
      setReceiveBatches(initialBatches);
      setClosePo(false);
    }
  }, [receiveDialogOpen, purchaseOrder]);

  // New Payment State
  const [payDebtDialogOpen, setPayDebtDialogOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [paymentNotes, setPaymentNotes] = useState("");

  const handlePayDebt = async () => {
    if (!purchaseOrder) return;
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/purchase-orders/${id}/pay`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: paymentAmount,
          paymentMethod: paymentMethod,
          notes: paymentNotes,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Gagal mencatat pembayaran");
      }

      const data = await response.json();
      toast.success("Pembayaran berhasil dicatat");
      setPayDebtDialogOpen(false);

      // Update local state
      if (data.purchaseOrder) {
        setPurchaseOrder((prev) =>
          prev
            ? {
                ...prev,
                paymentStatus: data.purchaseOrder.paymentStatus,
                amountPaid: data.purchaseOrder.amountPaid,
                remainingAmount: data.purchaseOrder.remainingAmount,
                updatedAt: data.purchaseOrder.updatedAt, // ensure this exists in interface if used, currently string so might need adapt
              }
            : null,
        );
        // Ideally refetch to be safe with types
        fetchPurchaseOrder();
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (payDebtDialogOpen && purchaseOrder) {
      setPaymentAmount(purchaseOrder.remainingAmount || 0);
      setPaymentNotes("");
    }
  }, [payDebtDialogOpen, purchaseOrder]);

  const handleBatchChange = (itemId: string, index: number, field: keyof BatchEntry, value: any) => {
    setReceiveBatches((prev) => {
      const currentBatches = [...(prev[itemId] || [])];
      currentBatches[index] = { ...currentBatches[index], [field]: value };
      return { ...prev, [itemId]: currentBatches };
    });
  };

  const addBatchRow = (itemId: string) => {
    setReceiveBatches((prev) => ({
      ...prev,
      [itemId]: [...(prev[itemId] || []), { quantity: 0, batchNumber: "", expiryDate: "" }],
    }));
  };

  const removeBatchRow = (itemId: string, index: number) => {
    setReceiveBatches((prev) => {
      const currentBatches = [...(prev[itemId] || [])];
      currentBatches.splice(index, 1);
      return { ...prev, [itemId]: currentBatches };
    });
  };

  const calculateTotalReceivedForItem = (itemId: string) => {
    const batches = receiveBatches[itemId] || [];
    return batches.reduce((sum, b) => sum + (b.quantity || 0), 0);
  };

  // UI/UX: derive the visual status of a single item based on what is currently
  // typed by the user. The business logic on the server is unchanged — this
  // only powers the badge and progress bar inside the dialog.
  const getItemStatus = (item: PurchaseOrderItem): "complete" | "partial" | "pending" => {
    const ordered = parseFloat(item.quantity);
    const previouslyReceived = item.receivedQuantity || 0;
    const remaining = ordered - previouslyReceived;
    const currentTotal = calculateTotalReceivedForItem(item.id);
    const newTotal = previouslyReceived + currentTotal;

    if (remaining <= 0) return "complete";
    if (newTotal >= ordered) return "complete";
    if (newTotal > 0) return "partial";
    return "pending";
  };

  // UI/UX: how many items will be fully received after this submission.
  const getProgress = () => {
    if (!purchaseOrder) return { completed: 0, total: 0, percent: 0 };
    const total = purchaseOrder.items.length;
    const completed = purchaseOrder.items.filter((i) => getItemStatus(i) === "complete").length;
    return { completed, total, percent: total === 0 ? 0 : Math.round((completed / total) * 100) };
  };

  // UI/UX: detect if any item has a typed qty that exceeds the remaining.
  // We only surface a warning — the server still has the final say.
  const getValidationIssues = (): { itemId: string; overBy: number }[] => {
    if (!purchaseOrder) return [];
    const issues: { itemId: string; overBy: number }[] = [];
    for (const item of purchaseOrder.items) {
      const remaining = parseFloat(item.quantity) - (item.receivedQuantity || 0);
      const current = calculateTotalReceivedForItem(item.id);
      if (current > remaining) {
        issues.push({ itemId: item.id, overBy: current - remaining });
      }
    }
    return issues;
  };

  // UI/UX: quick action — fill every remaining item with its full remaining qty.
  const handleReceiveAll = () => {
    if (!purchaseOrder) return;
    const newBatches: Record<string, BatchEntry[]> = {};
    purchaseOrder.items.forEach((item) => {
      const remaining = parseFloat(item.quantity) - (item.receivedQuantity || 0);
      if (remaining > 0) {
        newBatches[item.id] = [{ quantity: remaining, batchNumber: "", expiryDate: "" }];
      } else {
        newBatches[item.id] = [];
      }
    });
    setReceiveBatches(newBatches);
  };

  // UI/UX: quick action — clear all batch rows back to empty (everything pending).
  const handleResetAll = () => {
    if (!purchaseOrder) return;
    const newBatches: Record<string, BatchEntry[]> = {};
    purchaseOrder.items.forEach((item) => {
      const remaining = parseFloat(item.quantity) - (item.receivedQuantity || 0);
      newBatches[item.id] = remaining > 0 ? [{ quantity: 0, batchNumber: "", expiryDate: "" }] : [];
    });
    setReceiveBatches(newBatches);
    setClosePo(false);
  };

  // UI/UX: per-item skip — collapse that item to a single empty batch row.
  const handleSkipItem = (itemId: string) => {
    setReceiveBatches((prev) => ({
      ...prev,
      [itemId]: [{ quantity: 0, batchNumber: "", expiryDate: "" }],
    }));
  };

  const handleReceiveGoods = async () => {
    setIsSubmitting(true);
    try {
      // Construct payload items with non-zero received quantities
      const itemsToReceive = purchaseOrder?.items
        .map((item) => {
          const batches = receiveBatches[item.id] || [];
          const validBatches = batches.filter((b) => b.quantity > 0);
          const totalReceived = validBatches.reduce((sum, b) => sum + b.quantity, 0);

          return {
            id: item.id,
            receivedQuantity: totalReceived,
            batches: validBatches, // Send detailed batch info
          };
        })
        .filter((i) => i.receivedQuantity > 0 || closePo);

      if (!itemsToReceive || (itemsToReceive.length === 0 && !closePo)) {
        toast.error("Masukkan jumlah yang diterima atau tandai PO selesai");
        setIsSubmitting(false);
        return;
      }

      const response = await fetch(`/api/purchase-orders/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: itemsToReceive,
          closePo: closePo,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Gagal mencatat penerimaan barang");
      }

      const data = await response.json();

      if (data.purchaseOrder) {
        const updatedPO = {
          ...data.purchaseOrder,
          items: data.purchaseOrder.items || purchaseOrder?.items || [],
        };
        setPurchaseOrder(updatedPO);
        toast.success("Penerimaan barang berhasil dicatat");
        setReceiveDialogOpen(false);

        // Invalidate queries to update stock and list views immediately
        await Promise.all([queryClient.invalidateQueries({ queryKey: ["purchase-orders"] }), queryClient.invalidateQueries({ queryKey: ["products"] }), queryClient.invalidateQueries({ queryKey: ["stock-analytics"] })]);

        // Tetap di halaman untuk melihat status terbaru
      } else {
        fetchPurchaseOrder();
        setReceiveDialogOpen(false);
      }
    } catch (error: any) {
      console.error("Error receiving goods:", error);
      toast.error(error.message || "Gagal mencatat penerimaan barang");
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

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get("action") === "return" && purchaseOrder && !loading) {
      setReturnDialogOpen(true);
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete("action");
      window.history.replaceState({}, "", newUrl.toString());
    }
  }, [purchaseOrder, loading]);

  // Calculate total PO value
  const calculateTotal = () => {
    if (!purchaseOrder) return 0;
    return purchaseOrder.items.reduce((total, item) => {
      return total + parseFloat(item.quantity) * parseFloat(item.price);
    }, 0);
  };

  // Update PO status
  const updateStatus = async () => {
    if (!purchaseOrder || selectedStatus === purchaseOrder.status) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/purchase-orders/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: selectedStatus,
        }),
      });

      if (!response.ok) {
        throw new Error("Gagal mengubah status Purchase Order");
      }

      const data = await response.json();
      console.log("Data response update status:", data);

      // Pastikan data.purchaseOrder ada dan lengkap
      if (data.purchaseOrder) {
        // Jika items tidak ada di response, gunakan items dari state saat ini
        const updatedPO = {
          ...data.purchaseOrder,
          items: data.purchaseOrder.items || purchaseOrder.items || [],
        };
        setPurchaseOrder(updatedPO);
        toast.success("Status Purchase Order berhasil diperbarui");

        // Invalidate queries
        queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
        queryClient.invalidateQueries({ queryKey: ["stock-analytics"] });
      } else {
        toast.warning("Status diperbarui, tapi data tidak lengkap");
        // Refresh data untuk mendapatkan data lengkap
        fetchPurchaseOrder();
      }
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Gagal mengubah status Purchase Order");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete purchase order
  const deletePurchaseOrder = async () => {
    try {
      const response = await fetch(`/api/purchase-orders/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Gagal menghapus Purchase Order");
      }

      toast.success("Purchase Order berhasil dihapus");

      // Invalidate queries to update lists
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["purchase-orders"] }), queryClient.invalidateQueries({ queryKey: ["stock-analytics"] })]);

      router.back();
    } catch (error) {
      console.error("Error deleting purchase order:", error);
      toast.error("Gagal menghapus Purchase Order");
    } finally {
      setDeleteDialogOpen(false);
    }
  };

  // Save retroactive price edits
  const handleSavePrices = async () => {
    if (!purchaseOrder) return;
    setIsSubmitting(true);

    try {
      const itemsToUpdate = purchaseOrder.items
        .filter((item) => editedPrices[item.id] !== undefined && parseFloat(editedPrices[item.id]) !== parseFloat(item.price))
        .map((item) => ({
          id: item.id,
          price: parseFloat(editedPrices[item.id]),
        }));

      if (itemsToUpdate.length === 0) {
        setIsEditingPrices(false);
        setIsSubmitting(false);
        return;
      }

      const response = await fetch(`/api/purchase-orders/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_prices",
          items: itemsToUpdate,
        }),
      });

      if (!response.ok) {
        throw new Error("Gagal menyimpan koreksi harga");
      }

      toast.success("Koreksi harga berhasil disimpan");
      setIsEditingPrices(false);
      setEditedPrices({});

      // Refresh data
      fetchPurchaseOrder();
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["stock-analytics"] });
    } catch (error) {
      console.error("Error saving prices:", error);
      toast.error("Gagal menyimpan koreksi harga");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePriceChange = (itemId: string, value: string) => {
    setEditedPrices((prev) => ({
      ...prev,
      [itemId]: value,
    }));
  };

  const toggleEditPrices = () => {
    if (!isEditingPrices && purchaseOrder) {
      // Initialize editedPrices with current prices
      const initialPrices: Record<string, string> = {};
      purchaseOrder.items.forEach((item) => {
        initialPrices[item.id] = item.price.toString();
      });
      setEditedPrices(initialPrices);
    }
    setIsEditingPrices(!isEditingPrices);
  };

  if (loading) return <PageSkeleton />;

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
        <Button onClick={() => router.back()}>Kembali</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">PO: {purchaseOrder.poNumber}</h1>
        </div>
        <div className="flex space-x-2 self-end sm:self-auto">
          {["draft", "ordered", "partially_received", "received"].includes(purchaseOrder.status) && (
            <Button variant="outline" size="sm" onClick={() => router.push(`/purchase-orders/${purchaseOrder.id}/edit`)} className="h-8">
              <Edit className="h-4 w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Edit PO</span>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setDeleteDialogOpen(true)} className="h-8">
            <TrashIcon className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Hapus</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()} className="h-8">
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
                <div className="flex items-center mt-1">{getStatusBadge(purchaseOrder.status)}</div>
              </div>
              <div>
                <p className="text-muted-foreground">Estimasi Pengiriman</p>
                <p className="font-medium">{purchaseOrder.estimatedDelivery ? formatDate(purchaseOrder.estimatedDelivery) : "-"}</p>
              </div>
            </div>

            {purchaseOrder.notes && (
              <div className="text-sm">
                <p className="text-muted-foreground">Catatan</p>
                <p className="font-medium wrap-break-words">{purchaseOrder.notes}</p>
              </div>
            )}

            <div className="border-t pt-4 mt-2">
              <p className="text-base font-semibold mb-3">Informasi Pembayaran</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Status Pembayaran</p>
                  <div className="mt-1">
                    <Badge variant={purchaseOrder.paymentStatus === "PAID" ? "default" : purchaseOrder.paymentStatus === "UNPAID" ? "destructive" : "secondary"}>
                      {purchaseOrder.paymentStatus === "PAID" ? "Lunas" : purchaseOrder.paymentStatus === "UNPAID" ? "Belum Lunas" : "Sebagian"}
                    </Badge>
                  </div>
                </div>
                <div>
                  <p className="text-muted-foreground">Total Tagihan</p>
                  <p className="font-medium">{formatRupiah(purchaseOrder.totalAmount || 0)}</p>
                </div>
                {purchaseOrder.paymentStatus !== "UNPAID" && (
                  <div>
                    <p className="text-muted-foreground">Sudah Dibayar</p>
                    <p className="font-medium text-green-600">{formatRupiah(purchaseOrder.amountPaid || 0)}</p>
                  </div>
                )}
                {purchaseOrder.paymentStatus !== "PAID" && (
                  <>
                    <div>
                      <p className="text-muted-foreground">Sisa Hutang</p>
                      <p className="font-medium text-red-600">{formatRupiah(purchaseOrder.remainingAmount || 0)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Jatuh Tempo</p>
                      <p className="font-medium">{purchaseOrder.dueDate ? formatDate(purchaseOrder.dueDate) : "-"}</p>
                    </div>
                    <div className="col-span-2 mt-2">
                      <Button size="sm" variant="outline" className="w-full sm:w-auto border-blue-200 text-blue-700 hover:bg-blue-50" onClick={() => setPayDebtDialogOpen(true)}>
                        <Wallet className="w-4 h-4 mr-2" />
                        Bayar Hutang
                      </Button>
                    </div>
                  </>
                )}
                {(purchaseOrder.status === "received" || purchaseOrder.status === "partially_received") && (
                  <div className="col-span-2 mt-2">
                    <Button size="sm" variant="outline" className="w-full sm:w-auto border-amber-200 text-amber-700 hover:bg-amber-50" onClick={() => setReturnDialogOpen(true)}>
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Retur
                    </Button>
                  </div>
                )}
              </div>

              {purchaseOrder.payments && purchaseOrder.payments.length > 0 && (
                <div className="mt-6">
                  <p className="text-sm font-semibold mb-2">Riwayat Pembayaran</p>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tanggal</TableHead>
                          <TableHead>Metode</TableHead>
                          <TableHead className="text-right">Jumlah</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {purchaseOrder.payments.map((payment) => (
                          <TableRow key={payment.id}>
                            <TableCell className="text-xs">
                              {formatDate(payment.paidAt)}
                              {payment.notes && <div className="text-muted-foreground mt-1">{payment.notes}</div>}
                            </TableCell>
                            <TableCell className="text-xs">{payment.paymentMethod}</TableCell>
                            <TableCell className="text-right">
                              <div className="text-xs font-medium text-green-600 mb-1">Dibayar: {formatRupiah(payment.amount)}</div>
                              {payment.remainingDebtBefore !== undefined && (payment.remainingDebtBefore > 0 || payment.remainingDebtAfter !== undefined) && (
                                <div className="text-[10px] text-muted-foreground whitespace-nowrap">
                                  (Sisa sblm: {formatRupiah(payment.remainingDebtBefore || 0)} → skrg: {formatRupiah(payment.remainingDebtAfter || 0)})
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>

            <Dialog open={payDebtDialogOpen} onOpenChange={setPayDebtDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Catat Pembayaran Hutang</DialogTitle>
                  <DialogDescription>Masukkan jumlah pembayaran untuk PO ini.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <label htmlFor="amount">Jumlah Pembayaran</label>
                    <Input id="amount" type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(parseFloat(e.target.value))} />
                  </div>
                  <div className="grid gap-2">
                    <label htmlFor="paymentMethod">Metode Pembayaran</label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih metode" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CASH">Tunai (Cash)</SelectItem>
                        <SelectItem value="TRANSFER">Transfer Bank</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <label htmlFor="notes">Catatan (Opsional)</label>
                    <Input id="notes" value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setPayDebtDialogOpen(false)}>
                    Batal
                  </Button>
                  <Button onClick={handlePayDebt} disabled={isSubmitting}>
                    {isSubmitting ? "Menyimpan..." : "Simpan Pembayaran"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <div className="border-t pt-4 mt-4">
              <p className="text-sm text-muted-foreground mb-2">Ubah Status</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Select value={selectedStatus} onValueChange={(value) => setSelectedStatus(value as PurchaseOrderStatus | "")} disabled={isSubmitting}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Pilih status" />
                  </SelectTrigger>
                  <SelectContent>
                    {["ordered", "cancelled"]
                      .filter((s) => s !== purchaseOrder.status)
                      .filter((s) => !(purchaseOrder.status === "partially_received" && s === "ordered"))
                      .map((status) => (
                        <SelectItem key={status} value={status}>
                          {status === "ordered" ? "Dipesan" : status === "cancelled" ? "Dibatalkan" : status}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button onClick={updateStatus} disabled={isSubmitting || selectedStatus === purchaseOrder.status}>
                  {isSubmitting ? "Menyimpan..." : "Simpan"}
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
                    <p className="font-medium">{purchaseOrder.supplier.name || "Tidak ada nama"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Nomor Telepon</p>
                    <p className="font-medium">{purchaseOrder.supplier.phone || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Alamat</p>
                    <p className="font-medium">{purchaseOrder.supplier.address || "-"}</p>
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
                  <p className="font-medium">{purchaseOrder.supplierName || "Tidak ada informasi supplier"}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Daftar Item</CardTitle>
            <div className="flex gap-2">
              {isEditingPrices ? (
                <>
                  <Button variant="outline" size="sm" onClick={toggleEditPrices} disabled={isSubmitting}>
                    Batal
                  </Button>
                  <Button size="sm" onClick={handleSavePrices} disabled={isSubmitting}>
                    {isSubmitting ? "Menyimpan..." : "Simpan Koreksi"}
                  </Button>
                </>
              ) : (
                <Button variant="outline" size="sm" onClick={toggleEditPrices}>
                  Koreksi Harga (Nota)
                </Button>
              )}
            </div>
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
                  {purchaseOrder?.items?.map((item) => {
                    const price = isEditingPrices && editedPrices[item.id] !== undefined ? parseFloat(editedPrices[item.id] || "0") : parseFloat(item.price);

                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.productName}</TableCell>
                        <TableCell className="text-right">
                          {formatQuantity(parseFloat(item.quantity))} {item.unit}
                        </TableCell>
                        <TableCell className="text-right">
                          {isEditingPrices ? <Input type="number" value={editedPrices[item.id]} onChange={(e) => handlePriceChange(item.id, e.target.value)} className="w-32 text-right ml-auto h-8" /> : formatRupiah(price)}
                        </TableCell>
                        <TableCell className="text-right">{formatRupiah(parseFloat(item.quantity) * price)}</TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow>
                    <TableCell colSpan={3} className="text-right font-bold">
                      Total
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {isEditingPrices ? formatRupiah(purchaseOrder?.items?.reduce((total, item) => total + parseFloat(item.quantity) * parseFloat(editedPrices[item.id] || "0"), 0) || 0) : formatRupiah(calculateTotal())}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {(purchaseOrder.status === "ordered" || purchaseOrder.status === "partially_received") && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Penerimaan Barang</CardTitle>
              <CardDescription>Catat penerimaan barang dari supplier</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => setReceiveDialogOpen(true)}>
                <Truck className="mr-2 h-4 w-4" />
                Catat Penerimaan Barang
              </Button>
              <p className="text-sm text-muted-foreground mt-2">Klik tombol di atas jika barang sudah diterima lengkap. Stok produk akan bertambah otomatis.</p>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={receiveDialogOpen} onOpenChange={setReceiveDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] p-0 overflow-hidden flex flex-col gap-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Catat Penerimaan Barang
            </DialogTitle>
            <DialogDescription>
              Isi jumlah barang yang benar-benar datang. Kosongkan field quantity jika barang belum datang — PO akan tetap berstatus <b>Diterima Sebagian</b> dan bisa dilanjut nanti.
            </DialogDescription>
          </DialogHeader>

          {/* Progress Section — sticky at top */}
          {(() => {
            const { completed, total, percent } = getProgress();
            const validationIssues = getValidationIssues();
            return (
              <div className="px-6 py-4 bg-muted/30 border-b space-y-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 text-primary">
                      <Package className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Progress Penerimaan</p>
                      <p className="text-base font-semibold leading-tight">
                        {completed} dari {total} item selesai
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={handleResetAll} disabled={isSubmitting} className="text-muted-foreground">
                      <RotateCcw className="h-4 w-4 mr-1" />
                      Reset
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleReceiveAll} disabled={isSubmitting}>
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Terima Semua
                    </Button>
                  </div>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary transition-all duration-300 ease-out" style={{ width: `${percent}%` }} />
                </div>
                {validationIssues.length > 0 && (
                  <div className="flex items-start gap-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <div>{validationIssues.length === 1 ? "1 item memiliki qty melebihi sisa." : `${validationIssues.length} item memiliki qty melebihi sisa.`} Mohon periksa kembali.</div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Items List — scrollable middle */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
            {purchaseOrder?.items.length === 0 && <div className="text-center py-8 text-muted-foreground">Tidak ada item pada PO ini.</div>}
            {purchaseOrder?.items.map((item) => {
              const ordered = parseFloat(item.quantity);
              const previouslyReceived = item.receivedQuantity || 0;
              const remaining = Math.max(0, ordered - previouslyReceived);
              const batches = receiveBatches[item.id] || [];
              const currentTotalReceived = calculateTotalReceivedForItem(item.id);
              const status = getItemStatus(item);

              // Hide items that are already fully received, unless the user
              // explicitly marked the PO for closure (so they can see context).
              if (remaining <= 0 && !closePo) return null;

              return (
                <div key={item.id} className={`border rounded-lg overflow-hidden transition-colors ${status === "complete" ? "border-green-200 bg-green-50/30" : "bg-card"}`}>
                  <div className="p-4 space-y-3">
                    {/* Item Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium truncate">{item.productName}</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Dipesan: <b className="text-foreground">{ordered}</b> <span className="text-muted-foreground/60">·</span> Sudah: <b className="text-foreground">{previouslyReceived}</b>{" "}
                          <span className="text-muted-foreground/60">·</span> Sisa: <b className="text-foreground">{remaining}</b>
                          {item.unit && <span className="ml-1">{item.unit}</span>}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs font-medium shrink-0">
                        {status === "complete" && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-800">
                            <CheckCircle2 className="h-3 w-3" />
                            Selesai
                          </span>
                        )}
                        {status === "partial" && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                            <Circle className="h-3 w-3 fill-blue-500 text-blue-500" />
                            Sebagian
                          </span>
                        )}
                        {status === "pending" && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                            <Circle className="h-3 w-3" />
                            Menunggu
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Batch Inputs */}
                    {remaining > 0 && (
                      <div className="space-y-2">
                        {batches.map((batch, index) => (
                          <div key={index} className="grid grid-cols-1 sm:grid-cols-12 gap-2 p-2 bg-muted/30 rounded-md">
                            <div className="sm:col-span-3">
                              <label className="text-[10px] text-muted-foreground block">Jumlah {index > 0 && <span className="text-muted-foreground/60">(batch {index + 1})</span>}</label>
                              <Input
                                placeholder="Qty"
                                type="number"
                                min="1"
                                value={batch.quantity || ""}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  // Normalize empty / 0 / NaN to 0 so the field
                                  // displays blank and the server treats it as
                                  // "not received" instead of forcing the user
                                  // to clear the value manually.
                                  handleBatchChange(item.id, index, "quantity", isNaN(val) || val < 1 ? 0 : val);
                                }}
                                className="h-9 text-right"
                              />
                            </div>
                            <div className="sm:col-span-5">
                              <label className="text-[10px] text-muted-foreground block">Batch #</label>
                              <div className="flex gap-1">
                                <Input placeholder="Opsional" value={batch.batchNumber || ""} onChange={(e) => handleBatchChange(item.id, index, "batchNumber", e.target.value)} className="h-9 flex-1" />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-9 w-9 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-100"
                                  title="Generate Batch Number"
                                  onClick={() => {
                                    const newBatchNo = generateBatchNumber(purchaseOrder?.supplier?.name, purchaseOrder?.supplier?.code);
                                    handleBatchChange(item.id, index, "batchNumber", newBatchNo);
                                  }}
                                >
                                  <Zap className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                            <div className="sm:col-span-3">
                              <label className="text-[10px] text-muted-foreground block">Expired</label>
                              <Input type="date" value={batch.expiryDate ? batch.expiryDate.split("T")[0] : ""} onChange={(e) => handleBatchChange(item.id, index, "expiryDate", e.target.value)} className="h-9" />
                            </div>
                            <div className="sm:col-span-1 flex items-end">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 text-destructive"
                                onClick={() => removeBatchRow(item.id, index)}
                                disabled={batches.length === 1 && index === 0}
                                title={batches.length === 1 && index === 0 ? "Minimal 1 baris" : "Hapus baris"}
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}

                        <div className="flex items-center justify-between pt-1 gap-2">
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" className="text-muted-foreground h-7 px-2 text-xs" onClick={() => addBatchRow(item.id)}>
                              <Plus className="h-3 w-3 mr-1" />
                              Tambah Batch
                            </Button>
                            {currentTotalReceived > 0 && (
                              <Button variant="ghost" size="sm" className="text-muted-foreground h-7 px-2 text-xs" onClick={() => handleSkipItem(item.id)} title="Kosongkan semua batch untuk item ini">
                                <RotateCcw className="h-3 w-3 mr-1" />
                                Lewati
                              </Button>
                            )}
                          </div>
                          <div className="text-xs">
                            {currentTotalReceived > remaining ? (
                              <span className="text-red-600 font-medium">Melebihi sisa ({currentTotalReceived - remaining})</span>
                            ) : (
                              <span className="text-muted-foreground">
                                Total: <b className={currentTotalReceived > 0 ? "text-foreground" : ""}>{currentTotalReceived}</b> / {remaining}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Close PO Section — sticky above footer */}
          <div className="px-6 py-3 border-t bg-amber-50/60">
            <div className="flex items-start space-x-3">
              <Checkbox id="closePo" checked={closePo} onCheckedChange={(checked) => setClosePo(checked as boolean)} className="mt-0.5" />
              <div className="grid gap-0.5 leading-snug">
                <label htmlFor="closePo" className="text-sm font-medium leading-tight cursor-pointer">
                  Tandai PO Selesai
                </label>
                <p className="text-xs text-muted-foreground">Centang jika supplier menyatakan tidak ada lagi barang yang akan dikirim. PO akan dianggap selesai walaupun ada sisa.</p>
              </div>
            </div>
          </div>

          {/* Footer — sticky at bottom */}
          <DialogFooter className="px-6 py-4 border-t bg-card">
            <DialogClose asChild>
              <Button variant="outline" type="button" disabled={isSubmitting}>
                Batal
              </Button>
            </DialogClose>
            <Button onClick={handleReceiveGoods} disabled={isSubmitting}>
              {isSubmitting ? "Memproses..." : "Simpan Penerimaan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Purchase Order</DialogTitle>
            <DialogDescription>Apakah Anda yakin ingin menghapus purchase order {purchaseOrder.poNumber}? Tindakan ini tidak dapat dibatalkan.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" type="button">
                Batal
              </Button>
            </DialogClose>
            <Button variant="destructive" onClick={deletePurchaseOrder}>
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <PurchaseReturnDialog
        open={returnDialogOpen}
        onOpenChange={setReturnDialogOpen}
        purchaseOrder={{
          id: purchaseOrder.id,
          poNumber: purchaseOrder.poNumber,
          supplierId: purchaseOrder.supplierId,
          supplierName: purchaseOrder.supplierName || purchaseOrder.supplier?.name || "",
          status: purchaseOrder.status,
          items: purchaseOrder.items.map((item) => ({
            id: item.id,
            productId: item.productId,
            productName: item.productName,
            quantity: parseFloat(item.quantity),
            receivedQuantity: item.receivedQuantity || 0,
            unit: item.unit,
            price: parseFloat(item.price),
          })),
        }}
        onSuccess={fetchPurchaseOrder}
      />
    </div>
  );
}
