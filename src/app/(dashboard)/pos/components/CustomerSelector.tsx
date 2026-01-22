"use client";

import { useState, useEffect } from "react";
import { Check, ChevronsUpDown, Search, User, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

interface Customer {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
}

interface CustomerSelectorProps {
    selectedCustomer: Customer | null;
    onSelectCustomer: (customer: Customer | null) => void;
    className?: string;
}

export function CustomerSelector({
    selectedCustomer,
    onSelectCustomer,
    className
}: CustomerSelectorProps) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(false);

    // Simple debounce implementation if hook doesn't exist
    const [debouncedQuery, setDebouncedQuery] = useState(query);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQuery(query);
        }, 500);
        return () => clearTimeout(timer);
    }, [query]);

    useEffect(() => {
        const fetchCustomers = async () => {
            setLoading(true);
            try {
                // Construct query URL
                // Currently the API returns all customers. 
                // Ideally we should have server-side filtering, but for now we fetch all and filter locally 
                // OR if the API supports search (which it might not yet), we use that.
                // Based on the tasks, we only implemented simple GET.
                // So we might fetch all and filter client side if the list is small, 
                // OR we should have implemented search in API. 
                // Let's assume for now we fetch list and filter client side for better UX on small datasets,
                // but robust solution is server search.
                // Let's check api/customers route again? No, I recall it was simple getAll.
                // I will assume getAll for now (Phase 1).

                const res = await fetch("/api/customers");
                if (!res.ok) throw new Error("Failed to fetch customers");
                const data = await res.json();

                // API returns array directly
                let filtered = Array.isArray(data) ? data : (data.customers || []);

                if (debouncedQuery) {
                    const lowerQuery = debouncedQuery.toLowerCase();
                    filtered = filtered.filter((c: Customer) =>
                        c.name.toLowerCase().includes(lowerQuery) ||
                        (c.phone && c.phone.includes(lowerQuery)) ||
                        (c.email && c.email.toLowerCase().includes(lowerQuery))
                    );
                }

                setCustomers(filtered.slice(0, 10)); // Limit to 10 suggestions
            } catch (error) {
                console.error(error);
                toast.error("Gagal memuat data pelanggan");
            } finally {
                setLoading(false);
            }
        };

        if (open) {
            fetchCustomers();
        }
    }, [open, debouncedQuery]);

    return (
        <div className={cn("w-full", className)}>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-full justify-between h-10"
                    >
                        {selectedCustomer ? (
                            <div className="flex items-center gap-2 overflow-hidden">
                                <User className="h-4 w-4 shrink-0 opacity-50" />
                                <span className="truncate">{selectedCustomer.name}</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <Search className="h-4 w-4 shrink-0 opacity-50" />
                                <span>Cari Pelanggan...</span>
                            </div>
                        )}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px] p-0 gap-0 z-[200]" overlayClassName="z-[200]">
                    <DialogHeader className="px-4 py-3 border-b">
                        <DialogTitle className="text-base font-medium">Pilih Pelanggan</DialogTitle>
                    </DialogHeader>
                    <div className="p-4 border-b">
                        <div className="flex items-center border rounded-md px-3 bg-muted/40">
                            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                            <Input
                                placeholder="Cari nama atau no. HP..."
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                className="flex h-10 w-full bg-transparent border-0 focus-visible:ring-0 px-0 shadow-none"
                                autoFocus
                            />
                        </div>
                    </div>
                    <ScrollArea className="h-[300px]">
                        {loading ? (
                            <div className="p-4 text-center text-sm text-muted-foreground">
                                Memuat...
                            </div>
                        ) : customers.length === 0 ? (
                            <div className="p-4 text-center text-sm text-muted-foreground">
                                Tidak ada pelanggan ditemukan.
                            </div>
                        ) : (
                            <div className="p-1">
                                {customers.map((customer) => (
                                    <Button
                                        key={customer.id}
                                        variant="ghost"
                                        className="w-full justify-start font-normal h-auto py-3 px-4 border-b last:border-0 rounded-none"
                                        onClick={() => {
                                            onSelectCustomer(customer);
                                            setOpen(false);
                                            setQuery("");
                                        }}
                                    >
                                        <div className="flex flex-col items-start gap-1 w-full">
                                            <div className="flex items-center justify-between w-full">
                                                <span className="font-medium truncate text-base">{customer.name}</span>
                                                {selectedCustomer?.id === customer.id && (
                                                    <Check className="h-4 w-4 text-primary" />
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                {customer.phone && <span>{customer.phone}</span>}
                                                {customer.address && (
                                                    <span className="truncate max-w-[200px] hidden sm:inline">• {customer.address}</span>
                                                )}
                                            </div>
                                        </div>
                                    </Button>
                                ))}
                            </div>
                        )}
                    </ScrollArea>
                </DialogContent>
            </Dialog>

            {selectedCustomer && (
                <div className="mt-2 flex items-center justify-between p-2 rounded-md bg-muted/50 border text-sm">
                    <div className="flex flex-col">
                        <span className="font-medium text-primary">{selectedCustomer.name}</span>
                        {selectedCustomer.phone && (
                            <span className="text-xs text-muted-foreground">{selectedCustomer.phone}</span>
                        )}
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => onSelectCustomer(null)}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            )}
        </div>
    );
}
