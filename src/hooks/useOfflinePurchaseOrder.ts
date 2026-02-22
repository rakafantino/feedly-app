import { useQueryClient } from "@tanstack/react-query";
import { useOfflineMutation } from "@/hooks/useOfflineMutation";

interface PurchaseOrderPayload {
  supplierId: string;
  notes?: string;
  items: Array<{
    productId: string;
    quantity: number;
    unit: string;
    price: number;
  }>;
  amountPaid?: number;
  paymentStatus?: string;
}

interface PurchaseOrderResponse {
  id: string;
  invoice_number: string;
  message: string;
}

interface PurchaseOrderData {
  purchaseOrders: PurchaseOrderResponse[];
  pagination?: {
    totalItems: number;
  };
}

export function useOfflinePurchaseOrder() {
  const queryClient = useQueryClient();

  const createMutation = useOfflineMutation<PurchaseOrderResponse, Error, PurchaseOrderPayload, unknown>({
    mutationFn: async (payload) => {
      const normalizedPayload = {
        ...payload,
        items: payload.items.map((item) => ({
          ...item,
          quantity: Number(item.quantity),
          price: Number(item.price),
        })),
      };

      const res = await fetch("/api/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(normalizedPayload),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Gagal membuat Purchase Order");
      }
      return res.json();
    },
    successMessage: "Purchase Order berhasil dibuat",
    offlineMessage: "Purchase Order diantrikan! Akan disinkronkan saat koneksi kembali.",
    onOfflineSuccess: (payload) => {
      queryClient.setQueriesData({ queryKey: ["purchase-orders"] }, (oldData: PurchaseOrderData | undefined) => {
        if (!oldData || !oldData.purchaseOrders) return oldData;
        const tempPO = {
          id: "temp-" + Date.now().toString(),
          invoice_number: "PENDING-" + Date.now().toString(),
          message: "Menunggu sinkronisasi",
          ...payload,
          status: "PENDING",
          createdAt: new Date().toISOString(),
        };
        return {
          ...oldData,
          purchaseOrders: [tempPO, ...oldData.purchaseOrders],
          pagination: {
            ...oldData.pagination,
            totalItems: (oldData.pagination?.totalItems || 0) + 1,
          },
        };
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      await queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
  });

  const payMutation = useOfflineMutation<PurchaseOrderResponse, Error, { id: string; amount: number }, unknown>({
    mutationFn: async ({ id, amount }) => {
      const res = await fetch(`/api/purchase-orders/${id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Gagal membayar Purchase Order");
      }
      return res.json();
    },
    successMessage: "Pembayaran PO berhasil",
    offlineMessage: "Pembayaran PO diantrikan!",
    onOfflineSuccess: ({ id, amount }) => {
      queryClient.setQueriesData({ queryKey: ["purchase-orders"] }, (oldData: PurchaseOrderData | undefined) => {
        if (!oldData || !oldData.purchaseOrders) return oldData;
        return {
          ...oldData,
          purchaseOrders: oldData.purchaseOrders.map((po) => (po.id === id ? { ...po, amountPaid: (po as any).amountPaid + amount } : po)),
        };
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
    },
  });

  return {
    createPO: createMutation.mutateAsync,
    payPO: (id: string, amount: number) => payMutation.mutateAsync({ id, amount }),
    isOnline: !!createMutation.context,
    isLoading: createMutation.isPending || payMutation.isPending,
  };
}
