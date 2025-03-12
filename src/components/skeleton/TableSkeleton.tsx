import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface TableSkeletonProps {
  columnCount?: number;
  rowCount?: number;
  hasAction?: boolean;
}

export function TableSkeleton({
  columnCount = 5,
  rowCount = 5,
  hasAction = true,
}: TableSkeletonProps) {
  // Buat array dengan panjang rowCount
  const rows = Array.from({ length: rowCount }, (_, i) => i);
  // Buat array dengan panjang columnCount, tambahkan kolom aksi jika diperlukan
  const columns = Array.from(
    { length: hasAction ? columnCount + 1 : columnCount },
    (_, i) => i
  );

  return (
    <div className="w-full border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead key={`head-${col}`}>
                <Skeleton className="h-6 w-full max-w-[100px]" />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={`row-${row}`}>
              {columns.map((col) => (
                <TableCell key={`cell-${row}-${col}`}>
                  {col === columns.length - 1 && hasAction ? (
                    <div className="flex space-x-2">
                      <Skeleton className="h-8 w-8" />
                      <Skeleton className="h-8 w-8" />
                    </div>
                  ) : (
                    <Skeleton className="h-5 w-full" />
                  )}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
} 