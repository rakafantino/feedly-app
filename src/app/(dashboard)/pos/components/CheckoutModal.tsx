"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FormattedNumberInput } from "@/components/ui/formatted-input";
import { Separator } from "@/components/ui/separator";
import { Toggle } from "@/components/ui/toggle";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/currency";
import { Loader2 } from "lucide-react";
import { useCart } from "@/lib/store";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import ReceiptDownloader from "@/components/ReceiptDownloader";
import { ReceiptPreview } from "@/components/ReceiptTemplate";
import { getCurrentDateTime } from "@/components/ReceiptDownloader";
import { useStore } from "@/components/providers/store-provider";

// Parse string input menjadi number
const parseInputToNumber = (value: string): number => {
  // Hapus karakter selain angka
  const numericValue = value.replace(/[^\d]/g, '');

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
  const { items, clearCart } = useCart();
  const { selectedStore } = useStore(); // Use global store context
  const [isLoading, setIsLoading] = useState(false);
  const [isSplitPayment, setIsSplitPayment] = useState(false);

  // Payment States
  const [cashAmount, setCashAmount] = useState<string>("");
  const [paymentMethods, setPaymentMethods] = useState<{ method: string; amount: string }[]>([
    { method: "CASH", amount: "" }
  ]);
  const [change, setChange] = useState(0);

  // Receipt States
  const [showReceipt, setShowReceipt] = useState(false);
  const [transactionData, setTransactionData] = useState<any>(null);

  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("CASH");

  // Calculate total
  const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setCashAmount("");
      setPaymentMethods([{ method: "CASH", amount: "" }]);
      setChange(0);
      setIsSplitPayment(false);
      setSelectedPaymentMethod("CASH");
    }
  }, [isOpen]);

  // Calculate change for single cash payment
  useEffect(() => {
    if (!isSplitPayment) {
      const cash = parseInputToNumber(cashAmount);
      setChange(Math.max(0, cash - total));
    }
  }, [cashAmount, total, isSplitPayment]);

  // Payment method handlers
  const handleCashAmountChange = (value: string) => {
    setCashAmount(value);
  };

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
    if (isSplitPayment) {
      const totalPaid = calculateTotalPayment();
      if (totalPaid < total) {
        toast.error(`Pembayaran kurang ${formatCurrency(total - totalPaid)}`);
        return;
      }
    } else {
      const cash = parseInputToNumber(cashAmount);
      if (cash < total && selectedPaymentMethod === "CASH") {
        // Only validasi kurang bayar for CASH? Or for transfer too? usually transfer exact amount.
        toast.error(`Pembayaran kurang ${formatCurrency(total - cash)}`);
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
        paymentDetails = paymentMethods.map(method => ({
          ...method,
          amount: parseInputToNumber(method.amount)
        }));
      } else {
        const cashNumeric = parseInputToNumber(cashAmount);
        paymentDetails = [
          {
            method: selectedPaymentMethod,
            amount: total, // For record purposes, amount PAID is the Bill Total
            cashGiven: cashNumeric, // Actual cash handed over
            change: change
          }
        ];
      }

      // Payload Construction
      const payload = {
        items: items.map(item => ({
          productId: item.id,
          quantity: item.quantity,
          price: item.price
        })),
        paymentMethod,
        paymentDetails,
        customerId: customer?.id // INCLUDE CUSTOMER ID
      };

      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
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
        payments: isSplitPayment
          ? paymentDetails
          : [{ method: paymentMethod, amount: total }], // Use selected method and TOTAL amount for record, but...
        // Wait, for CASH, if I pay 550k for 547k, the payment recorded in DB usually is 547k (the bill).
        // The receipt should show: Total 547k. Payment: 550k. Change: 3k.
        // By passing `payments` as just `[{CASH, 547k}]` and `change: 3k`, the receipt template logic I wrote:
        // `Total Terima` = `totalPayment` (547k) + `change` (3k) = 550k. This works!
        customerName: customer?.name,
        // Replace with dynamic store data
        storeName: selectedStore?.name || "Feedly Shop",
        storeAddress: selectedStore?.address || "Terimakasih telah berbelanja",
        storePhone: selectedStore?.phone || "-",
        totalChange: change
      });

      setShowReceipt(true);
      clearCart();

      // Trigger Stock Alert Refresh (Non-blocking)
      try {
        if (selectedStore?.id) {
          fetch('/api/stock-alerts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ storeId: selectedStore.id, forceCheck: true })
          }).then(() => {
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new Event('stock-alerts-refresh'));
            }
          }).catch(err => console.error('Background stock alert refresh failed:', err));
        }
      } catch (err) {
        console.error('Failed to trigger stock alerts:', err);
      }

      // Callback
      if (onSuccess) {
        onSuccess();
      }

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

  // RENDER RECEIPT DIALOG
  if (showReceipt && transactionData) {
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
            />
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
                totalChange: transactionData.totalChange
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
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
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
                  <span>{item.name} x{item.quantity}</span>
                  <span>{formatCurrency(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>

          {/* Payment Mode Toggle */}
          <div className="flex items-center space-x-2">
            <Toggle
              pressed={isSplitPayment}
              onPressedChange={setIsSplitPayment}
              className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              Split Pembayaran
            </Toggle>
          </div>

          {/* Payment Method(s) */}
          {isSplitPayment ? (
            <div className="space-y-3">
              <h3 className="font-medium">Metode Pembayaran (Split)</h3>
              {paymentMethods.map((payment, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <Select
                    value={payment.method}
                    onValueChange={(value) => handlePaymentMethodChange(index, value)}
                  >
                    <SelectTrigger className="w-[120px]">
                      <SelectValue placeholder="Metode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CASH">Tunai</SelectItem>
                      <SelectItem value="TRANSFER">Transfer</SelectItem>
                      <SelectItem value="QRIS">QRIS</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormattedNumberInput
                    value={payment.amount || ''}
                    onChange={(value) => handlePaymentAmountChange(index, value)}
                    placeholder="Jumlah"
                    className="flex-1"
                    allowEmpty={true}
                  />
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
              <Button
                variant="outline"
                size="sm"
                onClick={addPaymentMethod}
                className="w-full"
              >
                + Tambah Metode Pembayaran
              </Button>
              {/* Total dari semua metode pembayaran */}
              <div className="flex justify-between font-medium pt-2">
                <span>Total Pembayaran:</span>
                <span>{formatCurrency(calculateTotalPayment())}</span>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Metode Pembayaran</Label>
                <Select
                  value={selectedPaymentMethod}
                  onValueChange={setSelectedPaymentMethod}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Pilih Metode Pembayaran" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">Tunai</SelectItem>
                    <SelectItem value="TRANSFER">Transfer</SelectItem>
                    <SelectItem value="QRIS">QRIS</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="cashAmount">Jumlah Bayar</Label>
                <FormattedNumberInput
                  id="cashAmount"
                  value={cashAmount || ''}
                  onChange={handleCashAmountChange}
                  placeholder="Masukkan jumlah bayar"
                  allowEmpty={true}
                  autoFocus
                />
              </div>

              <div className="flex justify-between font-medium">
                <span>Kembalian:</span>
                <span>{formatCurrency(change)}</span>
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