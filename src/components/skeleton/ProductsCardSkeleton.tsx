import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardFooter } from "@/components/ui/card";

export function ProductsCardSkeleton() {
  // Buat array skeleton cards
  const skeletonCards = Array.from({ length: 4 }, (_, i) => i);

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-3">
        <Skeleton className="h-8 w-[250px]" />
        <Skeleton className="h-4 w-[350px]" />
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {skeletonCards.map((index) => (
          <Card key={index} className="h-full">
            <CardContent className="pt-6">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <Skeleton className="h-5 w-[180px] mb-2" />
                  <Skeleton className="h-4 w-full max-w-[240px]" />
                </div>
                <Skeleton className="h-6 w-16 ml-2" />
              </div>
              
              <div className="mt-4 flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-20" />
              </div>
            </CardContent>
            
            <CardFooter className="border-t p-3 flex gap-2">
              <Skeleton className="h-9 flex-1" />
              <Skeleton className="h-9 flex-1" />
            </CardFooter>
          </Card>
        ))}
      </div>
      
      <div className="flex items-center justify-center">
        <Skeleton className="h-8 w-72" />
      </div>
    </div>
  );
} 