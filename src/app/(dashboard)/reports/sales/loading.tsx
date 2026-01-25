import { PageSkeleton } from "@/components/skeleton";

export default function ReportsLoading() {
  return (
    <div className="container py-6">
      <PageSkeleton sections={2} rowsPerSection={3} />
    </div>
  );
} 
