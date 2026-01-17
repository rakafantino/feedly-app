"use client";

import { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Pencil, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type Supplier = {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    updatedAt: string;
};

interface ColumnsProps {
    onEdit: (supplier: Supplier) => void;
    onDelete: (supplier: Supplier) => void;
}

export const getColumns = ({ onEdit, onDelete }: ColumnsProps): ColumnDef<Supplier>[] => [
    {
        accessorKey: "name",
        header: "Nama",
    },
    {
        accessorKey: "contact",
        header: "Kontak",
        cell: ({ row }) => {
            const email = row.original.email;
            const phone = row.original.phone;
            return (
                <div className="flex flex-col text-sm">
                    <span>{email || "-"}</span>
                    <span className="text-muted-foreground">{phone || "-"}</span>
                </div>
            );
        },
    },
    {
        accessorKey: "address",
        header: "Alamat",
        cell: ({ row }) => row.original.address || "-",
    },
    {
        id: "actions",
        cell: ({ row }) => {
            const supplier = row.original;

            return (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Aksi</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => onEdit(supplier)}>
                            <Pencil className="mr-2 h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onDelete(supplier)} className="text-red-600">
                            <Trash className="mr-2 h-4 w-4" /> Hapus
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            );
        },
    },
];
