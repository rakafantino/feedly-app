"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Heading } from "@/components/ui/heading";
import { Separator } from "@/components/ui/separator";
import { getColumns, Customer } from "./columns";
import { CustomerDialog } from "./CustomerDialog";
import { AlertModal } from "@/components/modals/alert-modal";
import { toast } from "sonner";

export const CustomerClient = () => {
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false); // Dialog Add/Edit
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

    // Delete State
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [customerToDelete, setCustomerToDelete] = useState<Customer | undefined>(undefined);
    const [deleteLoading, setDeleteLoading] = useState(false);

    // React Query
    const { data: customers = [], isLoading } = useQuery({
        queryKey: ['customers'],
        queryFn: async () => {
            const res = await fetch(`/api/customers`);
            if (!res.ok) throw new Error("Failed to fetch");
            const json = await res.json();
            return Array.isArray(json) ? json : (json.customers || []);
        }
    });

    const handleEdit = (customer: Customer) => {
        setEditingCustomer(customer);
        setOpen(true);
    };

    const handleDeleteClick = (customer: Customer) => {
        setCustomerToDelete(customer);
        setDeleteOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!customerToDelete) return;
        try {
            setDeleteLoading(true);
            await fetch(`/api/customers/${customerToDelete.id}`, {
                method: "DELETE",
            });
            toast.success("Pelanggan berhasil dihapus");
            queryClient.invalidateQueries({ queryKey: ['customers'] });
        } catch {
            toast.error("Gagal menghapus pelanggan");
        } finally {
            setDeleteLoading(false);
            setDeleteOpen(false);
            setCustomerToDelete(undefined);
        }
    };

    const handleCloseDialog = () => {
        setOpen(false);
        setEditingCustomer(null);
    };

    const columns = getColumns({ onEdit: handleEdit, onDelete: handleDeleteClick });

    return (
        <>
            <div className="flex items-center justify-between">
                <Heading
                    title={`Pelanggan`}
                    description="Kelola data pelanggan dan riwayat harga"
                />
                <Button onClick={() => setOpen(true)} size="xs">
                    <Plus className="mr-2 h-4 w-4" /> Pelanggan
                </Button>
            </div>
            <Separator />

            {isLoading ? (
                <div className="flex justify-center p-8">Memuat data...</div>
            ) : (
                <DataTable searchKey="name" columns={columns} data={customers} />
            )}

            <CustomerDialog
                isOpen={open}
                onClose={handleCloseDialog}
                customer={editingCustomer}
                onSuccess={() => queryClient.invalidateQueries({ queryKey: ['customers'] })}
            />

            <AlertModal
                isOpen={deleteOpen}
                onClose={() => setDeleteOpen(false)}
                onConfirm={handleConfirmDelete}
                loading={deleteLoading}
            />
        </>
    );
};
