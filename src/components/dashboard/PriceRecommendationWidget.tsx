// src/components/dashboard/PriceRecommendationWidget.tsx
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatRupiah } from "@/lib/utils";
import { AlertCircle, ArrowRight, CheckCircle2, Loader2, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { calculateRetailMarginFromCustomPrice } from "@/core/price-calculator/price-calculator-core";

interface Recommendation {
  id: string;
  name: string;
  currentPrice: number;
  rawRecommendedPrice: number;
  recommendedPriceUp: number;
  recommendedPriceDown: number;
  minSellingPrice: number;
  retailMargin: number;
  unit: string;
}

type RowAction = "apply" | "custom" | "dismiss";

type RowState =
  | { kind: "default" }
  | { kind: "customInput"; input: string }
  | { kind: "submitting"; action: RowAction };

const TOAST_DURATION_MS = 5000;

export function PriceRecommendationWidget() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [rowStates, setRowStates] = useState<Record<string, RowState>>({});

  const getRowState = (id: string): RowState => rowStates[id] ?? { kind: "default" };
  const setRowState = (id: string, state: RowState) =>
    setRowStates((prev) => ({ ...prev, [id]: state }));

  const removeRow = (id: string) => {
    setRecommendations((prev) => prev.filter((r) => r.id !== id));
    setRowStates((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const fetchRecommendations = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/dashboard/price-recommendations");
      if (!res.ok) throw new Error("Gagal mengambil data");
      const data = await res.json();
      setRecommendations(data.recommendations || []);
    } catch (error) {
      console.error("Error fetching price recommendations:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, []);

  const handleApply = async (item: Recommendation, price: number) => {
    setRowState(item.id, { kind: "submitting", action: "apply" });
    try {
      const res = await fetch("/api/dashboard/price-recommendations/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: item.id, price }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Gagal memperbarui harga");
      }

      toast.success(
        `Harga ${item.name} berhasil diperbarui menjadi ${formatRupiah(price)}`,
        { duration: TOAST_DURATION_MS }
      );
      removeRow(item.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Terjadi kesalahan";
      toast.error(message, { duration: TOAST_DURATION_MS });
      setRowState(item.id, { kind: "default" });
    }
  };

  const handleCustomConfirm = async (item: Recommendation, rawInput: string) => {
    const trimmed = rawInput.trim();
    const customPrice = Number.parseInt(trimmed, 10);

    if (!Number.isFinite(customPrice) || trimmed === "" || `${customPrice}` !== trimmed) {
      toast.error("Masukkan angka yang valid", { duration: TOAST_DURATION_MS });
      return;
    }
    if (customPrice < item.minSellingPrice) {
      toast.error(
        `Harga minimum ${formatRupiah(item.minSellingPrice)}`,
        { duration: TOAST_DURATION_MS }
      );
      return;
    }
    if (customPrice % 50 !== 0) {
      toast.error("Harga harus kelipatan 50", { duration: TOAST_DURATION_MS });
      return;
    }

    setRowState(item.id, { kind: "submitting", action: "custom" });
    try {
      const res = await fetch("/api/dashboard/price-recommendations/custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: item.id, customPrice }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Gagal menyimpan harga kustom");
      }

      const margin =
        typeof data.retailMargin === "number"
          ? data.retailMargin.toFixed(2)
          : calculateRetailMarginFromCustomPrice(customPrice, item.minSellingPrice).toFixed(2);

      toast.success(
        `Harga ${item.name} disimpan: ${formatRupiah(customPrice)} (margin ${margin}%)`,
        { duration: TOAST_DURATION_MS }
      );
      removeRow(item.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Terjadi kesalahan";
      toast.error(message, { duration: TOAST_DURATION_MS });
      // Restore the customInput state with the user's input so they can fix it.
      setRowState(item.id, { kind: "customInput", input: rawInput });
    }
  };

  const handleDismiss = async (item: Recommendation) => {
    setRowState(item.id, { kind: "submitting", action: "dismiss" });
    try {
      const res = await fetch("/api/dashboard/price-recommendations/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: item.id }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Gagal menutup rekomendasi");
      }

      toast.success(`Rekomendasi ${item.name} ditutup`, { duration: TOAST_DURATION_MS });
      removeRow(item.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Terjadi kesalahan";
      toast.error(message, { duration: TOAST_DURATION_MS });
      // Per Requirement 1.5 — the row MUST stay visible on dismiss failure.
      setRowState(item.id, { kind: "default" });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-indigo-500" />
            Rekomendasi Penyesuaian Harga
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-24 flex items-center justify-center text-sm text-muted-foreground">
            Memuat rekomendasi...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (recommendations.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-indigo-500" />
            Rekomendasi Penyesuaian Harga
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center mb-3">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            </div>
            <p className="font-medium text-emerald-700">Semua harga jual sudah optimal</p>
            <p className="text-sm text-muted-foreground mt-1">Margin keuntungan Anda aman.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-orange-200 shadow-sm">
      <CardHeader className="pb-3 bg-orange-50/50 rounded-t-xl">
        <CardTitle className="text-lg font-semibold flex items-center gap-2 text-orange-800">
          <AlertCircle className="h-5 w-5 text-orange-500" />
          Rekomendasi Penyesuaian Harga
        </CardTitle>
        <CardDescription className="text-orange-700/80">
          Terdapat {recommendations.length} produk yang harga jualnya di bawah target margin masing-masing.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y max-h-[400px] overflow-y-auto">
          {recommendations.map((item) => (
            <RecommendationRow
              key={item.id}
              item={item}
              state={getRowState(item.id)}
              onApply={(price) => handleApply(item, price)}
              onStartCustom={() => setRowState(item.id, { kind: "customInput", input: "" })}
              onCustomInputChange={(input) =>
                setRowState(item.id, { kind: "customInput", input })
              }
              onCustomConfirm={(input) => handleCustomConfirm(item, input)}
              onCustomCancel={() => setRowState(item.id, { kind: "default" })}
              onDismiss={() => handleDismiss(item)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface RecommendationRowProps {
  item: Recommendation;
  state: RowState;
  onApply: (price: number) => void;
  onStartCustom: () => void;
  onCustomInputChange: (input: string) => void;
  onCustomConfirm: (input: string) => void;
  onCustomCancel: () => void;
  onDismiss: () => void;
}

function RecommendationRow({
  item,
  state,
  onApply,
  onStartCustom,
  onCustomInputChange,
  onCustomConfirm,
  onCustomCancel,
  onDismiss,
}: RecommendationRowProps) {
  // Hooks must run unconditionally; pass an empty string when not in customInput mode.
  const inputValue = state.kind === "customInput" ? state.input : "";
  const debouncedInput = useDebouncedValue(inputValue, 300);

  const isSubmitting = state.kind === "submitting";
  const submittingAction = isSubmitting ? state.action : null;

  return (
    <div className="p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4 hover:bg-slate-50 transition-colors">
      <div className="space-y-1">
        <div className="font-medium">{item.name}</div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-red-600 font-medium">{formatRupiah(item.currentPrice)}</span>
          <ArrowRight className="h-3 w-3 text-muted-foreground" />
          <span className="text-emerald-600 font-medium">
            {formatRupiah(item.rawRecommendedPrice)}
          </span>
          <span className="text-muted-foreground text-xs">/{item.unit} (Target)</span>
        </div>
      </div>

      {state.kind === "customInput" ? (
        <CustomInputPanel
          item={item}
          input={state.input}
          debouncedInput={debouncedInput}
          onInputChange={onCustomInputChange}
          onConfirm={() => onCustomConfirm(state.input)}
          onCancel={onCustomCancel}
        />
      ) : (
        <DefaultActions
          item={item}
          isSubmitting={isSubmitting}
          submittingAction={submittingAction}
          onApply={onApply}
          onStartCustom={onStartCustom}
          onDismiss={onDismiss}
        />
      )}
    </div>
  );
}

interface DefaultActionsProps {
  item: Recommendation;
  isSubmitting: boolean;
  submittingAction: RowAction | null;
  onApply: (price: number) => void;
  onStartCustom: () => void;
  onDismiss: () => void;
}

function DefaultActions({
  item,
  isSubmitting,
  submittingAction,
  onApply,
  onStartCustom,
  onDismiss,
}: DefaultActionsProps) {
  const showSecondaryUp =
    item.recommendedPriceDown !== item.recommendedPriceUp &&
    item.recommendedPriceDown > item.currentPrice;

  return (
    <div className="flex flex-wrap items-center gap-2 mt-2 sm:mt-0">
      {showSecondaryUp && (
        <Button
          size="sm"
          variant="outline"
          className="shrink-0 border-slate-300 text-slate-700 hover:bg-slate-100"
          onClick={() => onApply(item.recommendedPriceDown)}
          disabled={isSubmitting}
        >
          Terapkan {formatRupiah(item.recommendedPriceDown)}
        </Button>
      )}
      <Button
        size="sm"
        variant="outline"
        className="shrink-0 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
        onClick={() => onApply(item.recommendedPriceUp)}
        disabled={isSubmitting}
      >
        {submittingAction === "apply" ? (
          <span className="flex items-center gap-1">
            <Loader2 className="h-4 w-4 animate-spin" />
            Terapkan
          </span>
        ) : (
          <>Terapkan {formatRupiah(item.recommendedPriceUp)}</>
        )}
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="shrink-0 border-amber-200 text-amber-700 hover:bg-amber-50"
        onClick={onStartCustom}
        disabled={isSubmitting}
      >
        {submittingAction === "custom" ? (
          <span className="flex items-center gap-1">
            <Loader2 className="h-4 w-4 animate-spin" />
            Harga Kustom
          </span>
        ) : (
          "Harga Kustom"
        )}
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="shrink-0 border-slate-200 text-slate-600 hover:bg-slate-100"
        onClick={onDismiss}
        disabled={isSubmitting}
      >
        {submittingAction === "dismiss" ? (
          <span className="flex items-center gap-1">
            <Loader2 className="h-4 w-4 animate-spin" />
            Tetap di Harga Ini
          </span>
        ) : (
          "Tetap di Harga Ini"
        )}
      </Button>
    </div>
  );
}

interface CustomInputPanelProps {
  item: Recommendation;
  input: string;
  debouncedInput: string;
  onInputChange: (input: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

function CustomInputPanel({
  item,
  input,
  debouncedInput,
  onInputChange,
  onConfirm,
  onCancel,
}: CustomInputPanelProps) {
  const previewMargin = computePreviewMargin(debouncedInput, item.minSellingPrice);

  return (
    <div className="flex flex-col gap-2 w-full sm:w-auto sm:min-w-[260px]">
      <Input
        type="number"
        inputMode="numeric"
        step={50}
        min={item.minSellingPrice}
        value={input}
        onChange={(e) => onInputChange(e.target.value)}
        placeholder={`Min ${formatRupiah(item.minSellingPrice)}`}
        className="h-9"
      />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Min: {formatRupiah(item.minSellingPrice)}</span>
        <span>
          Margin: <span className="font-medium text-slate-700">{previewMargin}%</span>
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          className="shrink-0"
          onClick={onConfirm}
        >
          Konfirmasi
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0"
          onClick={onCancel}
        >
          Batal
        </Button>
      </div>
    </div>
  );
}

function computePreviewMargin(debouncedInput: string, minSellingPrice: number): string {
  const trimmed = debouncedInput.trim();
  if (trimmed === "") return "0.00";

  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || `${parsed}` !== trimmed) return "0.00";
  if (parsed === minSellingPrice) return "0.00";
  if (minSellingPrice <= 0) return "0.00";

  try {
    const margin = calculateRetailMarginFromCustomPrice(parsed, minSellingPrice);
    if (!Number.isFinite(margin) || margin < 0) return "0.00";
    return margin.toFixed(2);
  } catch {
    return "0.00";
  }
}
