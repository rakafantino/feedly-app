import { Skeleton } from "@/components/ui/skeleton";

interface PageSkeletonProps {
  headerTitle?: boolean;
  headerDescription?: boolean;
  sections?: number;
  rowsPerSection?: number;
}

export function PageSkeleton({
  headerTitle = true,
  headerDescription = true,
  sections = 3,
  rowsPerSection = 4,
}: PageSkeletonProps) {
  // Buat array untuk jumlah sections
  const sectionArray = Array.from({ length: sections }, (_, i) => i);

  return (
    <div className="space-y-8">
      {headerTitle && (
        <div className="space-y-2">
          <Skeleton className="h-8 w-[200px]" />
          {headerDescription && <Skeleton className="h-4 w-[300px]" />}
        </div>
      )}

      {sectionArray.map((section) => (
        <div key={section} className="space-y-4">
          <Skeleton className="h-6 w-[180px]" />
          <div className="space-y-3">
            {Array.from({ length: rowsPerSection }, (_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
} 