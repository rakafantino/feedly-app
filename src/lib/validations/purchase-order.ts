import { z } from "zod";

export const purchaseOrderItemSchema = z.object({
  productId: z.string().min(1, "Product ID wajib diisi"),
  quantity: z.coerce.number().positive("Quantity wajib lebih dari 0"),
  price: z.coerce.number().nonnegative("Harga tidak boleh negatif"),
  unit: z.string().optional(),
});

export const purchaseOrderSchema = z.object({
  supplierId: z.string().min(1, "Supplier wajib dipilih"),
  items: z.array(purchaseOrderItemSchema).min(1, "Minimal satu item produk wajib ditambahkan"),
  status: z.enum(['draft', 'ordered', 'received', 'partially_received', 'cancelled']).optional().default('draft'),
  estimatedDelivery: z.string().optional().nullable().or(z.literal("")),
  notes: z.string().optional().nullable(),
  
  // Debt Fields
  paymentStatus: z.enum(['PAID', 'UNPAID', 'PARTIAL']).optional(),
  amountPaid: z.coerce.number().min(0).optional(),
  dueDate: z.string().optional().nullable(),
});

export const purchaseOrderUpdateSchema = purchaseOrderSchema.partial().extend({
  status: z.enum(['draft', 'ordered', 'received', 'partially_received', 'cancelled']).optional(),
});

export const receiveGoodsSchema = z.object({
  items: z.array(z.object({
    id: z.string(),
    receivedQuantity: z.coerce.number().min(0),
    batches: z.array(z.object({
      quantity: z.coerce.number().min(0),
      expiryDate: z.string().optional().nullable(),
      batchNumber: z.string().optional().nullable(),
    })).optional(),
  })),
  closePo: z.boolean().optional().default(false), // Option to close PO even if incomplete
});
