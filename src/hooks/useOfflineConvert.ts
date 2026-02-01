
import { useQueryClient } from '@tanstack/react-query';
import { queueCreate } from '@/lib/mutation-queue';
import { useOfflineMutation } from '@/hooks/useOfflineMutation';

interface ConvertPayload {
  sourceProductId: string;
  quantity: number;
}

interface ConvertResponse {
  id: string;
  message: string;
  details?: {
    target: string;
    targetId: string;
  };
}

export function useOfflineConvert() {
  const queryClient = useQueryClient();

  const convertMutation = useOfflineMutation<ConvertResponse, Error, ConvertPayload, unknown>({
    mutationFn: async (payload) => {
        const res = await fetch('/api/inventory/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Gagal mengkonversi');
      }
      return res.json();
    },
    offlineFn: (payload) => queueCreate('/api/inventory/convert', payload as unknown as Record<string, unknown>),
    successMessage: 'Berhasil mengkonversi', // We can't customize this easily with dynamic string in the generic hook yet, but fits 80% case
    offlineMessage: 'Konversi diantrikan! Akan disinkronkan saat koneksi kembali.',
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      await queryClient.invalidateQueries({ queryKey: ['stock-analytics'] });
    }
  });

  return { 
    convert: convertMutation.mutateAsync, 
    isOnline: !!convertMutation.context,
    isLoading: convertMutation.isPending 
  };
}
