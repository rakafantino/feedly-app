
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist, NetworkOnly } from "serwist";


// This declares the value of `injectionPoint` to TypeScript.
// `injectionPoint` is the string that will be replaced by the actual precache manifest.
// By default, this string is set to "self.__SW_MANIFEST".
declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      matcher: ({ url }) => url.pathname.startsWith("/api/stock-alerts/stream"),
      handler: async ({ request, event, params }) => {
        try {
          const networkOnly = new NetworkOnly();
          return await networkOnly.handle({ request, event, params });
        } catch {
          // Return a 503 response instead of throwing to avoid console noise when offline
          return new Response("Offline", { status: 503, statusText: "Service Unavailable" });
        }
      },
    },
    // @ts-ignore
    ...defaultCache,
  ],
  disableDevLogs: true,
});

// Explicitly disable logs in the global scope as well
// @ts-ignore
self.__WB_DISABLE_DEV_LOGS = true;

serwist.addEventListeners();
