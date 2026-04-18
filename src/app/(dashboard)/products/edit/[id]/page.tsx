import { Metadata } from "next";
import ProductForm from "../../components/ProductForm";
import { notFound } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PriceHistoryTab } from "@/components/products/PriceHistoryTab";
// Force webpack rebuild

export const metadata: Metadata = {
  title: "Edit Product",
  description: "Edit an existing product in your inventory",
};

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  
  if (!id) {
    return notFound();
  }

  return (
    <div className="container py-6">
      <h1 className="text-2xl font-bold mb-6">Edit Product</h1>
      
      <Tabs defaultValue="form">
        <TabsList className="mb-6">
          <TabsTrigger value="form">Data Produk</TabsTrigger>
          <TabsTrigger value="history">Riwayat Harga</TabsTrigger>
        </TabsList>
        
        <TabsContent value="form">
          <ProductForm productId={id} />
        </TabsContent>
        
        <TabsContent value="history">
          <div className="bg-white p-6 rounded-lg border">
            <h2 className="text-lg font-medium mb-4">Riwayat Perubahan Harga</h2>
            <PriceHistoryTab productId={id} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
} 