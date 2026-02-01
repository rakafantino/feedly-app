
import { queueCreate } from '@/lib/mutation-queue';
import { useOfflineMutation } from '@/hooks/useOfflineMutation';

interface WriteOffPayload {
  transactionId: string;
  reason?: string;
}

interface WriteOffResponse {
  id: string;
  message: string;
}

export function useOfflineWriteOff() {
  const writeOffMutation = useOfflineMutation<WriteOffResponse, Error, WriteOffPayload, unknown>({
    mutationFn: async (payload) => {
      const res = await fetch(`/api/transactions/${payload.transactionId}/write-off`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: payload.reason }),
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Gagal menghapus piutang');
      }
      return res.json();
    },
    offlineFn: async (payload) => {
       return await queueCreate(
        `/api/transactions/${payload.transactionId}/write-off`,
        { reason: payload.reason }
      );
    },
    successMessage: 'Piutang berhasil dihapus (Write-Off)',
    offlineMessage: 'Penghapusan piutang diantrikan!',
  });

  return { 
    writeOff: writeOffMutation.mutateAsync, 
    isOnline: !!writeOffMutation.context,
    isLoading: writeOffMutation.isPending
  };
}
