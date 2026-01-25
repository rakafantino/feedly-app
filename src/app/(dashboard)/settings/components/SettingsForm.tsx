"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Store, Save, Loader2, Bell } from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";


const formSchema = z.object({
  name: z.string().min(2, {
    message: "Nama toko minimal 2 karakter.",
  }),
  description: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Email tidak valid").optional().or(z.literal("")),
  dailyTarget: z.coerce.number().min(0).optional(),
  weeklyTarget: z.coerce.number().min(0).optional(),
  monthlyTarget: z.coerce.number().min(0).optional(),
  expiryNotificationDays: z.coerce.number().min(1).default(30),
  stockNotificationInterval: z.coerce.number().min(5).default(60), // Minimum 5 mins
});

type SettingsFormValues = z.infer<typeof formSchema>;

export default function SettingsForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      address: "",
      phone: "",
      email: "",
      dailyTarget: 0,
      weeklyTarget: 0,
      monthlyTarget: 0,
      expiryNotificationDays: 30,
      stockNotificationInterval: 60,
    },
  });

  useEffect(() => {
    async function fetchSettings() {
      try {
        setLoading(true);
        const response = await fetch("/api/settings");
        const data = await response.json();

        if (data.success && data.data) {
          form.reset({
            name: data.data.name || "",
            description: data.data.description || "",
            address: data.data.address || "",
            phone: data.data.phone || "",
            email: data.data.email || "",
            dailyTarget: data.data.dailyTarget || 0,
            weeklyTarget: data.data.weeklyTarget || 0,
            monthlyTarget: data.data.monthlyTarget || 0,
            expiryNotificationDays: data.data.expiryNotificationDays || 30,
            stockNotificationInterval: data.data.stockNotificationInterval || 60,
          });
        }
      } catch (error) {
        console.error("Failed to fetch settings:", error);
        toast.error("Gagal memuat pengaturan toko");
      } finally {
        setLoading(false);
      }
    }

    fetchSettings();
  }, [form]);

  async function onSubmit(data: SettingsFormValues) {
    try {
      setSaving(true);
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Gagal menyimpan pengaturan");
      }

      toast.success("Pengaturan toko berhasil disimpan");

      // Emit event agar dashboard melakukan refresh jika ada data yang berubah
      if (typeof window !== 'undefined') {
        const event = new CustomEvent('store-settings-updated', { detail: data });
        window.dispatchEvent(event);
      }

    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Terjadi kesalahan saat menyimpan pengaturan");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-[200px] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Store className="h-5 w-5" />
                Informasi Toko
              </CardTitle>
              <CardDescription>
                Atur informasi dasar mengenai toko Anda.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nama Toko</FormLabel>
                    <FormControl>
                      <Input placeholder="Nama Toko Anda" {...field} />
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
                      <Input placeholder="email@toko.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nomor Telepon</FormLabel>
                    <FormControl>
                      <Input placeholder="08123456789" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Alamat</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Alamat lengkap toko..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Deskripsi</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Deskripsi singkat toko..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TargetIcon className="h-5 w-5" />
                Target Penjualan
              </CardTitle>
              <CardDescription>
                Atur target penjualan manual. Jika diisi 0, sistem akan menghitung otomatis berdasarkan data historis.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <FormField
                control={form.control}
                name="dailyTarget"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Target Harian </FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="0" {...field} />
                    </FormControl>
                    <FormDescription>
                      Isi 0 untuk otomatis.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="weeklyTarget"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Target Mingguan </FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="0" {...field} />
                    </FormControl>
                    <FormDescription>
                      Isi 0 untuk otomatis.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="monthlyTarget"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Target Bulanan </FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="0" {...field} />
                    </FormControl>
                    <FormDescription>
                      Isi 0 untuk otomatis.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Pengaturan Notifikasi
              </CardTitle>
              <CardDescription>
                Atur kapan sistem harus memberi peringatan.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
                <FormField
                control={form.control}
                name="expiryNotificationDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Peringatan Kadaluwarsa (Hari)</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" placeholder="30" {...field} />
                    </FormControl>
                    <FormDescription>
                      Produk akan ditandai &quot;Hampir Kadaluwarsa&quot; jika sisa umur kurang dari angka ini. Default: 30 hari.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="stockNotificationInterval"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Interval Notifikasi (Menit)</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" placeholder="60" {...field} />
                    </FormControl>
                    <FormDescription>
                      Setting untuk interval waktu antar setiap notifikasi.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Simpan Pengaturan
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}

function TargetIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}
