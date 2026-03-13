import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

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

export function usePurchaseOrder() {
  const queryClient = useQueryClient();

  const createMutation = useMutation<PurchaseOrderResponse, Error, PurchaseOrderPayload>({
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
    onSuccess: async () => {
      toast.success("Purchase Order berhasil dibuat");
      await queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      await queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  const payMutation = useMutation<PurchaseOrderResponse, Error, { id: string; amount: number }>({
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
    onSuccess: async () => {
      toast.success("Pembayaran PO berhasil");
      await queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  return {
    createPO: createMutation.mutateAsync,
    payPO: (id: string, amount: number) => payMutation.mutateAsync({ id, amount }),
    isLoading: createMutation.isPending || payMutation.isPending,
  };
}
