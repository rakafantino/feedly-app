// Supplier types - centralized
export interface Supplier {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  storeId?: string;
  createdAt: string;
  updatedAt: string;
  totalPurchase?: number;
  totalDebt?: number;
  code?: string;  // Add code field
}

export interface SupplierDialogProps {
  isOpen: boolean;
  onClose: () => void;
  supplier?: Supplier | null;
  onSuccess: () => void;
}
