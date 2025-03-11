import { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Feedly - Aplikasi Toko Pakan Ternak",
  description: "Aplikasi kasir dan manajemen stok untuk toko pakan ternak",
};

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="px-4 lg:px-6 h-16 flex items-center">
        <Link className="flex items-center justify-center" href="/">
          <span className="text-xl font-bold">Feedly App</span>
        </Link>
        <nav className="ml-auto flex gap-4 sm:gap-6">
          <Link
            href="#features"
            className="text-sm font-medium hover:underline underline-offset-4"
          >
            Fitur
          </Link>
          <Link
            href="#testimonials"
            className="text-sm font-medium hover:underline underline-offset-4"
          >
            Testimonial
          </Link>
          <Link
            href="#pricing"
            className="text-sm font-medium hover:underline underline-offset-4"
          >
            Harga
          </Link>
        </nav>
      </header>
      <main className="flex-1">
        <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center space-y-4 text-center">
              <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl/none">
                Kelola Toko Pakan Ternak dengan Mudah
              </h1>
              <p className="mx-auto max-w-[700px] text-muted-foreground md:text-xl">
                Feedly membantu Anda mengelola persediaan, transaksi penjualan, dan melihat laporan bisnis secara real-time.
              </p>
              <div className="flex flex-col gap-2 min-[400px]:flex-row">
                <Link href="/login">
                  <Button size="lg">Login</Button>
                </Link>
                <Link href="/dashboard">
                  <Button size="lg" variant="outline">
                    Lihat Demo
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
        <section
          id="features"
          className="w-full py-12 md:py-24 lg:py-32 bg-muted/50"
        >
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <div className="space-y-2">
                <div className="inline-block rounded-lg bg-muted px-3 py-1 text-sm">
                  Fitur Utama
                </div>
                <h2 className="text-3xl font-bold tracking-tighter md:text-4xl/tight">
                  Lengkap untuk Kebutuhan Toko Pakan Ternak
                </h2>
                <p className="mx-auto max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                  Semua yang Anda butuhkan untuk mengelola toko pakan ternak dengan efisien.
                </p>
              </div>
            </div>
            <div className="mx-auto grid max-w-5xl items-center gap-6 py-12 lg:grid-cols-3 lg:gap-12">
              <div className="grid gap-1">
                <h3 className="text-lg font-bold">Kasir Mudah Digunakan</h3>
                <p className="text-sm text-muted-foreground">
                  Proses transaksi cepat dengan antarmuka yang intuitif untuk kasir.
                </p>
              </div>
              <div className="grid gap-1">
                <h3 className="text-lg font-bold">Manajemen Inventori</h3>
                <p className="text-sm text-muted-foreground">
                  Pantau stok secara real-time dan dapatkan peringatan stok menipis.
                </p>
              </div>
              <div className="grid gap-1">
                <h3 className="text-lg font-bold">Laporan Bisnis</h3>
                <p className="text-sm text-muted-foreground">
                  Visualisasi data penjualan dan inventori untuk keputusan bisnis yang tepat.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer className="flex flex-col gap-2 sm:flex-row py-6 w-full border-t px-4 md:px-6">
        <p className="text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} Feedly App. All rights reserved.
        </p>
        <nav className="sm:ml-auto flex gap-4 sm:gap-6">
          <Link
            href="#"
            className="text-xs hover:underline underline-offset-4"
          >
            Ketentuan Layanan
          </Link>
          <Link
            href="#"
            className="text-xs hover:underline underline-offset-4"
          >
            Kebijakan Privasi
          </Link>
        </nav>
      </footer>
    </div>
  );
} 