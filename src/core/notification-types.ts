// Re-defining types to match frontend expectations (compatible with legacy AppNotification)
import { Notification } from "@prisma/client";

export interface StockNotificationMetadata {
  currentStock: number;
  threshold: number;
  unit: string;
  category?: string;
  price?: number;
  supplierId?: string | null;
}

export interface DebtNotificationMetadata {
  invoiceNumber: string;
  customerName: string;
  amountPaid: number;
  remainingAmount: number;
  dueDate: Date;
}

export interface ExpiredNotificationMetadata {
  expiryDate: Date;
  batchNumber?: string;
  daysLeft: number;
  currentStock: number;
  unit: string;
}

export interface AppNotification {
  id: string;
  type: 'STOCK' | 'DEBT' | 'EXPIRED';
  title: string; // Used as productName or generic title
  message: string;
  timestamp: Date;
  read: boolean;
  storeId: string;
  
  // Optional specific fields (flattened for frontend compatibility)
  productId?: string;
  productName?: string;
  currentStock?: number;
  threshold?: number;
  unit?: string;
  price?: number;
  
  transactionId?: string;
  purchaseOrderId?: string;
  invoiceNumber?: string;
  customerName?: string;
  supplierName?: string; // Added for Supplier Debt
  amountPaid?: number;
  remainingAmount?: number;
  dueDate?: Date;
  
  // Expired specific
  expiryDate?: Date;
  batchNumber?: string;
  daysLeft?: number;
  category?: string;
  supplierId?: string | null;
  
  snoozedUntil?: Date | null;
  metadata?: any;
}

export type StockNotification = AppNotification;

// Helper type for transformation
export type NotificationWithRelations = Notification & { 
  product?: any; 
  transaction?: any; 
  purchaseOrder?: any;
};
