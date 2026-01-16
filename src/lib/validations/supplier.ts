import { z } from "zod";

export const supplierSchema = z.object({
  name: z.string().min(1, "Nama supplier wajib diisi"),
  email: z.string().email("Format email tidak valid").optional().nullable().or(z.literal("")),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
});

export const supplierUpdateSchema = supplierSchema.partial();
