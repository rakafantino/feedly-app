import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormattedNumberInput } from "@/components/ui/formatted-input";
import { Calculator, Plus, Trash2 } from "lucide-react";

interface PriceCalculatorProps {
  isOpen: boolean;
  onClose: () => void;
  purchasePrice: number;
  onApply: (minPrice: number, sellPrice: number) => void;
}

interface CostItem {
  id: string;
  name: string;
  amount: number;
}

export function PriceCalculator({ isOpen, onClose, purchasePrice, onApply }: PriceCalculatorProps) {
  // Additional Costs State
  const [costs, setCosts] = useState<CostItem[]>([{ id: "1", name: "Plastik/Kemasan", amount: 0 }]);

  // Margins State
  const [safetyMarginPercent, setSafetyMarginPercent] = useState<string>("5"); // Margin aman default 5%
  const [retailMarginPercent, setRetailMarginPercent] = useState<string>("10"); // Margin jual default 10%

  // Calculated values
  const [hpp, setHpp] = useState(0);
  const [minSellingPrice, setMinSellingPrice] = useState(0); // This is HPP + Safety Margin
  const [finalSellingPrice, setFinalSellingPrice] = useState(0); // This is Min Price + Retail Margin

  // Profit Analysis
  const [safetyProfit, setSafetyProfit] = useState(0);
  const [totalProfit, setTotalProfit] = useState(0);

  // Constants
  const MIN_PRICE_ROUNDING = 50; // Pembulatan ke 50 terdekat
  const FINAL_PRICE_ROUNDING = 100; // Pembulatan ke 100 terdekat

  useEffect(() => {
    // 1. Calculate Total Operational Cost
    const totalCost = costs.reduce((sum, item) => sum + item.amount, 0);

    // 2. Real HPP (Modal Bersih)
    const realHpp = purchasePrice + totalCost;
    setHpp(realHpp);

    // 3. Min Selling Price (HPP + Safety Margin)
    const sMargin = parseFloat(safetyMarginPercent) || 0;
    const itemsSafetyProfit = realHpp * (sMargin / 100);
    const rawMinPrice = realHpp + itemsSafetyProfit;
    const roundedMinPrice = Math.ceil(rawMinPrice / MIN_PRICE_ROUNDING) * MIN_PRICE_ROUNDING;

    setSafetyProfit(roundedMinPrice - realHpp);
    setMinSellingPrice(roundedMinPrice);

    // 4. Final Selling Price (Min Price + Retail Margin)
    const rMargin = parseFloat(retailMarginPercent) || 0;
    const itemsRetailProfit = roundedMinPrice * (rMargin / 100);
    const rawFinalPrice = roundedMinPrice + itemsRetailProfit;
    const roundedFinalPrice = Math.ceil(rawFinalPrice / FINAL_PRICE_ROUNDING) * FINAL_PRICE_ROUNDING;

    setFinalSellingPrice(roundedFinalPrice);
    setTotalProfit(roundedFinalPrice - realHpp);
  }, [purchasePrice, costs, safetyMarginPercent, retailMarginPercent]);

  const addCostItem = () => {
    setCosts([...costs, { id: Math.random().toString(), name: "", amount: 0 }]);
  };

  const updateCostItem = (id: string, field: keyof CostItem, value: any) => {
    setCosts(costs.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const removeCostItem = (id: string) => {
    setCosts(costs.filter((item) => item.id !== id));
  };

  const handleApply = () => {
    onApply(minSellingPrice, finalSellingPrice);
    onClose();
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat("id-ID").format(val);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5" />
            Kalkulator Harga Cerdas
          </DialogTitle>
          <DialogDescription>Hitung HPP Real, Harga Minimum (Aman), dan Harga Jual Ideal.</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* SECTION 1: MODAL DASAR & BIAYA */}
          <div className="space-y-4 border rounded-md p-4 bg-slate-50">
            <h4 className="font-semibold text-sm flex items-center gap-2 text-slate-700">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-200 text-xs">1</span>
              Modal & Biaya Operasional
            </h4>

            <div className="grid grid-cols-2 gap-4 items-center">
              <Label className="text-slate-600">Harga Beli (Supplier)</Label>
              <div className="text-right font-medium">Rp {formatCurrency(purchasePrice)}</div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Biaya Tambahan (per unit):</Label>
              {costs.map((item) => (
                <div key={item.id} className="flex gap-2 items-center">
                  <Input placeholder="Nama Biaya (Mis: Plastik)" className="h-8 text-sm" value={item.name} onChange={(e) => updateCostItem(item.id, "name", e.target.value)} />
                  <div className="w-32">
                    <FormattedNumberInput value={item.amount} onChange={(val) => updateCostItem(item.id, "amount", Number(val))} placeholder="Rp 0" className="h-8 text-right" />
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => removeCostItem(item.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addCostItem} className="w-full h-8 text-xs border-dashed">
                <Plus className="w-3 h-3 mr-1" /> Tambah Biaya Lain
              </Button>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-slate-200">
              <span className="font-bold text-slate-900">Total HPP (Modal Bersih)</span>
              <span className="font-bold text-slate-900">Rp {formatCurrency(hpp)}</span>
            </div>
          </div>

          {/* SECTION 2: MARGIN PENGAMAN (HARGA MINIMUM) */}
          <div className="space-y-4 border rounded-md p-4 bg-amber-50/50 border-amber-100">
            <h4 className="font-semibold text-sm flex items-center gap-2 text-amber-800">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-200 text-xs text-amber-900">2</span>
              Harga Jual Minimum (Anti Boncos)
            </h4>

            <div className="grid grid-cols-[1fr,auto,1fr] gap-4 items-center">
              <div className="text-sm">
                <div className="font-medium text-slate-700">Margin Pengaman</div>
                <div className="text-xs text-slate-500">Agar batas bawah tetap untung</div>
              </div>
              <div className="flex items-center w-24 relative">
                <Input type="number" value={safetyMarginPercent} onChange={(e) => setSafetyMarginPercent(e.target.value)} className="pr-6 text-right h-9" />
                <span className="absolute right-2 text-xs text-slate-400">%</span>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-500 mb-1">Profit Min: Rp {formatCurrency(safetyProfit)}</div>
                <div className="font-bold text-lg text-amber-700 bg-white px-2 py-1 rounded border border-amber-200 inline-block min-w-[100px]">Rp {formatCurrency(minSellingPrice)}</div>
              </div>
            </div>
          </div>

          {/* SECTION 3: HARGA JUAL FINAL */}
          <div className="space-y-4 border rounded-md p-4 bg-green-50/50 border-green-100">
            <h4 className="font-semibold text-sm flex items-center gap-2 text-green-800">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-green-200 text-xs text-green-900">3</span>
              Harga Jual Akhir (Target Profit)
            </h4>

            <div className="grid grid-cols-[1fr,auto,1fr] gap-4 items-center">
              <div className="text-sm">
                <div className="font-medium text-slate-700">Margin Tambahan</div>
                <div className="text-xs text-slate-500">Dari harga minimum</div>
              </div>
              <div className="flex items-center w-24 relative">
                <Input type="number" value={retailMarginPercent} onChange={(e) => setRetailMarginPercent(e.target.value)} className="pr-6 text-right h-9" />
                <span className="absolute right-2 text-xs text-slate-400">%</span>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-500 mb-1">Total Profit: Rp {formatCurrency(totalProfit)}</div>
                <div className="font-bold text-2xl text-green-700">Rp {formatCurrency(finalSellingPrice)}</div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <div className="flex-1 text-xs text-slate-500 text-left">*Harga otomatis dibulatkan (Min: 50, Akhir: 100)</div>
          <Button type="button" variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button type="button" onClick={handleApply} className="bg-blue-600 hover:bg-blue-700 text-white">
            Gunakan Harga Ini
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
