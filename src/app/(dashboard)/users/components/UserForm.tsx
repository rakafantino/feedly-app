"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ROLES, ROLE_LABELS } from "@/lib/constants";

// Schema validasi
const formSchema = z.object({
  name: z.string().min(2, "Nama minimal 2 karakter"),
  email: z.string().email("Email tidak valid"),
  password: z.string().min(6, "Password minimal 6 karakter").optional(),
  role: z.enum([ROLES.CASHIER]),
});

type UserFormValues = z.infer<typeof formSchema>;

interface UserFormProps {
  user?: any; // Jika mode edit, data user akan dikirim
  trigger?: React.ReactNode;
  onSuccess?: () => void;
  open?: boolean;
  setOpen?: (open: boolean) => void;
}

export default function UserForm({ user, trigger, onSuccess, open, setOpen }: UserFormProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const isEditMode = !!user;
  const isOpen = open !== undefined ? open : internalOpen;
  const onOpenChange = setOpen || setInternalOpen;

  const form = useForm<UserFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      role: ROLES.CASHIER,
    },
  });

  // Reset form saat dialog dibuka/tutup atau data user berubah
  useEffect(() => {
    if (isOpen) {
      if (user) {
        form.reset({
          name: user.name,
          email: user.email,
          role: user.role,
          password: "", // Password kosong saat edit (kecuali mau diganti)
        });
      } else {
        form.reset({
          name: "",
          email: "",
          password: "",
          role: ROLES.CASHIER,
        });
      }
    }
  }, [isOpen, user, form]);

  async function onSubmit(data: UserFormValues) {
    try {
      setSaving(true);
      
      const url = isEditMode ? `/api/users/${user.id}` : "/api/users";
      const method = isEditMode ? "PATCH" : "POST";
      
      // Jika edit dan password kosong, jangan kirim password
      const payload = { ...data };
      if (isEditMode && !payload.password) {
        delete payload.password;
      }

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Gagal menyimpan data pengguna");
      }

      toast.success(isEditMode ? "Pengguna berhasil diperbarui" : "Pengguna berhasil ditambahkan");
      onOpenChange(false);
      form.reset();
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error("Error saving user:", error);
      toast.error(error instanceof Error ? error.message : "Terjadi kesalahan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit Pengguna" : "Tambah Pengguna Baru"}</DialogTitle>
          <DialogDescription>
            {isEditMode 
              ? "Ubah data pengguna yang sudah ada. Kosongkan password jika tidak ingin mengganti." 
              : "Masukkan detail untuk membuat akun pengguna baru."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nama Lengkap</FormLabel>
                  <FormControl>
                    <Input placeholder="Budi Santoso" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="budi@toko.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role (Peran)</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(ROLE_LABELS)
                        .filter(([value]) => value !== ROLES.OWNER) // Sembunyikan opsi OWNER
                        .map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription className="text-xs">
                    {field.value === ROLES.CASHIER && "Hanya akses halaman Dashboard dan Kasir (POS)."}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{isEditMode ? "Password Baru (Opsional)" : "Password"}</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="******" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Simpan
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
