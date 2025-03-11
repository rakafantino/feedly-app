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
import { Input } from "@/components/ui/input";
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
import { generateInvoiceNumber, getCurrentDateTime } from "@/components/ReceiptDownloader";

export interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CheckoutModal({ isOpen, onClose }: CheckoutModalProps) {
  const { items, clearCart } = useCart();
  const [isLoading, setIsLoading] = useState(false);
  const [isSplitPayment, setIsSplitPayment] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState([
    { method: "CASH", amount: 0 }
  ]);
  const [cashAmount, setCashAmount] = useState<number>(0);
  const [change, setChange] = useState<number>(0);
  const [showReceipt, setShowReceipt] = useState(false);
  const [transactionData, setTransactionData] = useState<any>(null);

  const total = items.reduce((acc, item) => acc + (item.price * item.quantity), 0);

  useEffect(() => {
    // Reset payment amount when total changes
    if (!isSplitPayment) {
      setCashAmount(0);
      setChange(0);
    } else {
      // Update first payment method amount to match total
      const updatedMethods = [...paymentMethods];
      updatedMethods[0] = { ...updatedMethods[0], amount: total };
      setPaymentMethods(updatedMethods);
    }
  }, [total, isSplitPayment, paymentMethods]);

  const handlePaymentMethodChange = (index: number, method: string) => {
    const updatedMethods = [...paymentMethods];
    updatedMethods[index] = { ...updatedMethods[index], method };
    setPaymentMethods(updatedMethods);
  };

  const handlePaymentAmountChange = (index: number, amount: number) => {
    const updatedMethods = [...paymentMethods];
    updatedMethods[index] = { ...updatedMethods[index], amount };
    setPaymentMethods(updatedMethods);
  };

  const addPaymentMethod = () => {
    setPaymentMethods([...paymentMethods, { method: "CASH", amount: 0 }]);
  };

  const removePaymentMethod = (index: number) => {
    if (paymentMethods.length <= 1) return;
    const updatedMethods = paymentMethods.filter((_, i) => i !== index);
    setPaymentMethods(updatedMethods);
  };

  const handleCashAmountChange = (value: number) => {
    setCashAmount(value);
    const calculatedChange = value - total;
    setChange(calculatedChange >= 0 ? calculatedChange : 0);
  };

  const handleCheckout = async () => {
    if (items.length === 0) {
      toast.error("Tidak ada item dalam keranjang");
      return;
    }

    // Validate total payments for split payment
    if (isSplitPayment) {
      const totalPayment = paymentMethods.reduce((acc, payment) => acc + payment.amount, 0);
      
      if (totalPayment < total) {
        toast.error("Total pembayaran kurang dari total transaksi");
        return;
      }
    } else {
      // Validate cash payment
      if (cashAmount < total) {
        toast.error("Pembayaran kurang dari total transaksi");
        return;
      }
    }

    setIsLoading(true);

    try {
      // Get payment details
      let paymentDetails = null;
      let paymentMethod = "CASH";

      if (isSplitPayment) {
        // Use multiple payment methods
        paymentMethod = "SPLIT";
        paymentDetails = paymentMethods;
      } else {
        // Single payment method (cash for now)
        paymentDetails = [
          {
            method: "CASH",
            amount: total,
            cashGiven: cashAmount,
            change: change
          }
        ];
      }

      const payload = {
        items: items.map(item => ({
          productId: item.id,
          quantity: item.quantity,
          price: item.price
        })),
        paymentMethod,
        paymentDetails
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
      
      // Set transaction data for receipt
      setTransactionData({
        invoiceNumber: generateInvoiceNumber(),
        date: getCurrentDateTime(),
        items: items,
        payments: isSplitPayment 
          ? paymentMethods 
          : [{ method: "CASH", amount: total }]
      });
      
      // Show receipt
      setShowReceipt(true);
      
      // Success
      toast.success("Transaksi berhasil!");
      clearCart();
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

  if (showReceipt && transactionData) {
    return (
      <Dialog open={true} onOpenChange={() => handleCloseReceipt()}>
        <DialogContent className="sm:max-w-xl max-h-screen overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Struk Pembayaran</DialogTitle>
          </DialogHeader>
          
          <div className="py-4">
            <ReceiptPreview 
              invoiceNumber={transactionData.invoiceNumber}
              date={transactionData.date}
              items={transactionData.items}
              payments={transactionData.payments}
            />
          </div>
          
          <DialogFooter>
            <ReceiptDownloader 
              receipt={{
                items: transactionData.items,
                payments: transactionData.payments,
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

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Checkout</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Transaction Summary */}
          <div className="space-y-2">
            <h3 className="font-medium">Ringkasan Transaksi</h3>
            <div className="space-y-1">
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
              className="data-[state=on]:bg-primary"
            >
              Split Pembayaran
            </Toggle>
          </div>

          {/* Payment Method(s) */}
          {isSplitPayment ? (
            <div className="space-y-3">
              <h3 className="font-medium">Metode Pembayaran</h3>
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
                  <Input
                    type="number"
                    value={payment.amount}
                    onChange={(e) => handlePaymentAmountChange(index, Number(e.target.value))}
                    placeholder="Jumlah"
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removePaymentMethod(index)}
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
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="cashAmount">Jumlah Tunai</Label>
                <Input
                  id="cashAmount"
                  type="number"
                  value={cashAmount}
                  onChange={(e) => handleCashAmountChange(Number(e.target.value))}
                  placeholder="Masukkan jumlah tunai"
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