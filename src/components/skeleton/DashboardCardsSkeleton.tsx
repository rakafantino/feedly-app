import { Skeleton } from "@/components/ui/skeleton";

/**
 * DashboardCardsSkeleton - Skeleton for dashboard stat cards (4 cards in a row)
 */
export function DashboardCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="border rounded-lg p-6 space-y-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-3 w-40" />
        </div>
      ))}
    </div>
  );
}
