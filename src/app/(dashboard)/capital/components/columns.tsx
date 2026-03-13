"use client";

import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { ArrowDownCircle, ArrowUpCircle, MoreHorizontal, Pencil, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type CapitalTransaction = {
    id: string;
    amount: number;
    type: "INJECTION" | "WITHDRAWAL";
    notes: string | null;
    date: string;
};

interface ColumnsProps {
    onEdit: (transaction: CapitalTransaction) => void;
    onDelete: (transaction: CapitalTransaction) => void;
}

export const getColumns = ({ onEdit, onDelete }: ColumnsProps): ColumnDef<CapitalTransaction>[] => [
    {
        accessorKey: "date",
        header: "Tanggal",
        cell: ({ row }) => {
            return format(new Date(row.original.date), "dd MMM yyyy", { locale: localeId });
        },
    },
    {
        accessorKey: "type",
        header: "Tipe",
        cell: ({ row }) => {
            const type = row.original.type;
            if (type === "INJECTION") {
                return (
                    <div className="flex items-center text-emerald-600 font-medium">
                        <ArrowUpCircle className="mr-2 h-4 w-4" />
                        Tambah Modal
                    </div>
                );
            }
            return (
                <div className="flex items-center text-rose-600 font-medium">
                    <ArrowDownCircle className="mr-2 h-4 w-4" />
                    Tarik Uang (Prive)
                </div>
            );
        },
    },
    {
        accessorKey: "notes",
        header: "Keterangan",
        cell: ({ row }) => row.original.notes || "-",
    },
    {
        accessorKey: "amount",
        header: "Jumlah",
        cell: ({ row }) => {
            const amount = row.original.amount;
            const type = row.original.type;
            const formatted = new Intl.NumberFormat("id-ID", {
                style: "currency",
                currency: "IDR",
                minimumFractionDigits: 0,
            }).format(amount);

            return (
                <span className={type === "INJECTION" ? "text-emerald-600 font-medium" : "text-rose-600 font-medium"}>
                    {type === "INJECTION" ? "+" : "-"}{formatted}
                </span>
            );
        },
    },
    {
        id: "actions",
        cell: ({ row }) => {
            const transaction = row.original;

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
                        <DropdownMenuItem onClick={() => onEdit(transaction)}>
                            <Pencil className="mr-2 h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onDelete(transaction)} className="text-red-600">
                            <Trash className="mr-2 h-4 w-4" /> Hapus
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            );
        },
    },
];
