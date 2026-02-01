'use client';

import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useState } from 'react';
import { createQueryPersister } from '@/lib/query-persist';

export default function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // Data considered fresh for 1 minute
            refetchOnWindowFocus: false, // Disable refetch on window focus
            retry: 1, // Retry failed requests once
            gcTime: 1000 * 60 * 60 * 24, // Keep unused data for 24 hours
          },
        },
      })
  );

  // Create persister for offline caching
  const queryPersister = createQueryPersister('feedly-query-cache');

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: queryPersister }}
      onSuccess={() => {
        // Resume mutations from queue when coming back online
        // This is handled by the mutation-queue module
        console.debug('Query cache restored from offline storage');
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
