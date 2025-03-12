import { DashboardSkeleton } from "@/components/skeleton";

export default function DashboardLoading() {
  return (
    <div className="container py-6">
      <DashboardSkeleton />
    </div>
  );
} 