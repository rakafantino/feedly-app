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

import { Customer } from "@/types/index";

export type { Customer };

export type CustomerColumn = Customer & {
    id: string;
    name: string;
    phone: string | null;
    address: string | null;
    createdAt: string;
    updatedAt: string;
}

interface ColumnsProps {
    onEdit: (customer: Customer) => void;
    onDelete: (customer: Customer) => void;
}

export const getColumns = ({ onEdit, onDelete }: ColumnsProps): ColumnDef<Customer>[] => [
    {
        accessorKey: "name",
        header: "Nama",
    },
    {
        accessorKey: "phone",
        header: "Telepon",
        cell: ({ row }) => row.original.phone || "-",
    },
    {
        accessorKey: "address",
        header: "Alamat",
        cell: ({ row }) => row.original.address || "-",
    },
    {
        accessorKey: "createdAt",
        header: "Bergabung",
        cell: ({ row }) => row.original.createdAt ? new Date(row.original.createdAt).toLocaleDateString("id-ID") : "-",
    },
    {
        id: "actions",
        cell: ({ row }) => {
            const customer = row.original;

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
                        <DropdownMenuItem onClick={() => onEdit(customer)}>
                            <Pencil className="mr-2 h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onDelete(customer)} className="text-red-600">
                            <Trash className="mr-2 h-4 w-4" /> Hapus
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            );
        },
    },
];
