// useStockAlerts.ts
// React Query hook for stock alerts - replaces manual fetch with caching

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { StockNotification } from '@/lib/notificationService';

export function useStockAlerts(storeId: string | null) {
  return useQuery({
    queryKey: ['stockAlerts', storeId],
    queryFn: async (): Promise<{ notifications: StockNotification[] }> => {
      const url = new URL('/api/stock-alerts', window.location.origin);
      if (storeId) {
        url.searchParams.append('storeId', String(storeId));
      }
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Failed to fetch notifications');
      }

      return response.json();
    },
    enabled: !!storeId,
    staleTime: 30 * 1000, // Consider data fresh for 30 seconds
    refetchOnWindowFocus: true,
  });
}

export function useRefreshStockAlerts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ storeId, forceCheck }: { storeId: string | null; forceCheck?: boolean }) => {
      const response = await fetch('/api/stock-alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          storeId,
          forceCheck: forceCheck ?? true
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to refresh stock alerts');
      }
      
      return response.json();
    },
    onSuccess: (_, variables) => {
      // Invalidate and refetch after successful refresh
      queryClient.invalidateQueries({ queryKey: ['stockAlerts', variables.storeId] });
    },
  });
}

export function useMarkStockAlertAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ storeId, notificationId }: { storeId: string | null; notificationId: string }) => {
      const url = new URL('/api/stock-alerts', window.location.origin);
      url.searchParams.append('action', 'markAsRead');
      url.searchParams.append('id', notificationId);
      if (storeId) {
        url.searchParams.append('storeId', String(storeId));
      }
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Failed to mark notification as read');
      }

      return response.json();
    },
    onMutate: async ({ storeId, notificationId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['stockAlerts', storeId] });

      // Snapshot previous value
      const previousNotifications = queryClient.getQueryData(['stockAlerts', storeId]);

      // Optimistically update to mark as read
      queryClient.setQueryData(['stockAlerts', storeId], (old: { notifications: StockNotification[] } | undefined) => {
        if (!old?.notifications) return old;
        return {
          notifications: old.notifications.map(n =>
            n.id === notificationId ? { ...n, read: true } : n
          )
        };
      });

      return { previousNotifications };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousNotifications) {
        queryClient.setQueryData(['stockAlerts', variables.storeId], context.previousNotifications);
      }
    },
    onSettled: (_, __, variables) => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: ['stockAlerts', variables.storeId] });
    },
  });
}

export function useMarkAllStockAlertsAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ storeId }: { storeId: string | null }) => {
      const url = new URL('/api/stock-alerts', window.location.origin);
      url.searchParams.append('action', 'markAllAsRead');
      if (storeId) {
        url.searchParams.append('storeId', String(storeId));
      }
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Failed to mark all notifications as read');
      }

      return response.json();
    },
    onMutate: async ({ storeId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['stockAlerts', storeId] });

      // Snapshot previous value
      const previousNotifications = queryClient.getQueryData(['stockAlerts', storeId]);

      // Optimistically update to mark all as read
      queryClient.setQueryData(['stockAlerts', storeId], (old: { notifications: StockNotification[] } | undefined) => {
        if (!old?.notifications) return old;
        return {
          notifications: old.notifications.map(n => ({ ...n, read: true }))
        };
      });

      return { previousNotifications };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousNotifications) {
        queryClient.setQueryData(['stockAlerts', variables.storeId], context.previousNotifications);
      }
    },
    onSettled: (_, __, variables) => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: ['stockAlerts', variables.storeId] });
    },
  });
}

export function useDismissStockAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ storeId, notificationId }: { storeId: string | null; notificationId: string }) => {
      const url = new URL('/api/stock-alerts', window.location.origin);
      url.searchParams.append('action', 'dismiss');
      url.searchParams.append('notificationId', notificationId);
      if (storeId) {
        url.searchParams.append('storeId', String(storeId));
      }
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Failed to dismiss notification');
      }

      return response.json();
    },
    onMutate: async ({ storeId, notificationId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['stockAlerts', storeId] });

      // Snapshot previous value
      const previousNotifications = queryClient.getQueryData(['stockAlerts', storeId]);

      // Optimistically update to remove the notification
      queryClient.setQueryData(['stockAlerts', storeId], (old: { notifications: StockNotification[] } | undefined) => {
        if (!old?.notifications) return old;
        return {
          notifications: old.notifications.filter(n => n.id !== notificationId)
        };
      });

      return { previousNotifications };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousNotifications) {
        queryClient.setQueryData(['stockAlerts', variables.storeId], context.previousNotifications);
      }
    },
    onSettled: (_, __, variables) => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: ['stockAlerts', variables.storeId] });
    },
  });
}

export function useDismissAllStockAlerts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ storeId }: { storeId: string | null }) => {
      const url = new URL('/api/stock-alerts', window.location.origin);
      url.searchParams.append('action', 'dismissAll');
      if (storeId) {
        url.searchParams.append('storeId', String(storeId));
      }
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Failed to dismiss all notifications');
      }

      return response.json();
    },
    onMutate: async ({ storeId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['stockAlerts', storeId] });

      // Snapshot previous value
      const previousNotifications = queryClient.getQueryData(['stockAlerts', storeId]);

      // Optimistically update to clear all notifications
      queryClient.setQueryData(['stockAlerts', storeId], () => {
        return {
          notifications: []
        };
      });

      return { previousNotifications };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousNotifications) {
        queryClient.setQueryData(['stockAlerts', variables.storeId], context.previousNotifications);
      }
    },
    onSettled: (_, __, variables) => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: ['stockAlerts', variables.storeId] });
    },
  });
}
