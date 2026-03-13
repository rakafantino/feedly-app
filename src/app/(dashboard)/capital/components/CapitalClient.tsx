"use client";

import { useState } from "react";
import { Plus, Landmark } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Heading } from "@/components/ui/heading";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatsSkeleton } from "@/components/skeleton";
import { AlertModal } from "@/components/modals/alert-modal";

import { getColumns, CapitalTransaction } from "./columns";
import { CapitalModal } from "./CapitalModal";

export const CapitalClient = () => {
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
    const [selectedTransaction, setSelectedTransaction] = useState<CapitalTransaction | null>(null);
    
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [transactionToDelete, setTransactionToDelete] = useState<CapitalTransaction | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // React Query Fetch
    const { data: transactions = [], isLoading: loading } = useQuery({
        queryKey: ['capital', dateRange],
        queryFn: async () => {
            const { from, to } = dateRange;
            const res = await fetch(`/api/capital?startDate=${from}&endDate=${to}`);
            if (!res.ok) throw new Error("Gagal memuat data modal");
            const json = await res.json();
            return json.capitalTransactions || [];
        }
    });

    // Calculate total from cached data
    const totalInjection = transactions
        .filter((t: CapitalTransaction) => t.type === "INJECTION")
        .reduce((sum: number, t: CapitalTransaction) => sum + t.amount, 0);

    const totalWithdrawal = transactions
        .filter((t: CapitalTransaction) => t.type === "WITHDRAWAL")
        .reduce((sum: number, t: CapitalTransaction) => sum + t.amount, 0);

    const netCapital = totalInjection - totalWithdrawal;

    const handleEdit = (transaction: CapitalTransaction) => {
        setSelectedTransaction(transaction);
        setOpen(true);
    };

    const handleDeleteClick = (transaction: CapitalTransaction) => {
        setTransactionToDelete(transaction);
        setDeleteModalOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!transactionToDelete) return;

        try {
            setIsDeleting(true);
            const res = await fetch(`/api/capital/${transactionToDelete.id}`, {
                method: "DELETE",
            });

            if (!res.ok) {
                const result = await res.json();
                throw new Error(result.error || "Gagal menghapus transaksi");
            }

            toast.success("Transaksi berhasil dihapus");
            queryClient.invalidateQueries({ queryKey: ['capital'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-analytics'] });
        } catch (error: any) {
            toast.error(error.message || "Terjadi kesalahan saat menghapus");
        } finally {
            setIsDeleting(false);
            setDeleteModalOpen(false);
            setTransactionToDelete(null);
        }
    };

    const columns = getColumns({
        onEdit: handleEdit,
        onDelete: handleDeleteClick,
    });

    return (
        <div className="space-y-4">
            <AlertModal
                isOpen={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={handleDeleteConfirm}
                loading={isDeleting}
            />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <Heading
                    title="Modal & Prive"
                    description="Kelola arus modal dan penarikan uang (prive)"
                />
                <Button onClick={() => {
                    setSelectedTransaction(null);
                    setOpen(true);
                }} size="sm" className="w-full sm:w-auto">
                    <Plus className="mr-2 h-4 w-4" /> Tambah Transaksi
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
                <Card className="col-span-1 lg:col-span-3 bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-100">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-emerald-800">
                            Net Modal (Periode Ini)
                        </CardTitle>
                        <Landmark className="h-4 w-4 text-emerald-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-600">
                            {loading ? (
                                <StatsSkeleton count={1} variant="compact" />
                            ) : (
                                `Rp ${netCapital.toLocaleString("id-ID")}`
                            )}
                        </div>
                        <p className="text-xs text-emerald-700 mt-1">
                            + Rp {totalInjection.toLocaleString("id-ID")} | - Rp {totalWithdrawal.toLocaleString("id-ID")}
                        </p>
                    </CardContent>
                </Card>
            </div>

            <DataTable 
                searchKey="notes" 
                columns={columns} 
                data={transactions} 
                isLoading={loading}
            />

            <CapitalModal
                isOpen={open}
                initialData={selectedTransaction}
                onClose={() => {
                    setOpen(false);
                    setTimeout(() => setSelectedTransaction(null), 300);
                }}
                onSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: ['capital'] });
                    queryClient.invalidateQueries({ queryKey: ['dashboard-analytics'] });
                }}
            />
        </div>
    );
};
