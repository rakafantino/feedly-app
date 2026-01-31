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
import { SupplierDialogProps } from "@/types/index";
import { toast } from "sonner";
import { Zap } from "lucide-react";

const formSchema = z.object({
    code: z.string().min(1, "Kode supplier wajib diisi"),
    name: z.string().min(1, "Nama supplier wajib diisi"),
    email: z.string().email("Email tidak valid").optional().or(z.literal("")),
    phone: z.string().optional().or(z.literal("")),
    address: z.string().optional().or(z.literal("")),
});


export const SupplierDialog: React.FC<SupplierDialogProps> = ({
    isOpen,
    onClose,
    supplier,
    onSuccess,
}) => {
    const [loading, setLoading] = useState(false);
    const isEdit = !!supplier;

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            code: "",
            name: "",
            email: "",
            phone: "",
            address: "",
        },
    });

    useEffect(() => {
        if (supplier) {
            form.reset({
                code: supplier.code || "",
                name: supplier.name,
                email: supplier.email || "",
                phone: supplier.phone || "",
                address: supplier.address || "",
            });
        } else {
            form.reset({
                code: "",
                name: "",
                email: "",
                phone: "",
                address: "",
            });
        }
    }, [supplier, isOpen, form]);

    const handleGenerateCode = () => {
        const name = form.getValues("name");
        if (!name) {
            toast.error("Isi nama supplier terlebih dahulu");
            return;
        }

        const cleanName = name.replace(/^(PT|CV|UD|TB|TOKO)\.?\s+/i, "").trim();
        let code = cleanName.substring(0, 3).toUpperCase();
        // Add ID segment or random for uniqueness
        code += "-" + Math.floor(Math.random() * 1000).toString().padStart(3, '0');

        form.setValue("code", code);
    };

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        try {
            setLoading(true);
            const url = isEdit ? `/api/suppliers/${supplier.id}` : "/api/suppliers";
            const method = isEdit ? "PUT" : "POST";

            const response = await fetch(url, {
                method,
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(values),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Gagal menyimpan data supplier");
            }

            toast.success(isEdit ? "Supplier berhasil diperbarui" : "Supplier berhasil ditambahkan");
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
                    <DialogTitle>{isEdit ? "Edit Supplier" : "Tambah Supplier"}</DialogTitle>
                    <DialogDescription>
                        {isEdit
                            ? "Ubah detail supplier di bawah ini."
                            : "Masukkan detail supplier baru."}
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="code"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Kode Supplier</FormLabel>
                                    <FormControl>
                                        <div className="flex gap-2">
                                            <Input placeholder="SUP-001" {...field} className="flex-1" />
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="icon"
                                                onClick={handleGenerateCode}
                                                title="Generate Code"
                                            >
                                                <Zap className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nama Supplier</FormLabel>
                                    <FormControl>
                                        <Input placeholder="PT. Pakan Sejahtera" {...field} />
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
                                        <Input placeholder="supplier@example.com" {...field} />
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
                                    <FormLabel>Telepon</FormLabel>
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
                                <FormItem>
                                    <FormLabel>Alamat</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Jl. Raya No. 123" {...field} />
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
