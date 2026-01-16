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
  status: z.enum(['pending', 'processing', 'sent', 'completed', 'cancelled']).optional().default('pending'),
  estimatedDelivery: z.string().datetime().optional().nullable().or(z.literal("")),
  notes: z.string().optional().nullable(),
});

export const purchaseOrderUpdateSchema = purchaseOrderSchema.partial().extend({
  status: z.enum(['pending', 'processing', 'sent', 'completed', 'cancelled']).optional(),
});
