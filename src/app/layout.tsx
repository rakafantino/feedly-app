import "./globals.css";
import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "Feedly App - Aplikasi Kasir & Dashboard Toko Pakan Ternak",
  description: "Aplikasi kasir dan manajemen stok untuk toko pakan ternak",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className="light" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Providers>
          {children}
        </Providers>
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
