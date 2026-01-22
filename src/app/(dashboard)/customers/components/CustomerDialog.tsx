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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Customer } from "./columns";

const formSchema = z.object({
    name: z.string().min(1, "Nama pelanggan wajib diisi"),
    phone: z.string().optional().or(z.literal("")),
    address: z.string().optional().or(z.literal("")),
});

interface CustomerDialogProps {
    isOpen: boolean;
    onClose: () => void;
    customer?: Customer | null;
    onSuccess: () => void;
}

export const CustomerDialog: React.FC<CustomerDialogProps> = ({
    isOpen,
    onClose,
    customer,
    onSuccess,
}) => {
    const [loading, setLoading] = useState(false);
    const isEdit = !!customer;

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
            phone: "",
            address: "",
        },
    });

    useEffect(() => {
        if (customer) {
            form.reset({
                name: customer.name,
                phone: customer.phone || "",
                address: customer.address || "",
            });
        } else {
            form.reset({
                name: "",
                phone: "",
                address: "",
            });
        }
    }, [customer, isOpen, form]);

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        try {
            setLoading(true);
            const url = isEdit
                ? `/api/customers/${customer.id}`
                : `/api/customers`;

            const method = isEdit ? "PATCH" : "POST";

            const response = await fetch(url, {
                method,
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(values),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Gagal menyimpan data pelanggan");
            }

            toast.success(isEdit ? "Pelanggan berhasil diperbarui" : "Pelanggan berhasil ditambahkan");
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
                    <DialogTitle>{isEdit ? "Edit Pelanggan" : "Tambah Pelanggan"}</DialogTitle>
                    <DialogDescription>
                        {isEdit
                            ? "Ubah detail pelanggan di bawah ini."
                            : "Masukkan detail pelanggan baru."}
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nama Pelanggan</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Contoh: Pak Budi" {...field} />
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
                                    <FormLabel>Telepon (Opsional)</FormLabel>
                                    <FormControl>
                                        <Input placeholder="0812..." {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="address"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Alamat (Opsional)</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Jl. Mawar..." {...field} />
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
