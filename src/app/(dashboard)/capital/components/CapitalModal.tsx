"use client";

import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { CapitalTransaction } from "./columns";
import {
    applyCapitalCategoryToNotes,
    CapitalCategory,
    classifyCapitalTransaction,
    getCapitalCategoryOptions,
    stripCapitalCategoryPrefix,
} from "@/lib/capital-classification";

const formSchema = z.object({
    amount: z.coerce.number().min(1, "Jumlah harus lebih dari 0"),
    type: z.enum(["INJECTION", "WITHDRAWAL"], {
        required_error: "Pilih tipe transaksi",
    }),
    category: z.enum(["INITIAL_CAPITAL", "ADDITIONAL_CAPITAL", "CAPITAL_ADJUSTMENT_IN", "OWNER_DRAW", "CASH_ADJUSTMENT_OUT"], {
        required_error: "Pilih kategori transaksi",
    }),
    notes: z.string().optional(),
    date: z.string().min(1, "Tanggal wajib diisi"),
});

type CapitalFormValues = z.infer<typeof formSchema>;

interface CapitalModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    initialData?: CapitalTransaction | null;
}

export const CapitalModal: React.FC<CapitalModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    initialData,
}) => {
    const [loading, setLoading] = useState(false);

    const form = useForm<CapitalFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            amount: 0,
            type: "INJECTION",
            category: "ADDITIONAL_CAPITAL",
            notes: "",
            date: new Date().toISOString().split("T")[0],
        },
    });

    const transactionType = form.watch("type");
    const categoryOptions = useMemo(() => getCapitalCategoryOptions(transactionType), [transactionType]);

    useEffect(() => {
        if (initialData) {
            form.reset({
                amount: initialData.amount,
                type: initialData.type,
                category: classifyCapitalTransaction(initialData.type, initialData.notes),
                notes: stripCapitalCategoryPrefix(initialData.notes),
                date: new Date(initialData.date).toISOString().split("T")[0],
            });
        } else {
            form.reset({
                amount: 0,
                type: "INJECTION",
                category: "ADDITIONAL_CAPITAL",
                notes: "",
                date: new Date().toISOString().split("T")[0],
            });
        }
    }, [initialData, form, isOpen]);

    useEffect(() => {
        const currentCategory = form.getValues("category") as CapitalCategory;
        const stillValid = categoryOptions.some((option) => option.value === currentCategory);

        if (!stillValid) {
            form.setValue("category", categoryOptions[0]?.value || "ADDITIONAL_CAPITAL");
        }
    }, [categoryOptions, form]);

    const onSubmit = async (data: CapitalFormValues) => {
        try {
            setLoading(true);
            
            const url = initialData 
                ? `/api/capital/${initialData.id}` 
                : "/api/capital";
                
            const method = initialData ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    amount: data.amount,
                    type: data.type,
                    notes: applyCapitalCategoryToNotes(data.notes, data.category),
                    date: new Date(data.date).toISOString(),
                }),
            });

            if (!res.ok) {
                const result = await res.json();
                throw new Error(result.error || "Gagal menyimpan transaksi");
            }

            toast.success(initialData ? "Transaksi modal berhasil diperbarui" : "Transaksi modal berhasil disimpan");
            form.reset();
            onSuccess();
            onClose();
        } catch (error: any) {
            toast.error(error.message || "Terjadi kesalahan");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{initialData ? "Edit Transaksi Modal" : "Tambah Transaksi Modal"}</DialogTitle>
                    <DialogDescription>
                        {initialData ? "Ubah detail transaksi modal." : "Catat penambahan modal atau penarikan uang (prive)."}
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="type"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Tipe Transaksi</FormLabel>
                                    <Select
                                        onValueChange={(value) => {
                                            field.onChange(value);
                                            const nextCategory = getCapitalCategoryOptions(value as "INJECTION" | "WITHDRAWAL")[0]?.value;
                                            if (nextCategory) {
                                                form.setValue("category", nextCategory);
                                            }
                                        }}
                                        value={field.value}
                                        defaultValue={field.value}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Pilih tipe transaksi" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="INJECTION">Uang masuk ke modal</SelectItem>
                                            <SelectItem value="WITHDRAWAL">Uang keluar dari modal</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="category"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Kategori</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Pilih kategori" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {categoryOptions.map((option) => (
                                                <SelectItem key={option.value} value={option.value}>
                                                    {option.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground">
                                        {categoryOptions.find((option) => option.value === field.value)?.description}
                                    </p>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="amount"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Jumlah (Rp)</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            disabled={loading}
                                            placeholder="Contoh: 1000000"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="date"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Tanggal</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="date"
                                            disabled={loading}
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="notes"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Keterangan (Opsional)</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            disabled={loading}
                                            placeholder="Contoh: Tambahan modal awal bulan"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <DialogFooter>
                            <Button
                                disabled={loading}
                                variant="outline"
                                onClick={onClose}
                                type="button"
                            >
                                Batal
                            </Button>
                            <Button disabled={loading} type="submit">
                                Simpan
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
};
