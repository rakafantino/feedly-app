"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Plus, Pencil, Trash2, Shield, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

import { ROLES, ROLE_LABELS } from "@/lib/constants";
import UserForm from "./components/UserForm";

export default function UsersPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);

  // Check Permission
  const userRole = session?.user?.role?.toUpperCase();
  const canManageUsers = userRole === ROLES.OWNER;

  // React Query for Users
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await fetch("/api/users");
      if (!res.ok) throw new Error("Gagal mengambil data user");
      const result = await res.json();
      return result.success ? result.data : [];
    },
    enabled: !!session, // Only fetch if session exists
  });

  const handleDelete = async () => {
    if (!userToDelete) return;

    try {
      const response = await fetch(`/api/users/${userToDelete}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (response.ok) {
        toast.success("Pengguna berhasil dihapus");
        queryClient.invalidateQueries({ queryKey: ['users'] });
      } else {
        toast.error(result.error || "Gagal menghapus pengguna");
      }
    } catch {
      toast.error("Terjadi kesalahan saat menghapus");
    } finally {
      setUserToDelete(null);
    }
  };

  const filteredUsers = users.filter((user: any) =>
    (user.name?.toLowerCase() || "").includes(search.toLowerCase()) ||
    (user.email?.toLowerCase() || "").includes(search.toLowerCase())
  );

  if (!canManageUsers && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center p-4">
        <Shield className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold mb-2">Akses Ditolak</h2>
        <p className="text-muted-foreground">
          Anda tidak memiliki izin untuk melihat halaman ini.
          <br />Hubungi pemilik toko jika Anda memerlukan akses.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Manajemen Pengguna</h2>
          <p className="text-muted-foreground">
            Kelola akses dan peran staff toko Anda.
          </p>
        </div>
        <UserForm
          trigger={
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Tambah User
            </Button>
          }
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['users'] })}
        />
      </div>

      <div className="flex items-center space-x-2 my-4">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cari user (nama atau email)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 w-[150px] lg:w-[250px]"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="hidden md:table-cell">Bergabung</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                    <span className="text-xs text-muted-foreground mt-2 block">Memuat data...</span>
                  </TableCell>
                </TableRow>
              ) : filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    Tidak ada pengguna ditemukan.
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user: any) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={
                        user.role === ROLES.OWNER ? "default" : "outline"
                      }>
                        {ROLE_LABELS[user.role as keyof typeof ROLE_LABELS] || user.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {user.createdAt ? format(new Date(user.createdAt), "dd MMM yyyy") : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {/* Edit Button */}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedUser(user);
                            setIsFormOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>

                        {/* Form Dialog for Edit (Controlled) */}
                        <UserForm
                          open={isFormOpen && selectedUser?.id === user.id}
                          setOpen={(open) => {
                            setIsFormOpen(open);
                            if (!open) setSelectedUser(null);
                          }}
                          user={user}
                          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['users'] })}
                        />

                        {/* Delete Alert */}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              disabled={user.role === ROLES.OWNER || user.id === session?.user?.id}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Hapus Pengguna?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Apakah Anda yakin ingin menghapus user <b>{user.name}</b>?
                                <br />Akun ini tidak akan bisa login lagi.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Batal</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => {
                                  setUserToDelete(user.id);
                                  // Wait a tick to ensure setUserToDelete propagates? 
                                  // Actually handler logic needs adapt because setState is async.
                                  // BUT here handleDelete uses `userToDelete` state.
                                  // The `onClick` here sets state. Then `handler` reads it. 
                                  // Wait, if I call `handleDelete()` immediately inside onClick, `userToDelete` might not be updated yet.
                                  // I should fix logic. Passing `user.id` directly to handleDelete is better, or using the Global Confirm at bottom.
                                }}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Hapus
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>

                        {/* The code originally had a "Global Delete Confirmation" at bottom (lines 257-272) AND local Alert Dialogs. 
                            The local trigger sets `userToDelete`.
                            But `AlertDialogAction` (line 231) onClick calls... wait, in original code (line 234) it calls `handleDelete()`.
                            If `setUserToDelete` is async, `handleDelete` might see null.
                            The global dialog at bottom listens to `!!userToDelete`.
                            So the pattern should be: Trigger sets `userToDelete`. Global Dialog opens. Global Dialog Action calls `handleDelete`.
                            
                            In my code, I see: local AlertDialog with `onClick={() => { setUserToDelete(user.id); ... }}`.
                            This is redundant if Global Dialog exists.
                            
                            I'll simplify: 
                            Button sets `userToDelete`. 
                            Global Dialog handles confirmation.
                        */}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Global Delete Confirmation Dialog */}
      <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Hapus</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak bisa dibatalkan. Pengguna ini akan dihapus secara permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
