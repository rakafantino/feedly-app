"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Heading } from "@/components/ui/heading";
import { Separator } from "@/components/ui/separator";
import { getColumns, Customer } from "./columns";
import { CustomerDialog } from "./CustomerDialog";
import { AlertModal } from "@/components/modals/alert-modal";
import { toast } from "sonner";

export const CustomerClient = () => {

    const [data, setData] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false); // Dialog Add/Edit
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

    // Delete State
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [customerToDelete, setCustomerToDelete] = useState<Customer | undefined>(undefined);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/customers`);
            if (!res.ok) throw new Error("Failed to fetch");
            const json = await res.json();
            setData(json || []);
        } catch (error) {
            console.error("Failed to fetch customers", error);
            toast.error("Gagal memuat data pelanggan");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

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
            setLoading(true);
            await fetch(`/api/customers/${customerToDelete.id}`, {
                method: "DELETE",
            });
            toast.success("Pelanggan berhasil dihapus");
            fetchData();
        } catch {
            toast.error("Gagal menghapus pelanggan");
        } finally {
            setLoading(false);
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

            <DataTable searchKey="name" columns={columns} data={data} />

            <CustomerDialog
                isOpen={open}
                onClose={handleCloseDialog}
                customer={editingCustomer}
                onSuccess={fetchData}
            />

            <AlertModal
                isOpen={deleteOpen}
                onClose={() => setDeleteOpen(false)}
                onConfirm={handleConfirmDelete}
                loading={loading}
            />
        </>
    );
};
