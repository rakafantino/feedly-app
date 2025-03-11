import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Toaster } from "sonner";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DashboardLayout>{children}</DashboardLayout>
      <Toaster position="top-right" />
    </>
  );
} 