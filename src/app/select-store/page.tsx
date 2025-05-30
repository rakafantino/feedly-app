"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { toast } from "sonner";

interface Store {
  id: string;
  name: string;
  description: string | null;
}

export default function SelectStorePage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Ambil daftar toko yang dimiliki oleh pengguna saat ini
    const fetchStores = async () => {
      try {
        const response = await fetch("/api/stores/user-stores");
        if (!response.ok) {
          throw new Error("Gagal mengambil data toko");
        }
        const data = await response.json();
        setStores(data.stores);
      } catch (error) {
        console.error("Error fetching stores:", error);
        toast.error("Gagal mengambil data toko");
      } finally {
        setLoading(false);
      }
    };

    fetchStores();
  }, []);

  const handleSelectStore = async (storeId: string) => {
    try {
      const response = await fetch("/api/stores/select-store", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ storeId }),
      });

      if (!response.ok) {
        throw new Error("Gagal memilih toko");
      }

      // Refresh halaman untuk mendapatkan session baru dengan storeId
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      console.error("Error selecting store:", error);
      toast.error("Gagal memilih toko");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Memuat daftar toko...</h1>
          <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
        </div>
      </div>
    );
  }

  if (stores.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Tidak ada toko</CardTitle>
            <CardDescription>
              Anda tidak memiliki akses ke toko manapun. Silakan hubungi administrator.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              Keluar
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-4xl">
        <h1 className="text-3xl font-bold mb-6 text-center">Pilih Toko</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stores.map((store) => (
            <Card key={store.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle>{store.name}</CardTitle>
                <CardDescription>
                  {store.description || "Tidak ada deskripsi"}
                </CardDescription>
              </CardHeader>
              <CardFooter>
                <Button
                  className="w-full"
                  onClick={() => handleSelectStore(store.id)}
                >
                  Pilih Toko
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
        <div className="mt-8 text-center">
          <Button
            variant="outline"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            Keluar
          </Button>
        </div>
      </div>
    </div>
  );
} 