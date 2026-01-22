export interface Product {
  id: string;
  name: string;
  description?: string;
  barcode?: string | null;
  category?: string | null;
  price: number;
  stock: number;
  unit?: string;
  threshold?: number | null;
  createdAt: string;
  updatedAt: string;
  isDeleted?: boolean;
  purchase_price?: number | null;
  expiry_date?: Date | null;
  batch_number?: string | null;
  purchase_date?: Date | null;
  min_selling_price?: number | null;
  supplierId?: string | null;
  supplier?: {
    id: string;
    name: string;
    phone?: string;
    address?: string;
    email?: string;
  } | null;
} 