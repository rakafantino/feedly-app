export interface Product {
  id: string;
  name: string;
  description?: string;
  barcode?: string | null;
  category?: string | null;
  price: number;
  stock: number;
  unit?: string;
  createdAt: string;
  updatedAt: string;
} 