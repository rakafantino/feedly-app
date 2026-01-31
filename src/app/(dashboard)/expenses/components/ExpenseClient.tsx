"use client";

import { useState } from "react";
import { Plus, Wallet } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Heading } from "@/components/ui/heading";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertModal } from "@/components/modals/alert-modal";
import { StatsSkeleton } from "@/components/skeleton";

import { getColumns, Expense } from "./columns";
import { ExpenseDialog } from "./ExpenseDialog";

export const ExpenseClient = () => {
    const queryClient = useQueryClient();

    // Default to current month (1st to Last day)
    const [dateRange, setDateRange] = useState<{ from: string; to: string }>(() => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
        
        return {
            from: `${year}-${month}-01`,
            to: `${year}-${month}-${lastDay}`
        };
    });

    const [open, setOpen] = useState(false);
    const [editingExpense, setEditingExpense] = useState<Expense | undefined>(undefined);
    
    // Delete State
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [expenseToDelete, setExpenseToDelete] = useState<Expense | undefined>(undefined);

    // React Query Fetch
    const { data: expenses = [], isLoading: loading } = useQuery({
        queryKey: ['expenses', dateRange],
        queryFn: async () => {
            const { from, to } = dateRange;
            const res = await fetch(`/api/expenses?startDate=${from}&endDate=${to}`);
            if (!res.ok) throw new Error("Gagal memuat data biaya");
            const json = await res.json();
            return json.expenses || [];
        }
    });

    // Calculate total from cached data
    const totalExpenses = expenses.reduce((sum: number, exp: Expense) => sum + exp.amount, 0);

    const handleEdit = (expense: Expense) => {
        setEditingExpense(expense);
        setOpen(true);
    };

    const handleDeleteClick = (expense: Expense) => {
        setExpenseToDelete(expense);
        setDeleteOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!expenseToDelete) return;
        try {
            const res = await fetch(`/api/expenses/${expenseToDelete.id}`, {
                method: "DELETE",
            });
            
            if (!res.ok) {
                const result = await res.json();
                throw new Error(result.error || "Gagal menghapus biaya");
            }
            
            toast.success("Biaya berhasil dihapus");
            queryClient.invalidateQueries({ queryKey: ['expenses'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-analytics'] });
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "Gagal menghapus biaya");
        } finally {
            setDeleteOpen(false);
            setExpenseToDelete(undefined);
        }
    };

    const handleCloseDialog = () => {
        setOpen(false);
        setEditingExpense(undefined);
    };

    const columns = getColumns({ onEdit: handleEdit, onDelete: handleDeleteClick });

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <Heading
                    title="Biaya Operasional"
                    description="Kelola pengeluaran operasional toko"
                />
                <Button onClick={() => setOpen(true)} size="sm" className="w-full sm:w-auto">
                    <Plus className="mr-2 h-4 w-4" /> Biaya Baru
                </Button>
            </div>
            <Separator />
            
            {/* Filter & Summary Section */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-1 lg:col-span-4">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">
                            Filter Tanggal
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="grid gap-1.5 w-full">
                                <label htmlFor="from" className="text-xs font-medium text-muted-foreground">Dari</label>
                                <input
                                    type="date"
                                    id="from"
                                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                    value={dateRange.from}
                                    onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                                />
                            </div>
                            <div className="grid gap-1.5 w-full">
                                <label htmlFor="to" className="text-xs font-medium text-muted-foreground">Sampai</label>
                                <input
                                    type="date"
                                    id="to"
                                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                    value={dateRange.to}
                                    onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Summary Card */}
                <Card className="col-span-1 lg:col-span-3 bg-gradient-to-br from-red-50 to-orange-50 border-red-100">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-red-800">
                            Total Pengeluaran (Periode Ini)
                        </CardTitle>
                        <Wallet className="h-4 w-4 text-red-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">
                            {loading ? (
                                <StatsSkeleton count={1} variant="compact" />
                            ) : (
                                `Rp ${totalExpenses.toLocaleString("id-ID")}`
                            )}
                        </div>
                        <p className="text-xs text-red-700 mt-1">
                            {expenses.length} transaksi ditemukan
                        </p>
                    </CardContent>
                </Card>
            </div>

            <DataTable 
                searchKey="description" 
                columns={columns} 
                data={expenses} 
                isLoading={loading}
            />

            <ExpenseDialog
                isOpen={open}
                onClose={handleCloseDialog}
                expense={editingExpense}
                onSuccess={() => queryClient.invalidateQueries({ queryKey: ['expenses'] })}
            />

            <AlertModal
                isOpen={deleteOpen}
                onClose={() => setDeleteOpen(false)}
                onConfirm={handleConfirmDelete}
                loading={false} // Delete is async inside component but we can just let modal close or manage separate state if strictly needed. With invalidate it's fast.
            />
        </div>
    );
};
