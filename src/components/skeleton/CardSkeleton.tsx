import { Skeleton } from "@/components/ui/skeleton";

interface CardSkeletonProps {
  cardCount?: number;
  showHeader?: boolean;
  showFooter?: boolean;
}

/**
 * CardSkeleton - Reusable skeleton for card grids
 * 
 * Usage:
 * <CardSkeleton cardCount={6} showHeader />
 */
export function CardSkeleton({
  cardCount = 6,
  showHeader = true,
  showFooter = true,
}: CardSkeletonProps) {
  return (
    <div className="space-y-4">
      {showHeader && (
        <div className="flex flex-col space-y-3">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
      )}
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: cardCount }).map((_, i) => (
          <div key={i} className="border rounded-lg p-4 space-y-3">
            {/* Card Header */}
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-16" />
            </div>
            
            {/* Card Body */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
            
            {/* Card Footer */}
            {showFooter && (
              <div className="pt-2 border-t flex justify-between items-center">
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-9 w-24" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
