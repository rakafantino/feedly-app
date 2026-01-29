"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Heading } from "@/components/ui/heading";
import { Separator } from "@/components/ui/separator";
import { getColumns, Supplier } from "./columns";
import { SupplierDialog } from "./SupplierDialog";
import { AlertModal } from "@/components/modals/alert-modal";
import { toast } from "sonner";

export const SupplierClient = () => {
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false); // Dialog Add/Edit
    const [editingSupplier, setEditingSupplier] = useState<Supplier | undefined>(undefined);

    // Delete State
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [supplierToDelete, setSupplierToDelete] = useState<Supplier | undefined>(undefined);
    const [deleteLoading, setDeleteLoading] = useState(false);

    // React Query
    const { data: suppliers = [], isLoading } = useQuery({
        queryKey: ['suppliers'],
        queryFn: async () => {
            const res = await fetch("/api/suppliers");
            if (!res.ok) throw new Error("Failed to fetch");
            const json = await res.json();
            return json.suppliers || [];
        }
    });

    const handleEdit = (supplier: Supplier) => {
        setEditingSupplier(supplier);
        setOpen(true);
    };

    const handleDeleteClick = (supplier: Supplier) => {
        setSupplierToDelete(supplier);
        setDeleteOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!supplierToDelete) return;
        try {
            setDeleteLoading(true);
            await fetch(`/api/suppliers/${supplierToDelete.id}`, {
                method: "DELETE",
            });
            toast.success("Supplier berhasil dihapus");
            queryClient.invalidateQueries({ queryKey: ['suppliers'] });
        } catch {
            toast.error("Gagal menghapus supplier");
        } finally {
            setDeleteLoading(false);
            setDeleteOpen(false);
            setSupplierToDelete(undefined);
        }
    };

    const handleCloseDialog = () => {
        setOpen(false);
        setEditingSupplier(undefined);
    };

    const columns = getColumns({ onEdit: handleEdit, onDelete: handleDeleteClick });

    return (
        <>
            <div className="flex items-center justify-between">
                <Heading
                    title={`Supplier`}
                    description="Kelola data supplier anda"
                />
                <Button onClick={() => setOpen(true)} size="xs">
                    <Plus className="mr-2 h-4 w-4" /> Supplier
                </Button>
            </div>
            <Separator />

            {isLoading ? (
                <div className="flex justify-center p-8">Memuat data...</div>
            ) : (
                <DataTable searchKey="name" columns={columns} data={suppliers} />
            )}

            <SupplierDialog
                isOpen={open}
                onClose={handleCloseDialog}
                supplier={editingSupplier}
                onSuccess={() => queryClient.invalidateQueries({ queryKey: ['suppliers'] })}
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
