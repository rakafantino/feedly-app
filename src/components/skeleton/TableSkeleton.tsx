import { Skeleton } from "@/components/ui/skeleton";
import { TableRow, TableCell } from "@/components/ui/table";

interface TableSkeletonProps {
  columnCount?: number;
  rowCount?: number;
  showHeader?: boolean;
  headerHeight?: string;
}

/**
 * TableSkeleton - Reusable skeleton for data tables
 * 
 * Usage:
 * <TableSkeleton columnCount={5} rowCount={8} />
 */
export function TableSkeleton({
  columnCount = 5,
  rowCount = 5,
  showHeader = true,
  headerHeight = "h-4"
}: TableSkeletonProps) {
  return (
    <div className="space-y-4">
      {showHeader && (
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <Skeleton className={`${headerHeight} w-48`} />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-64" />
          </div>
        </div>
      )}
      
      <div className="rounded-md border">
        {/* Table Header */}
        <div className="border-b bg-muted/30">
          <div className="flex w-full">
            {Array.from({ length: columnCount }).map((_, i) => (
              <div key={`header-${i}`} className="flex-1 p-3">
                <Skeleton className={`${headerHeight} w-full`} />
              </div>
            ))}
          </div>
        </div>
        
        {/* Table Rows */}
        <div className="divide-y">
          {Array.from({ length: rowCount }).map((_, rowIndex) => (
            <div key={`row-${rowIndex}`} className="flex w-full">
              {Array.from({ length: columnCount }).map((_, colIndex) => (
                <div key={`cell-${rowIndex}-${colIndex}`} className="flex-1 p-3">
                  <Skeleton 
                    className={`h-4 w-full ${colIndex === columnCount - 1 ? 'w-16' : ''}`} 
                    // Make action column smaller
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      
      {/* Pagination */}
      <div className="flex items-center justify-center">
        <Skeleton className="h-8 w-48" />
      </div>
    </div>
  );
}

interface TableRowSkeletonProps {
  columnCount?: number;
  rowCount?: number;
}

/**
 * TableRowSkeleton - Reusable skeleton for data table rows
 * IMPORTANT: Use this when you are rendering a skeleton *inside* a <TableBody> 
 * to prevent hydration errors (div cannot be a child of tbody).
 */
export function TableRowSkeleton({
  columnCount = 5,
  rowCount = 5,
}: TableRowSkeletonProps) {
  return (
    <>
      {Array.from({ length: rowCount }).map((_, rowIndex) => (
        <TableRow key={`skeleton-row-${rowIndex}`}>
          {Array.from({ length: columnCount }).map((_, colIndex) => (
            <TableCell key={`skeleton-cell-${rowIndex}-${colIndex}`}>
              <Skeleton 
                className={`h-4 w-full ${colIndex === columnCount - 1 ? 'w-16' : ''}`} 
              />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}
