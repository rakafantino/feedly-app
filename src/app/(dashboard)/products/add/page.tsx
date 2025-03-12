import { Metadata } from "next";
import ProductForm from "../components/ProductForm";

export const metadata: Metadata = {
  title: "Add Product",
  description: "Add a new product to your inventory",
};

export default function AddProductPage() {
  return (
    <div className="container py-6">
      <h1 className="text-2xl font-bold mb-6">Add New Product</h1>
      <ProductForm />
    </div>
  );
} 