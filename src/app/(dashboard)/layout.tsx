import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Providers } from "@/components/providers";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <DashboardLayout>{children}</DashboardLayout>
    </Providers>
  );
} 