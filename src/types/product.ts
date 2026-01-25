export interface Product {
  id: string;
  storeId?: string; // Added for discard logic
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
  batches?: ProductBatch[];
  conversionTargetId?: string | null;
  conversionRate?: number | null;
  convertedFrom?: { id: string; name: string }[];
}

export interface ProductBatch {
  id: string;
  productId: string;
  stock: number;
  expiryDate?: Date | string | null;
  batchNumber?: string | null;
  purchasePrice?: number | null;
  inDate: Date | string;
} 