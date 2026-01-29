"use client";

import { useState } from "react";
import { useStore } from "@/components/providers/store-provider";
import { Button } from "@/components/ui/button";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { toast } from "sonner";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Store, LogOut, ChevronDown, Menu } from "lucide-react";
import { NotificationsMenu } from "@/components/ui/NotificationsMenu";

interface HeaderProps {
  user?: {
    name?: string | null;
    email?: string | null;
    role?: string | null;
  };
  onMobileMenuClick?: () => void;
}

function Header({ user, onMobileMenuClick }: HeaderProps) {
  const { selectedStore } = useStore();
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Skip header untuk halaman pilih toko
  if (pathname === "/select-store") {
    return null;
  }

  async function handleSignOut() {
    try {
      setIsLoggingOut(true);
      // Clear store from localStorage to prevent stale data on next login
      localStorage.removeItem('store-storage');
      await signOut({ callbackUrl: "/login" });
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Terjadi kesalahan saat logout");
      setIsLoggingOut(false);
    }
  }

  async function handleSwitchStore() {
    router.push("/select-store");
  }

  return (
    <header className="bg-white border-b sticky top-0 z-30">
      <div className="flex h-16 items-center justify-between px-3 sm:px-4 max-w-full overflow-hidden">
        <div className="flex items-center gap-2 min-w-0">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 mr-1 sm:hidden" 
            onClick={onMobileMenuClick}
            aria-label="Menu navigasi"
          >
            <Menu className="h-5 w-5" />
          </Button>
          
          {selectedStore && selectedStore.name && (
            <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm bg-primary/10 px-2 sm:px-3 py-1.5 rounded-md truncate">
              <Store className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
              <span className="font-medium truncate">{selectedStore.name}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 sm:gap-4 ml-2">
          <NotificationsMenu />
          
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-1 sm:gap-2 px-2 sm:px-3" aria-label="Menu pengguna">
                  <span className="hidden sm:inline-block truncate max-w-[100px] md:max-w-[150px]">
                    {user.name || user.email}
                  </span>
                  <span className="inline-block sm:hidden">
                    {user.name?.charAt(0) || user.email?.charAt(0) || "U"}
                  </span>
                  <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  {user.role && (
                    <div className="capitalize">{user.role}</div>
                  )}
                  <div className="font-medium truncate max-w-[200px]">{user.email}</div>
                </div>
                
                <DropdownMenuSeparator />
                
                <DropdownMenuItem 
                  className="cursor-pointer gap-2"
                  onClick={handleSwitchStore}
                >
                  <Store className="h-4 w-4" />
                  <span>Ganti Toko</span>
                </DropdownMenuItem>
                
                <DropdownMenuSeparator />
                
                <DropdownMenuItem 
                  className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                  onClick={handleSignOut}
                  disabled={isLoggingOut}
                >
                  <LogOut className="h-4 w-4" />
                  <span>Keluar</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
} 

export default Header;