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
            staleTime: 30 * 1000, // Data considered fresh for 30 seconds
            refetchOnWindowFocus: true, // Refetch when user returns to tab for fresh data
            retry: 1, // Retry failed requests once
            gcTime: 1000 * 60 * 30, // Keep unused data for 30 minutes (was 24h)
          },
        },
      })
  );

  // Create persister only on client side
  const [queryPersister] = useState(() => {
    if (typeof window === 'undefined') return undefined;
    return createQueryPersister('feedly-query-cache');
  });

  // If we are on server, we can't use persistence, but we still need to provide the client
  // The PersistQueryClientProvider handles undefined persister gracefully (acts as normal provider)
  
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: queryPersister! }} // Force type, but it handles undefined at runtime if needed, or we should provide a dummy?
      onSuccess={() => {
        console.debug('Query cache restored from offline storage');
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
