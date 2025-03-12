import { ProductsSkeleton } from "@/components/skeleton";

export default function ProductsLoading() {
  return (
    <div className="container py-6">
      <ProductsSkeleton />
    </div>
  );
} 