import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";

export function POSSkeleton() {
  return (
    <div className="w-full grid h-[calc(100vh-7rem)] gap-4 lg:gap-5 grid-cols-1 lg:grid-cols-7 xl:grid-cols-7">
      {/* Products Grid (Left Side) */}
      <div className="lg:col-span-4 xl:col-span-5 space-y-4">
        {/* Search & Scan Section */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row items-center gap-2">
            <Skeleton className="h-10 flex-1 w-full" />
            <Skeleton className="h-10 w-24 sm:w-auto" />
          </div>
          
          {/* Category Filter */}
          <div className="space-y-2">
            <div className="flex gap-2 items-center">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-24" />
            </div>
            <div className="flex gap-2 overflow-hidden">
              <Skeleton className="h-8 w-24 rounded-full flex-shrink-0" />
              <Skeleton className="h-8 w-28 rounded-full flex-shrink-0" />
              <Skeleton className="h-8 w-20 rounded-full flex-shrink-0" />
              <Skeleton className="h-8 w-24 rounded-full flex-shrink-0" />
            </div>
          </div>
        </div>
        
        {/* Products Grid - Menyesuaikan jumlah kolom */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <div className="h-9 bg-muted flex items-center justify-between px-4">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-14" />
              </div>
              <CardContent className="p-4 md:p-5">
                <div className="flex gap-4 items-start">
                  <Skeleton className="h-12 w-12 rounded-md flex-shrink-0" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <div className="flex justify-between items-center mt-5">
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-8 w-28" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      
      {/* Cart (Right Side) - Hidden on Mobile */}
      <div className="hidden lg:block lg:col-span-3 xl:col-span-2">
        <Card className="h-full flex flex-col">
          <CardHeader className="px-4 py-3 border-b">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-5 w-32" />
              </div>
              <Skeleton className="h-5 w-12 rounded-full" />
            </div>
          </CardHeader>
          
          <CardContent className="flex-1 p-4 space-y-3 overflow-auto">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-2 py-2">
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-4 w-4 rounded-full" />
                </div>
                <Skeleton className="h-3 w-24" />
                <div className="flex justify-between items-center mt-1">
                  <Skeleton className="h-7 w-24" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </div>
            ))}
          </CardContent>
          
          <CardFooter className="flex-col gap-4 p-4 border-t">
            <div className="w-full space-y-2">
              <div className="flex justify-between">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
              </div>
              <div className="h-px bg-border w-full my-2" />
              <div className="flex justify-between">
                <Skeleton className="h-5 w-12" />
                <Skeleton className="h-5 w-20" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 w-full">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
} 