import { FormSkeleton } from "@/components/skeleton";

export default function ProductDetailLoading() {
  return (
    <div className="container py-6 max-w-2xl mx-auto">
      <FormSkeleton fields={6} />
    </div>
  );
} 