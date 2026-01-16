import { z } from 'zod';

export const productSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  description: z.string().optional().nullable(),
  barcode: z.string().optional().nullable(),
  category: z.string().min(1, 'Category is required'),
  price: z.number().min(0, 'Price must be non-negative'),
  stock: z.number().min(0, 'Stock must be non-negative'),
  unit: z.string().optional().default('pcs'),
  threshold: z.number().optional().nullable(),
  purchase_price: z.number().optional().nullable(),
  min_selling_price: z.number().optional().nullable(),
  batch_number: z.string().optional().nullable(),
  expiry_date: z.string().or(z.date()).optional().nullable().transform(val => val ? new Date(val) : null),
  purchase_date: z.string().or(z.date()).optional().nullable().transform(val => val ? new Date(val) : null),
  supplierId: z.string().optional().nullable(),
});

export const productUpdateSchema = productSchema.partial();
