"use client";

import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthStore } from "@/store/useAuthStore";
import { LogOut, User, Menu } from "lucide-react";
import { logoutUser } from "@/lib/auth-client";
import { toast } from "sonner";

interface HeaderProps {
  onMobileMenuClick?: () => void;
}

export function Header({ onMobileMenuClick }: HeaderProps) {
  const { user, logout } = useAuthStore();

  const handleLogout = async () => {
    try {
      // Tampilkan loading toast
      toast.loading("Sedang melakukan logout...", { id: "logout" });
      
      // 1. Hapus data dari Zustand store
      logout();
      
      // 2. Panggil client-side logout
      const result = await logoutUser();
      
      if (!result.success) {
        throw new Error(result.error || 'Logout failed');
      }
      
      // 3. Tampilkan toast sukses
      toast.success("Logout berhasil", { id: "logout" });
      
      // 4. Redirect ke login
      window.location.href = "/login?signout=success";
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Terjadi kesalahan saat logout", { id: "logout" });
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6 md:px-8">
        <div className="flex items-center gap-2">
          {/* Hamburger menu untuk mobile */}
          <Button
            variant="ghost"
            size="icon"
            className="mr-2 h-8 w-8 sm:hidden"
            onClick={onMobileMenuClick}
            aria-label="Menu Navigasi"
          >
            <Menu className="h-5 w-5" />
          </Button>
          
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-lg font-bold"
          >
            <span className="text-primary text-xl">F</span>
            <span className="hidden md:inline">Feedly - Aplikasi Toko Pakan Ternak</span>
            <span className="inline md:hidden">Feedly</span>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-10 w-10 rounded-full"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage
                      src={`https://avatar.vercel.sh/${user.name}.png`}
                      alt={user.name}
                    />
                    <AvatarFallback>
                      {user.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user.name}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/profile" className="flex w-full cursor-pointer items-center">
                    <User className="mr-2 h-4 w-4" />
                    <span>Profil</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer text-destructive focus:text-destructive"
                  onClick={handleLogout}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Keluar</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild>
              <Link href="/login">Masuk</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
} 