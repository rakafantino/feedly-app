import { Metadata } from "next";
import { UnderConstructionLayout } from "@/components/under-construction-layout";

export const metadata: Metadata = {
  title: "Laporan | Feedly",
  description: "Laporan penjualan dan analitik untuk bisnis Anda",
};

export default function ReportsPage() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-semibold mb-6">Laporan & Analitik</h1>
      
      <UnderConstructionLayout 
        title="Fitur Laporan Sedang Dikembangkan" 
        description="Kami sedang bekerja keras untuk menyediakan fitur laporan dan analitik yang komprehensif. Fitur ini akan memungkinkan Anda untuk melacak penjualan, inventaris, dan metrik bisnis penting lainnya."
        estimatedCompletion="Q2 2024"
        showHomeButton={false}
      />
    </div>
  );
} 