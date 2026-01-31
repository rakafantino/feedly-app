// GenericCRUDList.tsx
// Reusable CRUD list component for Customer, Supplier, and similar entities

"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Heading } from "@/components/ui/heading";
import { Separator } from "@/components/ui/separator";
import { ColumnDef } from "@tanstack/react-table";
import { AlertModal } from "@/components/modals/alert-modal";
import { toast } from "sonner";

interface Entity {
  id: string;
  [key: string]: any;
}

interface UseDeleteMutation {
  mutate: (id: string, options?: { onSuccess?: () => void; onError?: () => void; onSettled?: () => void }) => void;
  isPending: boolean;
}

interface GenericCRUDListProps<T extends Entity> {
  // Data
  data: T[];
  isLoading: boolean;
  
  // Column factory function (receives callbacks, returns ColumnDef[])
  getColumns: (callbacks: { onEdit: (entity: T) => void; onDelete: (entity: T) => void }) => ColumnDef<T, any>[];
  
  // Hooks
  useDeleteMutation: () => UseDeleteMutation;
  
  // Labels
  title: string;
  description: string;
  addButtonLabel: string;
  deleteSuccessMessage: string;
  deleteErrorMessage: string;
  
  // Dialog components
  DialogComponent: React.ComponentType<{
    isOpen: boolean;
    onClose: () => void;
    entity?: T | null;
    onSuccess: () => void;
  }>;
  
  // Entity name for query invalidation
  entityName: "customer" | "supplier" | "other";
}

export function GenericCRUDList<T extends Entity>({
  data,
  isLoading,
  getColumns,
  useDeleteMutation,
  title,
  description,
  addButtonLabel,
  deleteSuccessMessage,
  deleteErrorMessage,
  DialogComponent,
  entityName,
}: GenericCRUDListProps<T>) {
  const queryClient = useQueryClient();
  
  // Dialog state
  const [open, setOpen] = useState(false);
  const [editingEntity, setEditingEntity] = useState<T | null>(null);
  
  // Delete state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [entityToDelete, setEntityToDelete] = useState<T | undefined>(undefined);
  
  // Delete mutation
  const deleteMutation = useDeleteMutation();
  
  const handleEdit = (entity: T) => {
    setEditingEntity(entity);
    setOpen(true);
  };
  
  const handleDeleteClick = (entity: T) => {
    setEntityToDelete(entity);
    setDeleteOpen(true);
  };
  
  const handleConfirmDelete = () => {
    if (!entityToDelete) return;
    
    deleteMutation.mutate(entityToDelete.id, {
      onSuccess: () => {
        toast.success(deleteSuccessMessage);
      },
      onError: () => {
        toast.error(deleteErrorMessage);
      },
      onSettled: () => {
        setDeleteOpen(false);
        setEntityToDelete(undefined);
      },
    });
  };
  
  const handleCloseDialog = () => {
    setOpen(false);
    setEditingEntity(null);
  };
  
  // Generate columns with actual handlers
  const columns = getColumns({ onEdit: handleEdit, onDelete: handleDeleteClick });
  
  return (
    <>
      <div className="flex items-center justify-between">
        <Heading title={title} description={description} />
        <Button onClick={() => setOpen(true)} size="xs">
          <Plus className="mr-2 h-4 w-4" />
          {addButtonLabel}
        </Button>
      </div>
      <Separator />
      
      {isLoading ? (
        <div className="flex justify-center p-8">Memuat data...</div>
      ) : (
        <DataTable searchKey="name" columns={columns} data={data} />
      )}
      
      <DialogComponent
        isOpen={open}
        onClose={handleCloseDialog}
        entity={editingEntity}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: [entityName === "customer" ? "customers" : "suppliers"] })}
      />
      
      <AlertModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleConfirmDelete}
        loading={deleteMutation.isPending}
      />
    </>
  );
}
