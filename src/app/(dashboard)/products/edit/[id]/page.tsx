import { Metadata } from "next";
import ProductForm from "../../components/ProductForm";
import { notFound } from "next/navigation";

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
      <ProductForm productId={id} />
    </div>
  );
} 