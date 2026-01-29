"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Expense, EXPENSE_CATEGORIES } from "./columns";
import { format } from "date-fns";

const formSchema = z.object({
    amount: z.coerce.number().min(1, "Jumlah harus lebih dari 0"),
    category: z.string().min(1, "Kategori wajib dipilih"),
    description: z.string().optional().or(z.literal("")),
    date: z.string().min(1, "Tanggal wajib diisi"),
});

interface ExpenseDialogProps {
    isOpen: boolean;
    onClose: () => void;
    expense?: Expense;
    onSuccess: () => void;
}

export const ExpenseDialog: React.FC<ExpenseDialogProps> = ({
    isOpen,
    onClose,
    expense,
    onSuccess,
}) => {
    const [loading, setLoading] = useState(false);
    const isEdit = !!expense;

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            amount: 0,
            category: "",
            description: "",
            date: format(new Date(), "yyyy-MM-dd"),
        },
    });

    useEffect(() => {
        if (expense) {
            const expenseDate = new Date(expense.date);
            form.reset({
                amount: expense.amount,
                category: expense.category,
                description: expense.description || "",
                date: format(expenseDate, "yyyy-MM-dd"),
            });
        } else {
            form.reset({
                amount: 0,
                category: "",
                description: "",
                date: format(new Date(), "yyyy-MM-dd"),
            });
        }
    }, [expense, isOpen, form]);

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        try {
            setLoading(true);
            const url = isEdit ? `/api/expenses/${expense.id}` : "/api/expenses";
            const method = isEdit ? "PUT" : "POST";

            const payload = {
                amount: values.amount,
                category: values.category,
                description: values.description || null,
                date: new Date(values.date).toISOString(),
            };

            const response = await fetch(url, {
                method,
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Gagal menyimpan biaya");
            }

            toast.success(isEdit ? "Biaya berhasil diperbarui" : "Biaya berhasil ditambahkan");
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "Terjadi kesalahan");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{isEdit ? "Edit Biaya" : "Tambah Biaya"}</DialogTitle>
                    <DialogDescription>
                        {isEdit
                            ? "Ubah detail biaya operasional."
                            : "Masukkan biaya operasional baru."}
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="date"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Tanggal</FormLabel>
                                    <FormControl>
                                        <Input type="date" {...field} />
                                    </FormControl>
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
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Pilih kategori" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {Object.entries(EXPENSE_CATEGORIES).map(([key, label]) => (
                                                <SelectItem key={key} value={key}>
                                                    {label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
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
                                            placeholder="100000"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Keterangan (Opsional)</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Bayar listrik bulan Januari" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                                Batal
                            </Button>
                            <Button type="submit" disabled={loading}>
                                {loading ? "Menyimpan..." : "Simpan"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
};
