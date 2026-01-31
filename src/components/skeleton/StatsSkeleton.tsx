import { Skeleton } from "@/components/ui/skeleton";

interface StatsSkeletonProps {
  count?: number;
  variant?: "default" | "compact";
}

/**
 * StatsSkeleton - Reusable skeleton for stats summary cards
 * 
 * Usage:
 * <StatsSkeleton count={4} />
 * <StatsSkeleton count={4} variant="compact" />
 */
export function StatsSkeleton({
  count = 4,
  variant = "default",
}: StatsSkeletonProps) {
  if (variant === "compact") {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Skeleton className="h-5 w-5 rounded-full" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="h-7 w-20" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="border rounded-lg p-6 space-y-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-3 w-40" />
        </div>
      ))}
    </div>
  );
}
