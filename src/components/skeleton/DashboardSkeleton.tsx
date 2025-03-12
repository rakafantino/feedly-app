import { Skeleton } from "@/components/ui/skeleton";
import { DashboardCardsSkeleton } from "./CardSkeleton";
import { TableSkeleton } from "./TableSkeleton";

export function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col space-y-3">
        <Skeleton className="h-8 w-[250px]" />
        <Skeleton className="h-4 w-[300px]" />
      </div>
      
      <DashboardCardsSkeleton />
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        {/* Chart area */}
        <div className="col-span-4 space-y-4">
          <div className="flex flex-col space-y-3">
            <Skeleton className="h-6 w-[120px]" />
            <Skeleton className="h-4 w-[180px]" />
          </div>
          <Skeleton className="h-[300px] w-full rounded-xl" />
        </div>
        
        {/* Recent transactions */}
        <div className="col-span-3 space-y-4">
          <div className="flex flex-col space-y-3">
            <Skeleton className="h-6 w-[150px]" />
            <Skeleton className="h-4 w-[200px]" />
          </div>
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-[150px]" />
                    <Skeleton className="h-3 w-[100px]" />
                  </div>
                </div>
                <Skeleton className="h-4 w-[80px]" />
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Recent products table */}
      <div className="space-y-4">
        <div className="flex flex-col space-y-3">
          <Skeleton className="h-6 w-[200px]" />
          <Skeleton className="h-4 w-[300px]" />
        </div>
        <TableSkeleton rowCount={3} columnCount={4} />
      </div>
    </div>
  );
} 