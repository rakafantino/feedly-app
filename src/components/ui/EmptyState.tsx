// EmptyState.tsx
// Reusable empty state component for when there's no data

"use client";

import { FileText, Inbox, Loader2 } from "lucide-react";

interface EmptyStateProps {
  isLoading?: boolean;
  isEmpty?: boolean;
  loadingText?: string;
  emptyText?: string;
  emptyDescription?: string;
  icon?: "file" | "inbox" | "custom";
  customIcon?: React.ReactNode;
  action?: React.ReactNode;
}

/**
 * EmptyState - Reusable component for loading and empty states
 * 
 * Usage Examples:
 * 
 * // Basic usage
 * <EmptyState isLoading={loading} isEmpty={data.length === 0} />
 * 
 * // Custom text
 * <EmptyState 
 *   isLoading={loading} 
 *   isEmpty={data.length === 0}
 *   loadingText="Memuat data..."
 *   emptyText="Tidak ada produk"
 *   emptyDescription="Tambahkan produk baru untuk memulai"
 * />
 * 
 * // With action button
 * <EmptyState 
 *   isEmpty={data.length === 0}
 *   emptyText="Belum ada pesanan"
 *   action={<Button>Tambah Pesanan</Button>}
 * />
 */
export function EmptyState({
  isLoading = false,
  isEmpty = false,
  loadingText = "Memuat data...",
  emptyText = "Tidak ada data",
  emptyDescription,
  icon = "inbox",
  customIcon,
  action,
}: EmptyStateProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>{loadingText}</span>
        </div>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="mb-4">
          {customIcon || (
            <div className="p-3 bg-muted rounded-full">
              {icon === "file" ? (
                <FileText className="h-6 w-6 text-muted-foreground" />
              ) : (
                <Inbox className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
          )}
        </div>
        <p className="text-muted-foreground font-medium">{emptyText}</p>
        {emptyDescription && (
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            {emptyDescription}
          </p>
        )}
        {action && (
          <div className="mt-4">
            {action}
          </div>
        )}
      </div>
    );
  }

  return null;
}
