"use client";

import { useOnlineStatus, useSyncStatus } from "@/hooks/useOnlineStatus";
import { WifiOff, RefreshCw, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const { pendingCount, refreshStatus } = useSyncStatus();
  const [showSyncedMessage, setShowSyncedMessage] = useState(false);

  useEffect(() => {
    if (isOnline && pendingCount === 0) {
      setShowSyncedMessage(true);
      const timer = setTimeout(() => setShowSyncedMessage(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, pendingCount]);

  if (isOnline && pendingCount === 0 && !showSyncedMessage) {
    return null;
  }

  return (
    <div
      className={`
        fixed top-0 left-0 right-0 z-50 px-4 py-2 
        flex items-center justify-between gap-4
        transition-all duration-300
        ${!isOnline ? "bg-amber-500 text-white" : pendingCount > 0 ? "bg-blue-500 text-white" : "bg-green-500 text-white"}
      `}
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        {!isOnline ? (
          <>
            <WifiOff className="h-4 w-4" />
            <span>Anda Sedang Offline - Transaksi akan diantrikan</span>
          </>
        ) : pendingCount > 0 ? (
          <>
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Menyinkronkan {pendingCount} transaksi...</span>
          </>
        ) : showSyncedMessage ? (
          <>
            <CheckCircle className="h-4 w-4" />
            <span>Semua transaksi telah disinkronkan</span>
          </>
        ) : null}
      </div>

      {pendingCount > 0 && isOnline && (
        <Button variant="outline" size="sm" onClick={() => refreshStatus()} className="bg-white/20 hover:bg-white/30 text-white border-white/40 text-xs h-7">
          <RefreshCw className="h-3 w-3 mr-1" />
          Refresh
        </Button>
      )}

      {!isOnline && (
        <Button variant="outline" size="sm" onClick={() => window.location.reload()} className="bg-white/20 hover:bg-white/30 text-white border-white/40 text-xs h-7">
          Coba Lagi
        </Button>
      )}
    </div>
  );
}
