"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Check, Loader2, Store as StoreIcon, Building2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateStoreDialog } from "./components/CreateStoreDialog";
import { Badge } from "@/components/ui/badge";

interface Store {
  id: string;
  name: string;
  address: string | null;
  role: string;
  isActive: boolean;
  isCurrent: boolean;
}

export default function SelectStorePage() {
  const router = useRouter();
  const { update } = useSession();
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  async function fetchStores() {
    try {
      const res = await fetch("/api/stores/list");
      const data = await res.json();
      if (data.success) {
        setStores(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch stores", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchStores();
  }, []);

  async function handleSelectStore(storeId: string) {
    try {
      setSwitchingId(storeId);
      const res = await fetch("/api/auth/switch-store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Gagal pindah toko");
      }

      await update(); // Update session client-side
      toast.success("Berhasil pindah toko");
      router.push("/dashboard");
      router.refresh();

    } catch (error) {
      console.error("Error switching store:", error);
      toast.error("Gagal pindah toko");
      setSwitchingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-4xl space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Pilih Toko</h1>
          <p className="text-muted-foreground">
            Kelola bisnis Anda dengan memilih toko yang ingin Anda akses
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {stores.map((store) => (
            <Card 
              key={store.id} 
              className={`relative hover:shadow-lg transition-all cursor-pointer border-2 ${
                store.isCurrent ? "border-primary ring-2 ring-primary/10" : "border-transparent hover:border-gray-200"
              }`}
              onClick={() => !switchingId && handleSelectStore(store.id)}
            >
              {store.isCurrent && (
                <div className="absolute top-2 right-2 bg-primary text-white rounded-full p-1">
                  <Check className="h-4 w-4" />
                </div>
              )}
              
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  {store.name}
                </CardTitle>
                <CardDescription className="line-clamp-1">
                  {store.address || "Tidak ada alamat"}
                </CardDescription>
              </CardHeader>
              
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Badge variant={store.role === 'OWNER' ? 'default' : 'secondary'}>
                    {store.role}
                  </Badge>
                  {store.isActive ? (
                    <Badge variant="outline" className="text-green-600 border-green-200">Aktif</Badge>
                  ) : (
                    <Badge variant="destructive">Nonaktif</Badge>
                  )}
                </div>
              </CardContent>

              <CardFooter>
                 <Button 
                   className="w-full" 
                   variant={store.isCurrent ? "secondary" : "default"}
                   disabled={!!switchingId || store.isCurrent}
                 >
                   {switchingId === store.id ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Masuk...
                      </>
                   ) : store.isCurrent ? (
                     "Sedang Aktif"
                   ) : (
                     "Masuk Toko"
                   )}
                 </Button>
              </CardFooter>
            </Card>
          ))}

          {/* Create New Store Card */}
          <Card className="border-dashed border-2 flex flex-col items-center justify-center p-6 h-full min-h-[250px] space-y-4 hover:border-primary hover:bg-primary/5 transition-colors">
            <div className="bg-primary/10 p-4 rounded-full">
              <StoreIcon className="h-8 w-8 text-primary" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="font-semibold text-lg">Tambah Toko Baru</h3>
              <p className="text-sm text-muted-foreground">Perluas bisnis dengan cabang baru</p>
            </div>
            <CreateStoreDialog 
              trigger={
                <Button variant="outline" className="mt-4">
                  Buat Toko Baru
                </Button>
              }
              onSuccess={fetchStores}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
