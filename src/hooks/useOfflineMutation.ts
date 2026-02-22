import { useMutation, UseMutationOptions, UseMutationResult } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

export interface UseOfflineMutationOptions<TData, TError, TVariables, TContext> 
  extends Omit<UseMutationOptions<TData | string, TError, TVariables, TContext>, 'mutationFn' | 'onSuccess' | 'onError'> {
  mutationFn: (variables: TVariables) => Promise<TData>;
  successMessage?: string;
  offlineMessage?: string;
  onOfflineSuccess?: (variables: TVariables) => void | Promise<void>;
  onSuccess?: (data: TData | string, variables: TVariables, context: TContext) => void | Promise<void>;
  onError?: (error: TError, variables: TVariables, context: TContext | undefined) => void;
}

export function useOfflineMutation<TData, TError, TVariables, TContext = unknown>(
  options: UseOfflineMutationOptions<TData, TError, TVariables, TContext>
): UseMutationResult<TData | string, TError, TVariables, TContext> {
  const isOnline = useOnlineStatus();

  return useMutation<TData | string, TError, TVariables, TContext>({
    ...options,
    mutationFn: async (variables) => {
      try {
        // Execute directly. If offline, the Service Worker (BackgroundSyncPlugin)
        // will intercept it, queue it, and the fetch below will throw a TypeError.
        const result = await options.mutationFn(variables);
        return result;
      } catch (error) {
        // If the error is a TypeError with 'Failed to fetch', it's likely a network error
        // intercept by Background Sync, or if we are actively offline.
        const isNetworkError = error instanceof TypeError && error.message.includes('Failed to fetch');
        if (!isOnline || isNetworkError) {
           return 'OFFLINE_QUEUED';
        }
        throw error;
      }
    },
    onSuccess: async (data, variables, context) => {
      // Handle Toasts
      if (data === 'OFFLINE_QUEUED') {
        // Offline Case
        const msg = options.offlineMessage || 'Transaksi diantrikan!';
        toast.success(msg, {
          description: 'Akan disinkronkan otomatis saat koneksi kembali.'
        });
        if (options.onOfflineSuccess) {
           await options.onOfflineSuccess(variables);
        }
      } else {
        // Online Case
        if (options.successMessage) {
          toast.success(options.successMessage);
        }
      }

      // Forward to original onSuccess
      if (options.onSuccess) {
        await options.onSuccess(data, variables, context);
      }
    },
    onError: (error, variables, context) => {
       if (options.onError) {
          options.onError(error, variables, context);
       } else {
          toast.error(error instanceof Error ? error.message : 'Terjadi kesalahan');
       }
    }
  });
}
