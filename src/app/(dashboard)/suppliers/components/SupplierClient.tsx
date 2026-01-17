"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Heading } from "@/components/ui/heading";
import { Separator } from "@/components/ui/separator";
import { getColumns, Supplier } from "./columns";
import { SupplierDialog } from "./SupplierDialog";
import { AlertModal } from "@/components/modals/alert-modal";
import { toast } from "sonner";

export const SupplierClient = () => {
    const [data, setData] = useState<Supplier[]>([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false); // Dialog Add/Edit
    const [editingSupplier, setEditingSupplier] = useState<Supplier | undefined>(undefined);

    // Delete State
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [supplierToDelete, setSupplierToDelete] = useState<Supplier | undefined>(undefined);

    const fetchData = async () => {
        try {
            setLoading(true);
            const res = await fetch("/api/suppliers");
            const json = await res.json();
            setData(json.suppliers || []); // Assuming API returns { suppliers: [] }
        } catch (error) {
            console.error("Failed to fetch suppliers", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

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
            setLoading(true);
            await fetch(`/api/suppliers/${supplierToDelete.id}`, {
                method: "DELETE",
            });
            toast.success("Supplier berhasil dihapus");
            fetchData();
        } catch {
            toast.error("Gagal menghapus supplier");
        } finally {
            setLoading(false);
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
                    title={`Supplier (${data.length})`}
                    description="Kelola data supplier anda"
                />
                <Button onClick={() => setOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" /> Tambah Baru
                </Button>
            </div>
            <Separator />

            <DataTable searchKey="name" columns={columns} data={data} />

            <SupplierDialog
                isOpen={open}
                onClose={handleCloseDialog}
                supplier={editingSupplier}
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
