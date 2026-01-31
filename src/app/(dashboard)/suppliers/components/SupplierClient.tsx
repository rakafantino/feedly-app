"use client";

import { getColumns } from "./columns";
import { SupplierDialog } from "./SupplierDialog";
import { GenericCRUDList } from "@/components/ui/GenericCRUDList";
import { useSuppliers, useDeleteSupplier } from "@/hooks/useSuppliers";

export const SupplierClient = () => {
  const { data: suppliers = [], isLoading } = useSuppliers();
  const useDeleteMutation = useDeleteSupplier;

  return (
    <GenericCRUDList
      data={suppliers}
      isLoading={isLoading}
      getColumns={getColumns}
      useDeleteMutation={useDeleteMutation}
      title="Supplier"
      description="Kelola data supplier anda"
      addButtonLabel="Supplier"
      deleteSuccessMessage="Supplier berhasil dihapus"
      deleteErrorMessage="Gagal menghapus supplier"
      DialogComponent={SupplierDialog}
      entityName="supplier"
    />
  );
};
