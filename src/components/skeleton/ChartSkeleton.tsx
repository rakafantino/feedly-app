import { Skeleton } from "@/components/ui/skeleton";

interface ChartSkeletonProps {
  height?: string;
  showLegend?: boolean;
}

/**
 * ChartSkeleton - Skeleton for chart components
 * 
 * Usage:
 * <ChartSkeleton height="300px" showLegend />
 */
export function ChartSkeleton({
  height = "300px",
  showLegend = false,
}: ChartSkeletonProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col space-y-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div 
        className="border rounded-lg flex items-center justify-center bg-muted/20" 
        style={{ height }}
      >
        <div className="flex flex-col items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
      {showLegend && (
        <div className="flex gap-4 justify-center">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-3 w-3 rounded-full" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * PieChartSkeleton - Skeleton for pie/donut charts
 */
export function PieChartSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col space-y-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="flex items-center justify-center gap-8">
        <Skeleton className="h-[250px] w-[250px] rounded-full" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-3 w-3 rounded-full" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * BarChartSkeleton - Skeleton for bar charts
 */
export function BarChartSkeleton({
  height = "300px",
}: ChartSkeletonProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col space-y-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div 
        className="border rounded-lg p-4 bg-muted/20" 
        style={{ height }}
      >
        <div className="flex items-end justify-between h-full gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex-1 flex flex-col justify-end items-center gap-2">
              <Skeleton 
                className="w-full rounded-t" 
                style={{ height: `${30 + Math.random() * 60}%` }} 
              />
              <Skeleton className="h-3 w-8" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * LineChartSkeleton - Skeleton for line/area charts
 */
export function LineChartSkeleton({
  height = "250px",
}: ChartSkeletonProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col space-y-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div 
        className="border rounded-lg bg-muted/20 relative overflow-hidden" 
        style={{ height }}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <Skeleton className="h-20 w-3/4 rounded" />
        </div>
      </div>
    </div>
  );
}

/**
 * TableListSkeleton - Skeleton for table-based lists
 */
export function TableListSkeleton({
  rowCount = 5,
}: {
  rowCount?: number;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col space-y-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: rowCount }).map((_, i) => (
          <div key={i} className="flex items-center justify-between border rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <Skeleton className="h-6 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
