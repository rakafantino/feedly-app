"use client";

import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { useState } from "react";
import { createQueryPersister } from "@/lib/query-persist";

const OFFLINE_CACHE_MAX_AGE = 1000 * 60 * 60 * 24; // 24 hours - max age for cached data in IndexedDB

export default function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000, // Data considered fresh for 30 seconds
            refetchOnWindowFocus: true, // Refetch when user returns to tab for fresh data
            retry: 1, // Retry failed requests once
            gcTime: 1000 * 60 * 60 * 24, // Keep unused data for 24 hours for offline-first support
          },
        },
      }),
  );

  // Create persister only on client side
  const [queryPersister] = useState(() => {
    if (typeof window === "undefined") return undefined;
    return createQueryPersister("feedly-query-cache");
  });

  // If we are on server, we can't use persistence, but we still need to provide the client
  // The PersistQueryClientProvider handles undefined persister gracefully (acts as normal provider)

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: queryPersister!,
        maxAge: OFFLINE_CACHE_MAX_AGE, // Cache data in IndexedDB for up to 24 hours
        buster: "",
      }}
      onSuccess={() => {
        console.debug("Query cache restored from offline storage");
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
