import React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

const formSchema = z.object({
  name: z.string().min(1, "Nama produk wajib diisi"),
  category: z.string().min(1, "Kategori wajib diisi"),
  price: z.coerce.number().min(0, "Harga tidak boleh negatif"),
  stock: z.coerce.number().min(0, "Stok tidak boleh negatif"),
  unit: z.string().min(1, "Satuan wajib diisi"),
  supplierId: z.string().optional(),
  description: z.string().optional(),
  barcode: z.string().optional(),
  threshold: z.coerce.number().optional(),
  purchase_price: z.coerce.number().optional(),
  expiry_date: z.date().optional().nullable(),
  batch_number: z.string().optional(),
  purchase_date: z.date().optional().nullable(),
  min_selling_price: z.coerce.number().optional(),
});

const ProductForm: React.FC = () => {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(formSchema),
  });
  
  const onSubmit = () => {
    // Handle form submission
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* Existing form fields */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="purchase_price">Harga Beli</Label>
          <Input
            id="purchase_price"
            type="number"
            placeholder="Harga beli produk"
            {...register("purchase_price", { valueAsNumber: true })}
          />
          {errors.purchase_price && (
            <p className="text-sm text-destructive">{errors.purchase_price.message}</p>
          )}
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="min_selling_price">Harga Jual Minimum</Label>
          <Input
            id="min_selling_price"
            type="number"
            placeholder="Harga jual minimum"
            {...register("min_selling_price", { valueAsNumber: true })}
          />
          {errors.min_selling_price && (
            <p className="text-sm text-destructive">{errors.min_selling_price.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="expiry_date">Tanggal Kadaluwarsa</Label>
          <Input
            id="expiry_date"
            type="date"
            {...register("expiry_date", { 
              setValueAs: (value: string) => value ? new Date(value) : null 
            })}
          />
          {errors.expiry_date && (
            <p className="text-sm text-destructive">{errors.expiry_date.message}</p>
          )}
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="purchase_date">Tanggal Pembelian</Label>
          <Input
            id="purchase_date"
            type="date"
            {...register("purchase_date", { 
              setValueAs: (value: string) => value ? new Date(value) : null 
            })}
          />
          {errors.purchase_date && (
            <p className="text-sm text-destructive">{errors.purchase_date.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="batch_number">Nomor Batch</Label>
        <Input
          id="batch_number"
          placeholder="Nomor batch produk"
          {...register("batch_number")}
        />
        {errors.batch_number && (
          <p className="text-sm text-destructive">{errors.batch_number.message}</p>
        )}
      </div>

      {/* Existing form fields */}
    </form>
  );
};

export default ProductForm; 