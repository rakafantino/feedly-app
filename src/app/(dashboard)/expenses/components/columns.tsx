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
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

export type Expense = {
    id: string;
    amount: number;
    category: string;
    description: string | null;
    date: string;
    createdAt: string;
};

// Category labels for display
export const EXPENSE_CATEGORIES: Record<string, string> = {
    RENT: "Sewa",
    SALARY: "Gaji",
    UTILITIES: "Utilitas",
    SUPPLIES: "Perlengkapan",
    TRANSPORT: "Transportasi",
    MARKETING: "Marketing",
    MAINTENANCE: "Perawatan",
    OTHER: "Lainnya",
};

interface ColumnsProps {
    onEdit: (expense: Expense) => void;
    onDelete: (expense: Expense) => void;
}

export const getColumns = ({ onEdit, onDelete }: ColumnsProps): ColumnDef<Expense>[] => [
    {
        accessorKey: "date",
        header: "Tanggal",
        cell: ({ row }) => {
            const dateStr = row.original.date;
            try {
                return format(new Date(dateStr), "dd MMM yyyy", { locale: localeId });
            } catch {
                return dateStr;
            }
        },
    },
    {
        accessorKey: "category",
        header: "Kategori",
        cell: ({ row }) => {
            const cat = row.original.category;
            return EXPENSE_CATEGORIES[cat] || cat;
        },
    },
    {
        accessorKey: "description",
        header: "Keterangan",
        cell: ({ row }) => row.original.description || "-",
    },
    {
        accessorKey: "amount",
        header: () => <div className="text-right">Jumlah</div>,
        cell: ({ row }) => {
            const amount = row.original.amount;
            return (
                <div className="text-right font-medium text-red-600">
                    Rp {amount.toLocaleString("id-ID")}
                </div>
            );
        },
    },
    {
        id: "actions",
        cell: ({ row }) => {
            const expense = row.original;

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
                        <DropdownMenuItem onClick={() => onEdit(expense)}>
                            <Pencil className="mr-2 h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onDelete(expense)} className="text-red-600">
                            <Trash className="mr-2 h-4 w-4" /> Hapus
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            );
        },
    },
];
