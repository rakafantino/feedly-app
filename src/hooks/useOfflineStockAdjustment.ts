import { useQueryClient } from "@tanstack/react-query";
import { useOfflineMutation } from "@/hooks/useOfflineMutation";

interface StockAdjustmentPayload {
  storeId: string;
  productId: string;
  batchId: string | null;
  quantity: number;
  type: string;
  reason: string;
}

interface StockAdjustmentResponse {
  id: string;
  message: string;
}

interface ProductData {
  products: any[];
  pagination?: {
    totalItems: number;
  };
}

export function useOfflineStockAdjustment() {
  const queryClient = useQueryClient();

  const adjustMutation = useOfflineMutation<StockAdjustmentResponse, Error, StockAdjustmentPayload, unknown>({
    mutationFn: async (payload) => {
      const res = await fetch("/api/inventory/adjustment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Gagal menyimpan penyesuaian");
      }
      return res.json();
    },
    successMessage: "Penyesuaian stok berhasil disimpan",
    offlineMessage: "Penyesuaian stok diantrikan!",
    onOfflineSuccess: (payload) => {
      queryClient.setQueriesData({ queryKey: ["products"] }, (oldData: ProductData | undefined) => {
        if (!oldData || !oldData.products) return oldData;
        const adjustmentQty = payload.type === "ADD" ? payload.quantity : -payload.quantity;
        return {
          ...oldData,
          products: oldData.products.map((product) => {
            if (product.id === payload.productId) {
              return {
                ...product,
                stock: Math.max(0, (product.stock || 0) + adjustmentQty),
              };
            }
            return product;
          }),
        };
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      await queryClient.invalidateQueries({ queryKey: ["stock-analytics"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });

  return {
    adjust: adjustMutation.mutateAsync,
    isOnline: !!adjustMutation.context,
    isLoading: adjustMutation.isPending,
  };
}
