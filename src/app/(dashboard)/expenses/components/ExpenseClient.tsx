"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Heading } from "@/components/ui/heading";
import { Separator } from "@/components/ui/separator";
import { getColumns, Expense } from "./columns";
import { ExpenseDialog } from "./ExpenseDialog";
import { AlertModal } from "@/components/modals/alert-modal";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet } from "lucide-react";

export const ExpenseClient = () => {
    // Default to current month (1st to Last day)
    const [dateRange, setDateRange] = useState<{ from: string; to: string }>(() => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const lastDay = new Date(year, now.getMonth() + 1, 0).getDate(); // Get last day of month
        
        return {
            from: `${year}-${month}-01`,
            to: `${year}-${month}-${lastDay}` // Default to end of month as requested
        };
    });

    const [data, setData] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);
    const [editingExpense, setEditingExpense] = useState<Expense | undefined>(undefined);
    
    // Delete State
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [expenseToDelete, setExpenseToDelete] = useState<Expense | undefined>(undefined);

    // Summary
    const [totalExpenses, setTotalExpenses] = useState(0);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const { from, to } = dateRange;
            
            const res = await fetch(`/api/expenses?startDate=${from}&endDate=${to}`);
            const json = await res.json();
            const expenses = json.expenses || [];
            setData(expenses);
            
            // Calculate total
            const total = expenses.reduce((sum: number, exp: Expense) => sum + exp.amount, 0);
            setTotalExpenses(total);
        } catch (error) {
            console.error("Failed to fetch expenses", error);
            toast.error("Gagal memuat data biaya");
        } finally {
            setLoading(false);
        }
    }, [dateRange]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

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
            setLoading(true);
            const res = await fetch(`/api/expenses/${expenseToDelete.id}`, {
                method: "DELETE",
            });
            
            if (!res.ok) {
                throw new Error("Gagal menghapus biaya");
            }
            
            toast.success("Biaya berhasil dihapus");
            fetchData();
        } catch (error) {
            console.error(error);
            toast.error("Gagal menghapus biaya");
        } finally {
            setLoading(false);
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
                            Rp {totalExpenses.toLocaleString("id-ID")}
                        </div>
                        <p className="text-xs text-red-700 mt-1">
                            {data.length} transaksi ditemukan
                        </p>
                    </CardContent>
                </Card>
            </div>

            <DataTable searchKey="description" columns={columns} data={data} />

            <ExpenseDialog
                isOpen={open}
                onClose={handleCloseDialog}
                expense={editingExpense}
                onSuccess={fetchData}
            />

            <AlertModal
                isOpen={deleteOpen}
                onClose={() => setDeleteOpen(false)}
                onConfirm={handleConfirmDelete}
                loading={loading}
            />
        </div>
    );
};
