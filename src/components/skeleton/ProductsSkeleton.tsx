import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton } from "./TableSkeleton";

export function ProductsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-3">
        <Skeleton className="h-8 w-[250px]" />
        <Skeleton className="h-4 w-[350px]" />
      </div>
      
      <div className="flex items-center justify-between">
        <div className="flex w-full max-w-sm items-center space-x-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-24" />
        </div>
        <Skeleton className="h-10 w-36" />
      </div>
      
      <TableSkeleton columnCount={6} rowCount={8} />
      
      <div className="flex items-center justify-center">
        <Skeleton className="h-8 w-72" />
      </div>
    </div>
  );
} 