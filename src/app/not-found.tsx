import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Search } from "lucide-react";

export default function NotFound() {
  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-background">
      <div className="container max-w-md text-center space-y-6 py-10">
        <div className="flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" style={{ animationDuration: "3s" }}></div>
            <div className="relative bg-primary/10 text-primary p-6 rounded-full">
              <Search className="w-12 h-12" />
            </div>
          </div>
        </div>
        
        <h1 className="text-6xl font-bold tracking-tighter text-primary">404</h1>
        <h2 className="text-2xl font-semibold">Halaman Tidak Ditemukan</h2>
        
        <p className="text-muted-foreground">
          Maaf, halaman yang Anda cari tidak dapat ditemukan. Mungkin telah dihapus, namanya berubah, atau tidak tersedia untuk sementara.
        </p>
        
        <div className="pt-4">
          <Button asChild>
            <Link href="/" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Kembali ke Beranda
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
} 