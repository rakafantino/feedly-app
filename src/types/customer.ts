// Customer types - centralized
export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  storeId?: string;
  createdAt?: string;
  updatedAt?: string;
  totalPurchase?: number;
  totalDebt?: number;
}

export interface CustomerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  customer?: Customer | null;
  onSuccess: () => void;
}

export interface CustomerSelectorProps {
    selectedCustomer: Customer | null;
    onSelectCustomer: (customer: Customer | null) => void;
    className?: string;
}

export interface CustomerWithDebt extends Customer {
  totalDebt: number;
}
