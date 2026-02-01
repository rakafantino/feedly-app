import { useMutation, UseMutationOptions, UseMutationResult } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

// Custom options extending standard mutation options
// We explicitly modify onSuccess to accept TData | string because offline returns string
interface UseOfflineMutationOptions<TData, TError, TVariables, TContext> 
  extends Omit<UseMutationOptions<TData | string, TError, TVariables, TContext>, 'mutationFn'> {
  mutationFn: (variables: TVariables) => Promise<TData>;
  offlineFn: (variables: TVariables) => Promise<string>;
  successMessage?: string;
  offlineMessage?: string;
  onOfflineSuccess?: () => void;
}

export function useOfflineMutation<TData, TError, TVariables, TContext = unknown>(
  options: UseOfflineMutationOptions<TData, TError, TVariables, TContext>
): UseMutationResult<TData | string, TError, TVariables, TContext> {
  const isOnline = useOnlineStatus();

  return useMutation<TData | string, TError, TVariables, TContext>({
    ...options,
    mutationFn: async (variables) => {
      // 1. If Offline, Queue it
      if (!isOnline) {
        const mutationId = await options.offlineFn(variables);
        return mutationId; 
      }

      // 2. If Online, Execute directly
      try {
        const result = await options.mutationFn(variables);
        return result;
      } catch (error) {
        throw error;
      }
    },
    onSuccess: (data, variables, context) => {
      // Handle Toasts
      if (typeof data === 'string') {
        // Offline Case
        const msg = options.offlineMessage || 'Transaksi diantrikan!';
        toast.success(msg, {
          description: 'Akan disinkronkan saat koneksi kembali.'
        });
        options.onOfflineSuccess?.();
      } else {
        // Online Case
        if (options.successMessage) {
          toast.success(options.successMessage);
        }
      }

      // Forward to original onSuccess
      // options is now typed to accept TData | string
      (options.onSuccess as any)?.(data, variables, context);
    },
  });
}
