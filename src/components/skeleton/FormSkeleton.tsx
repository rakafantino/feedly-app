import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";

interface FormSkeletonProps {
  fields?: number;
  title?: boolean;
  description?: boolean;
}

export function FormSkeleton({
  fields = 4,
  title = true,
  description = true,
}: FormSkeletonProps) {
  // Buat array dengan panjang fields
  const formFields = Array.from({ length: fields }, (_, i) => i);

  return (
    <Card className="w-full">
      {title && (
        <CardHeader className="space-y-2">
          <Skeleton className="h-6 w-1/3" />
          {description && <Skeleton className="h-4 w-2/3" />}
        </CardHeader>
      )}
      <CardContent className="space-y-6">
        {formFields.map((field) => (
          <div key={field} className="space-y-2">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </CardContent>
      <CardFooter className="flex justify-between">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-24" />
      </CardFooter>
    </Card>
  );
} 