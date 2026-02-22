import { useState, useEffect, useCallback, useRef } from "react";

// Online status hook
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Initial status
    if (typeof window !== "undefined") {
      setIsOnline(navigator.onLine);
    }

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}

// Online status with additional metadata
export function useOnlineStatusDetailed(): {
  isOnline: boolean;
  wasOffline: boolean;
  lastOnlineTime: number | null;
  offlineDuration: number | null;
} {
  const [isOnline, setIsOnline] = useState(true);
  const [wasOffline, setWasOffline] = useState(false);
  const [lastOnlineTime, setLastOnlineTime] = useState<number | null>(null);
  const offlineStartRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const initialStatus = navigator.onLine;
      setIsOnline(initialStatus);
      setLastOnlineTime(initialStatus ? Date.now() : null);
    }

    const handleOnline = () => {
      const now = Date.now();
      setIsOnline(true);
      setLastOnlineTime(now);

      if (offlineStartRef.current) {
        const duration = now - offlineStartRef.current;
        // Store offline duration for analytics if needed
        console.debug(`Was offline for ${Math.round(duration / 1000)}s`);
        setWasOffline(true);
        // Reset wasOffline after 5 seconds
        setTimeout(() => setWasOffline(false), 5000);
      }

      offlineStartRef.current = null;
    };

    const handleOffline = () => {
      setIsOnline(false);
      offlineStartRef.current = Date.now();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const offlineDuration = offlineStartRef.current ? Date.now() - offlineStartRef.current : null;

  return { isOnline, wasOffline, lastOnlineTime, offlineDuration };
}

// Sync status hook - gets real pending count from Service Worker BackgroundSyncQueue
export function useSyncStatus() {
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);

  const getQueueSize = useCallback(async (): Promise<number> => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !navigator.serviceWorker.controller) {
      return 0;
    }

    const controller = navigator.serviceWorker.controller;
    if (!controller) return 0;

    return new Promise((resolve) => {
      const channel = new MessageChannel();
      channel.port1.onmessage = (event) => {
        resolve(event.data?.pendingCount || 0);
      };
      controller.postMessage({ type: "GET_QUEUE_SIZE" }, [channel.port2]);
    });
  }, []);

  const refreshStatus = useCallback(async () => {
    const count = await getQueueSize();
    setPendingCount(count);
    setIsSyncing(false);
    setLastSyncTime(Date.now());
  }, [getQueueSize]);

  useEffect(() => {
    refreshStatus();

    const intervalId = setInterval(() => {
      getQueueSize().then((count) => {
        setPendingCount(count);
      });
    }, 5000);

    const handleOnline = () => {
      refreshStatus();
    };
    window.addEventListener("online", handleOnline);

    const handleSync = () => {
      refreshStatus();
    };
    window.addEventListener("sync-mutations", handleSync);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("sync-mutations", handleSync);
    };
  }, [refreshStatus, getQueueSize]);

  return {
    pendingCount,
    isSyncing,
    lastSyncTime,
    refreshStatus,
  };
}

// Combined hook for offline-first UI
export function useOfflineFirst() {
  const onlineStatus = useOnlineStatusDetailed();
  const syncStatus = useSyncStatus();

  return {
    ...onlineStatus,
    ...syncStatus,
    hasPendingSync: syncStatus.pendingCount > 0,
  };
}
