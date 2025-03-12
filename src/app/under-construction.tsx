import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, HardHat, Wrench } from "lucide-react";

export default function UnderConstruction() {
  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-background">
      <div className="container max-w-lg text-center space-y-6 py-10">
        <div className="flex justify-center space-x-3">
          <div className="relative bg-yellow-100 text-yellow-600 p-5 rounded-full animate-bounce" style={{ animationDuration: "2s" }}>
            <HardHat className="w-10 h-10" />
          </div>
          <div className="relative bg-yellow-100 text-yellow-600 p-5 rounded-full animate-bounce" style={{ animationDuration: "2.5s" }}>
            <Wrench className="w-10 h-10" />
          </div>
        </div>
        
        <h1 className="text-4xl font-bold tracking-tighter text-yellow-600">Sedang Dibangun</h1>
        <h2 className="text-xl font-semibold">Fitur ini sedang dalam tahap pengembangan</h2>
        
        <p className="text-muted-foreground">
          Kami sedang bekerja keras untuk menyelesaikan fitur ini. Silakan kembali lagi nanti untuk melihat pembaruan terbaru.
        </p>
        
        <div className="pt-4">
          <Button asChild variant="outline">
            <Link href="/" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Kembali ke Beranda
            </Link>
          </Button>
        </div>

        <div className="pt-8 border-t border-border mt-8">
          <p className="text-sm text-muted-foreground">
            Estimasi penyelesaian: <span className="font-medium">Dalam pengembangan.</span><br />
            Terima kasih atas kesabaran Anda!
          </p>
        </div>
      </div>
    </div>
  );
} 