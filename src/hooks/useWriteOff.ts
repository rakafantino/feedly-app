import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

interface WriteOffPayload {
  transactionId: string;
  reason?: string;
}

interface WriteOffResponse {
  id: string;
  message: string;
}

export function useWriteOff() {
  const writeOffMutation = useMutation<WriteOffResponse, Error, WriteOffPayload>({
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
    onSuccess: () => {
      toast.success('Piutang berhasil dihapus (Write-Off)');
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  return { 
    writeOff: writeOffMutation.mutateAsync, 
    isLoading: writeOffMutation.isPending
  };
}
