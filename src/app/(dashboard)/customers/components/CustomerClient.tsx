"use client";

import { getColumns } from "./columns";
import { CustomerDialog } from "./CustomerDialog";
import { GenericCRUDList } from "@/components/ui/GenericCRUDList";
import { useCustomers, useDeleteCustomer } from "@/hooks/useCustomers";

export const CustomerClient = () => {
  const { data: customers = [], isLoading } = useCustomers();
  const useDeleteMutation = useDeleteCustomer;

  return (
    <GenericCRUDList
      data={customers}
      isLoading={isLoading}
      getColumns={getColumns}
      useDeleteMutation={useDeleteMutation}
      title="Pelanggan"
      description="Kelola data pelanggan dan riwayat harga"
      addButtonLabel="Pelanggan"
      deleteSuccessMessage="Pelanggan berhasil dihapus"
      deleteErrorMessage="Gagal menghapus pelanggan"
      DialogComponent={CustomerDialog}
      entityName="customer"
    />
  );
};
