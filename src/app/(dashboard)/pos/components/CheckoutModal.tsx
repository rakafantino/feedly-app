"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FormattedNumberInput } from "@/components/ui/formatted-input";
import { Separator } from "@/components/ui/separator";
import { Toggle } from "@/components/ui/toggle";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/currency";
import { Loader2 } from "lucide-react";
import { useCart } from "@/lib/store";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import ReceiptDownloader from "@/components/ReceiptDownloader";
import { ReceiptPreview } from "@/components/ReceiptTemplate";
import { getCurrentDateTime } from "@/components/ReceiptDownloader";
import { useStore } from "@/components/providers/store-provider";

// Parse string input menjadi number
const parseInputToNumber = (value: string): number => {
  // Hapus karakter selain angka
  const numericValue = value.replace(/[^\d]/g, "");

  // Jika kosong, kembalikan 0
  if (!numericValue) return 0;

  // Konversi ke number
  return parseInt(numericValue, 10);
};

// Define Customer interface or import it if shared (best to define it here or in a types file if I can, but to match page.tsx I'll just use the same shape or any)
interface Customer {
  id: string;
  name: string;
  // ... other fields
}

export interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  customer?: Customer | null;
}

export default function CheckoutModal({ isOpen, onClose, onSuccess, customer }: CheckoutModalProps) {
  const queryClient = useQueryClient();
  const { items, clearCart } = useCart();
  const { selectedStore } = useStore(); // Use global store context
  const [isLoading, setIsLoading] = useState(false);
  const [isSplitPayment, setIsSplitPayment] = useState(false);

  // Payment States
  const [cashAmount, setCashAmount] = useState<string>("");
  const [paymentMethods, setPaymentMethods] = useState<{ method: string; amount: string }[]>([{ method: "CASH", amount: "" }]);
  const [change, setChange] = useState(0);
  // Discount State
  const [discount, setDiscount] = useState<string>("");
  // Due Date State
  const [dueDate, setDueDate] = useState<string>(""); // YYYY-MM-DD

  // Receipt States
  const [showReceipt, setShowReceipt] = useState(false);
  const [transactionData, setTransactionData] = useState<any>(null);

  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("CASH");

  // Calculate total
  const grossTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discountValue = parseInputToNumber(discount);
  const total = Math.max(0, grossTotal - discountValue); // Net Total to Pay

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setCashAmount("");
      setPaymentMethods([{ method: "CASH", amount: "" }]);
      setDiscount(""); // Reset discount
      setChange(0);
      setIsSplitPayment(false);
      setSelectedPaymentMethod("CASH");
      // Default due date: Tomorrow? Or Empty? Let's say H+7 default or today
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      setDueDate(nextWeek.toISOString().split('T')[0]);
    }
  }, [isOpen]);

  // Calculate change for single cash payment
  useEffect(() => {
    if (!isSplitPayment) {
      const cash = parseInputToNumber(cashAmount);
      setChange(Math.max(0, cash - total));
    }
  }, [cashAmount, total, isSplitPayment]);

  // ... (existing handlers)

  // Payment method handlers
  const handleCashAmountChange = (value: string) => {
    setCashAmount(value);
  };
  
  const handleDiscountChange = (value: string) => {
    setDiscount(value);
  }

  const handlePaymentMethodChange = (index: number, method: string) => {
    const newMethods = [...paymentMethods];
    newMethods[index].method = method;
    setPaymentMethods(newMethods);
  };

  const handlePaymentAmountChange = (index: number, amount: string) => {
    const newMethods = [...paymentMethods];
    newMethods[index].amount = amount;
    setPaymentMethods(newMethods);
  };

  const addPaymentMethod = () => {
    setPaymentMethods([...paymentMethods, { method: "CASH", amount: "" }]);
  };

  const removePaymentMethod = (index: number) => {
    if (paymentMethods.length > 1) {
      setPaymentMethods(paymentMethods.filter((_, i) => i !== index));
    }
  };

  const calculateTotalPayment = () => {
    return paymentMethods.reduce((sum, p) => sum + parseInputToNumber(p.amount), 0);
  };

  // CHECKOUT HANDLER
  const handleCheckout = async () => {
    // Validasi Pembayaran
    let isDebt = false;
    let finalAmountPaid = 0;

    if (isSplitPayment) {
      const totalPaid = calculateTotalPayment();
      finalAmountPaid = totalPaid;
      if (totalPaid < total) {
        isDebt = true;
         // Allow split debt, but confirm user knows it's debt?
         // toast.error(`Pembayaran kurang ${formatCurrency(total - totalPaid)}`);
         // Actually, if split payment and less than total, it IS debt. 
         // Logic check: do we block or allow? POS usually allows partial payment = debt.
      }
    } else {
      const cash = parseInputToNumber(cashAmount);
      finalAmountPaid = cash;
      if (selectedPaymentMethod === "DEBT") {
          isDebt = true;
          finalAmountPaid = 0;
      } else if (cash < total && selectedPaymentMethod === "CASH") {
         // Cash but less? Treated as Debt or Error? 
         // Existing code treated as error. Let's keep it error for standard CASH, 
         // unless we auto-switch to "Partial Cash"? 
         // For now, let's strictly follow existing: Error if CASH and < Total. 
         // Unless user explicitly chooses DEBT.
         toast.error(`Pembayaran kurang ${formatCurrency(total - cash)}`);
         return;
      }
    }
    
    // Check Debt Requirements
    if (isDebt || (isSplitPayment && finalAmountPaid < total)) {
        if (!customer) {
            toast.error("Pilih pelanggan untuk mencatat hutang");
            return;
        }
        if (!dueDate) {
            toast.error("Tentukan tanggal jatuh tempo");
            return;
        }
    }

    try {
      setIsLoading(true);

      // Prepare Payment Details
      let paymentDetails = null;
      let paymentMethod = selectedPaymentMethod;

      if (isSplitPayment) {
        paymentMethod = "SPLIT";
        paymentDetails = paymentMethods.map((method) => ({
          ...method,
          amount: parseInputToNumber(method.amount),
        }));
      } else {
        const cashNumeric = parseInputToNumber(cashAmount);
        paymentDetails = [
          {
            method: selectedPaymentMethod,
            amount: selectedPaymentMethod === "DEBT" ? 0 : total, // Jika DEBT, amount paid = 0
            cashGiven: cashNumeric, // Actual cash handed over
            change: change,
          },
        ];
      }

      // Payload Construction
      const payload = {
        items: items.map((item) => ({
          productId: item.id,
          quantity: item.quantity,
          price: item.price,
        })),
        paymentMethod,
        paymentDetails,
        customerId: customer?.id, // INCLUDE CUSTOMER ID
        amountPaid: isSplitPayment ? finalAmountPaid : (selectedPaymentMethod === 'DEBT' ? 0 : finalAmountPaid), // Explicitly send amountPaid for clarity
        dueDate: (isDebt || finalAmountPaid < total) ? new Date(dueDate) : undefined,
        discount: discountValue, // SEND DISCOUNT
      };

      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Gagal membuat transaksi");
      }

      const responseData = await response.json();

      // Transaksi Berhasil
      toast.success("Transaksi berhasil!");

      // Prepare Receipt Data
      setTransactionData({
        invoiceNumber: responseData.transaction.invoiceNumber, // Use server-generated invoice number
        date: getCurrentDateTime(),
        items: items,
        payments: isSplitPayment ? paymentDetails : [{ method: paymentMethod, amount: total }], // Use selected method and TOTAL amount for record, but...
        // Wait, for CASH, if I pay 550k for 547k, the payment recorded in DB usually is 547k (the bill).
        // The receipt should show: Total 547k. Payment: 550k. Change: 3k.
        // By passing `payments` as just `[{CASH, 547k}]` and `change: 3k`, the receipt template logic I wrote:
        // `Total Terima` = `totalPayment` (547k) + `change` (3k) = 550k. This works!
        // NOTE: With discount, TOTAL is 547k. If Gross was 550k, Disc 3k.
        customerName: customer?.name,
        // Replace with dynamic store data
        storeName: selectedStore?.name || "Feedly Shop",
        storeAddress: selectedStore?.address || "Terimakasih telah berbelanja",
        storePhone: selectedStore?.phone || "-",
        totalChange: change,
        discount: discountValue, // Pass discount to receipt if template supports it (it doesn't yet, but we can update template separately)
      });

      setShowReceipt(true);
      clearCart();

      // Trigger Stock Alert Refresh (Non-blocking)
      try {
        if (selectedStore?.id) {
          fetch("/api/stock-alerts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ storeId: selectedStore.id, forceCheck: true }),
          })
            .then(() => {
              if (typeof window !== "undefined") {
                window.dispatchEvent(new Event("stock-alerts-refresh"));
              }
            })
            .catch((err) => console.error("Background stock alert refresh failed:", err));
        }
      } catch (err) {
        console.error("Failed to trigger stock alerts:", err);
      }

      // Callback
      if (onSuccess) {
        onSuccess();
      }

      // Invalidate queries to ensure global state is fresh
      await Promise.all([
         queryClient.invalidateQueries({ queryKey: ['products'] }),
         queryClient.invalidateQueries({ queryKey: ['stock-analytics'] }),
         queryClient.invalidateQueries({ queryKey: ['dashboard-analytics'] })
      ]);
    } catch (error) {
      console.error("Error during checkout:", error);
      toast.error("Terjadi kesalahan saat checkout");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloseReceipt = () => {
    setShowReceipt(false);
    onClose();
  };
  
  // Helper to determine if debt UI is needed
  const isDebtTransaction = selectedPaymentMethod === "DEBT" || (isSplitPayment && calculateTotalPayment() < total);

  // RENDER RECEIPT DIALOG
  if (showReceipt && transactionData) {
    // ... (Receipt Render - Unchanged)
    return (
      <Dialog open={true} onOpenChange={() => handleCloseReceipt()}>
        <DialogContent className="sm:max-w-xl max-h-screen overflow-y-auto p-3 sm:p-6" aria-describedby="receipt-dialog-description">
          <DialogHeader>
            <DialogTitle>Struk Pembayaran</DialogTitle>
          </DialogHeader>

          <div className="py-2 sm:py-4 w-full">
            <ReceiptPreview
              invoiceNumber={transactionData.invoiceNumber}
              date={transactionData.date}
              items={transactionData.items}
              payments={transactionData.payments}
              customerName={transactionData.customerName}
              storeName={transactionData.storeName}
              storeAddress={transactionData.storeAddress}
              storePhone={transactionData.storePhone}
              totalChange={transactionData.totalChange}
              discount={transactionData.discount}
            />
             {/* TEMPORARY: Warning if discount > 0 because Receipt template might not show it yet */}
             {transactionData.discount > 0 && <div className="text-center text-xs text-muted-foreground mt-2">*Termasuk Diskon: {formatCurrency(transactionData.discount)}</div>}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <ReceiptDownloader
              receipt={{
                items: transactionData.items,
                payments: transactionData.payments,
                customerName: transactionData.customerName,
                storeName: transactionData.storeName,
                storeAddress: transactionData.storeAddress,
                storePhone: transactionData.storePhone,
                totalChange: transactionData.totalChange,
                discount: transactionData.discount,
              }}
              fileName={`Receipt-${transactionData.invoiceNumber}.pdf`}
            />
            <Button variant="outline" onClick={handleCloseReceipt}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // RENDER CHECKOUT FORM
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md" aria-describedby="checkout-dialog-description">
        <DialogHeader>
          <DialogTitle>Checkout</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Transaction Summary */}
          <div className="space-y-2">
            <h3 className="font-medium">Ringkasan Transaksi</h3>
            {customer && (
              <div className="text-sm bg-muted p-2 rounded-md mb-2">
                <span className="font-semibold">Pelanggan:</span> {customer.name}
              </div>
            )}
            <div className="space-y-1 max-h-40 overflow-y-auto pr-2">
              {items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span>
                    {item.name} x{item.quantity}
                  </span>
                  <span>{formatCurrency(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>
            <Separator className="my-2" />
            
             {/* Discount Input */}
             <div className="flex items-center justify-between space-x-2">
               <Label htmlFor="discount" className="text-sm font-normal">Diskon (Nominal)</Label>
               <FormattedNumberInput
                 id="discount"
                 value={discount}
                 onChange={handleDiscountChange}
                 placeholder="0"
                 allowEmpty={true} 
                 className="w-[120px] text-right h-8"
               />
            </div>
            {discountValue > 0 && (
               <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{formatCurrency(grossTotal)}</span>
               </div>
            )}

            <div className="flex justify-between font-semibold">
              <span>Total Tagihan</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>

          {/* Payment Mode Toggle */}
          <div className="flex items-center space-x-2">
            <Toggle pressed={isSplitPayment} onPressedChange={setIsSplitPayment} className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
              Split Pembayaran
            </Toggle>
          </div>

          {/* Payment Method(s) */}
          {isSplitPayment ? (
            <div className="space-y-3">
              <h3 className="font-medium">Metode Pembayaran (Split)</h3>
              {paymentMethods.map((payment, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <Select value={payment.method} onValueChange={(value) => handlePaymentMethodChange(index, value)}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue placeholder="Metode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CASH">Tunai</SelectItem>
                      <SelectItem value="TRANSFER">Transfer</SelectItem>
                      <SelectItem value="QRIS">QRIS</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormattedNumberInput value={payment.amount || ""} onChange={(value) => handlePaymentAmountChange(index, value)} placeholder="Jumlah" className="flex-1" allowEmpty={true} />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      removePaymentMethod(index);
                    }}
                    disabled={paymentMethods.length <= 1}
                  >
                    ✖
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addPaymentMethod} className="w-full">
                + Tambah Metode Pembayaran
              </Button>
              {/* Total dari semua metode pembayaran */}
               <div className="flex justify-between font-medium pt-2">
                <span>Total Pembayaran:</span>
                <span>{formatCurrency(calculateTotalPayment())}</span>
              </div>
              <div className="flex justify-between font-medium text-amber-600">
                  <span>Sisa (Hutang):</span>
                  <span>{formatCurrency(Math.max(0, total - calculateTotalPayment()))}</span>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Metode Pembayaran</Label>
                <Select value={selectedPaymentMethod} onValueChange={setSelectedPaymentMethod}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Pilih Metode Pembayaran" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">Tunai</SelectItem>
                    <SelectItem value="TRANSFER">Transfer</SelectItem>
                    <SelectItem value="QRIS">QRIS</SelectItem>
                    {customer && <SelectItem value="DEBT">Hutang / Bon (0 Bayar)</SelectItem>}
                  </SelectContent>
                </Select>
              </div>

              {selectedPaymentMethod !== "DEBT" && (
                <div className="space-y-1">
                  <Label htmlFor="cashAmount">Jumlah Bayar</Label>
                  <FormattedNumberInput id="cashAmount" value={cashAmount || ""} onChange={handleCashAmountChange} placeholder="Masukkan jumlah bayar" allowEmpty={true} autoFocus />
                </div>
              )}

              {/* Logic Hutang / Kembalian */}
              {(() => {
                const cash = parseInputToNumber(cashAmount);

                if (selectedPaymentMethod === "DEBT") {
                  return (
                    <div className="flex justify-between font-medium text-red-600">
                      <span>Total Hutang:</span>
                      <span>{formatCurrency(total)}</span>
                    </div>
                  );
                }

                if (cash < total) {
                  return (
                    <div className="flex justify-between font-medium text-amber-600">
                      <span>Harus Dibayar:</span>
                      <span>{formatCurrency(total - cash)}</span>
                    </div>
                  );
                }

                return (
                  <div className="flex justify-between font-medium text-green-600">
                    <span>Kembalian:</span>
                    <span>{formatCurrency(change)}</span>
                  </div>
                );
              })()}
            </div>
          )}
          
          {/* Due Date Input if Debt */}
          {isDebtTransaction && (
             <div className="space-y-1 animate-in fade-in slide-in-from-top-2">
                <Label htmlFor="dueDate" className="text-red-600">Jatuh Tempo Hutang</Label>
                <div className="relative">
                  <input
                    type="date"
                    id="dueDate"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
             </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Batal
          </Button>
          <Button onClick={handleCheckout} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Memproses...
              </>
            ) : (
              "Bayar Sekarang"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
