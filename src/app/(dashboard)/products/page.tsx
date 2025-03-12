import { Metadata } from "next";
import ProductTable from "./components/ProductTable";

export const metadata: Metadata = {
  title: "Manajemen Produk | Feedly",
  description: "Kelola daftar produk di Feedly",
};

export default function ProductsPage() {
  return (
    <div className="w-full space-y-4">
      <div className="flex flex-col space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Manajemen Produk</h1>
        <p className="text-muted-foreground">
          Kelola inventaris produk Anda, tambahkan produk baru, dan perbarui informasi produk.
        </p>
      </div>
      
      <ProductTable />
    </div>
  );
} 