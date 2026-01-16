import { z } from "zod";

export const transactionItemSchema = z.object({
  productId: z.string().min(1, "Product ID wajib diisi"),
  quantity: z.coerce.number().positive("Quantity wajib lebih dari 0"),
  price: z.coerce.number().nonnegative("Harga tidak boleh negatif"),
});

export const paymentDetailSchema = z.object({
  amount: z.coerce.number().nonnegative("Jumlah pembayaran tidak boleh negatif"),
  method: z.string().optional(),
  reference: z.string().optional(),
});

export const transactionSchema = z.object({
  items: z.array(transactionItemSchema).min(1, "Transaksi harus memuat minimal 1 item"),
  paymentMethod: z.string().min(1, "Metode pembayaran wajib diisi"),
  paymentDetails: z.array(paymentDetailSchema).optional(),
});
