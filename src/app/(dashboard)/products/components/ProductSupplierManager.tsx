import React from 'react';
import { Supplier } from '@/types/index';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Star } from 'lucide-react';
import { FormattedNumberInput } from '@/components/ui/formatted-input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export interface ProductSupplierData {
  supplierId: string;
  price: string;
  supplierProductCode: string;
  isDefault: boolean;
}

interface ProductSupplierManagerProps {
  suppliers: Supplier[];
  productSuppliers: ProductSupplierData[];
  onChange: (suppliers: ProductSupplierData[]) => void;
  onAddNewSupplier: () => void;
}

export function ProductSupplierManager({ suppliers, productSuppliers, onChange, onAddNewSupplier }: ProductSupplierManagerProps) {
  const handleAdd = () => {
    onChange([
      ...productSuppliers,
      { supplierId: '', price: '', supplierProductCode: '', isDefault: productSuppliers.length === 0 }
    ]);
  };

  const handleRemove = (index: number) => {
    const newList = [...productSuppliers];
    newList.splice(index, 1);
    
    // If we removed the default, make the first one default
    if (productSuppliers[index]?.isDefault && newList.length > 0) {
      newList[0].isDefault = true;
    }
    
    onChange(newList);
  };

  const handleChange = (index: number, field: keyof ProductSupplierData, value: any) => {
    const newList = [...productSuppliers];
    
    if (field === 'supplierId' && value === 'new-supplier') {
      onAddNewSupplier();
      return;
    }

    if (field === 'isDefault' && value === true) {
      // Unset others
      newList.forEach(item => item.isDefault = false);
    }
    
    newList[index] = { ...newList[index], [field]: value };
    onChange(newList);
  };

  return (
    <div className="space-y-4 border border-slate-200 p-4 rounded-xl bg-slate-50/50">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-200">
        <div>
          <Label className="text-base font-semibold text-slate-800">Daftar Supplier Produk</Label>
          <p className="text-sm text-slate-500 mt-1">Kelola dari mana saja produk ini dibeli dan perbandingan harganya.</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={handleAdd} className="bg-white shrink-0">
          <Plus className="w-4 h-4 mr-2" />
          Tambah Supplier
        </Button>
      </div>
      
      {productSuppliers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center bg-white rounded-lg border border-dashed border-slate-300">
          <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center mb-3">
            <Plus className="h-5 w-5 text-slate-400" />
          </div>
          <p className="text-sm font-medium text-slate-900">Belum ada supplier</p>
          <p className="text-sm text-slate-500 mt-1 max-w-sm">Tambahkan supplier jika produk ini dibeli dari pihak lain untuk memantau harga beli.</p>
          <Button type="button" variant="outline" size="sm" onClick={handleAdd} className="mt-4">
            Tambah Sekarang
          </Button>
        </div>
      ) : (
        <TooltipProvider>
          <div className="space-y-3">
            {/* Header Desktop */}
            <div className="hidden md:grid md:grid-cols-12 gap-4 px-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
              <div className="md:col-span-4">Supplier</div>
              <div className="md:col-span-3">Harga Beli</div>
              <div className="md:col-span-3">SKU <span className="lowercase font-normal capitalize-none text-slate-400">(Opsional)</span></div>
              <div className="md:col-span-2 text-right pr-2">Aksi</div>
            </div>

            {/* List Rows */}
            <div className="space-y-3">
              {productSuppliers.map((item, index) => (
                <div 
                  key={index} 
                  className={`flex flex-col md:grid md:grid-cols-12 gap-4 items-start md:items-center p-4 md:px-3 md:py-3 bg-white rounded-lg border transition-all ${item.isDefault ? 'border-yellow-300 shadow-sm bg-yellow-50/30' : 'border-slate-200'}`}
                >
                  <div className="md:col-span-4 w-full space-y-1.5 md:space-y-0">
                    <Label className="md:hidden text-xs text-slate-500 font-medium uppercase tracking-wider mb-1 block">Supplier</Label>
                    <Select value={item.supplierId} onValueChange={(val) => handleChange(index, 'supplierId', val)}>
                      <SelectTrigger className={`bg-white ${!item.supplierId ? 'text-slate-500' : ''} ${item.isDefault ? 'border-yellow-200 hover:border-yellow-300' : ''}`}>
                        <SelectValue placeholder="Pilih supplier..." />
                      </SelectTrigger>
                      <SelectContent>
                        {suppliers.map(s => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                        <SelectItem value="new-supplier" className="text-blue-600 font-medium">+ Tambah Supplier Baru</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="md:col-span-3 w-full space-y-1.5 md:space-y-0">
                    <Label className="md:hidden text-xs text-slate-500 font-medium uppercase tracking-wider mb-1 block">Harga Beli</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">Rp</span>
                      <FormattedNumberInput 
                        value={item.price} 
                        onChange={(val: string) => handleChange(index, 'price', val)} 
                        placeholder="0" 
                        className={`pl-9 bg-white ${item.isDefault ? 'border-yellow-200 focus-visible:ring-yellow-400' : ''}`}
                      />
                    </div>
                  </div>

                  <div className="md:col-span-3 w-full space-y-1.5 md:space-y-0">
                    <Label className="md:hidden text-xs text-slate-500 font-medium uppercase tracking-wider mb-1 block">SKU (Opsional)</Label>
                    <Input 
                      value={item.supplierProductCode} 
                      onChange={(e) => handleChange(index, 'supplierProductCode', e.target.value)} 
                      placeholder="Kode SKU..." 
                      className={`bg-white ${item.isDefault ? 'border-yellow-200 focus-visible:ring-yellow-400' : ''}`}
                    />
                  </div>
                  
                  <div className="md:col-span-2 flex gap-1.5 w-full mt-2 md:mt-0 justify-end items-center">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="icon"
                          className={`h-8 w-8 rounded-full transition-colors ${item.isDefault ? 'text-yellow-600 hover:text-yellow-700 bg-yellow-100 hover:bg-yellow-200' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
                          onClick={() => handleChange(index, 'isDefault', true)}
                        >
                          <Star className={`h-4 w-4 ${item.isDefault ? 'fill-current' : ''}`} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{item.isDefault ? "Supplier Utama" : "Jadikan Utama"}</p>
                      </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="icon"
                          className="h-8 w-8 rounded-full text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors"
                          onClick={() => handleRemove(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Hapus Supplier</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TooltipProvider>
      )}
    </div>
  );
}
