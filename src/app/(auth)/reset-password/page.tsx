"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";

// Komponen terpisah yang menggunakan useSearchParams
function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Verifikasi token saat komponen dimuat
  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        // Jika tidak ada token, redirect ke halaman forgot password
        toast.error("Token reset password tidak valid");
        setTimeout(() => {
          router.push("/forgot-password");
        }, 2000);
        return;
      }

      try {
        const response = await fetch(`/api/verify-reset-token?token=${token}`);
        const data = await response.json();

        if (!response.ok || !data.valid) {
          toast.error(data.error || "Token reset password tidak valid atau sudah kedaluwarsa");
          setTimeout(() => {
            router.push("/forgot-password");
          }, 2000);
          return;
        }
      } catch (error) {
        console.error("Token verification error:", error);
        toast.error("Terjadi kesalahan saat memverifikasi token");
        setTimeout(() => {
          router.push("/forgot-password");
        }, 2000);
      } finally {
        setIsVerifying(false);
      }
    };

    verifyToken();
  }, [token, router]);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!formData.password) {
      errors.password = "Password baru harus diisi";
    } else if (formData.password.length < 6) {
      errors.password = "Password minimal 6 karakter";
    }
    
    if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = "Password tidak sama";
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    
    // Reset error untuk field ini saat user mulai mengetik
    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsLoading(true);

    try {
      const response = await fetch('/api/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          password: formData.password,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        toast.error(data.error || "Gagal mengubah password");
        setIsLoading(false);
        return;
      }
      
      toast.success("Password berhasil diubah");
      
      // Redirect ke halaman login
      setTimeout(() => {
        router.push("/login?reset-success=true");
      }, 2000);
    } catch (error) {
      console.error("Reset password error:", error);
      toast.error("Terjadi kesalahan saat mengubah password");
    } finally {
      setIsLoading(false);
    }
  };

  // Tampilkan loading selama verifikasi token
  if (isVerifying) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Memverifikasi token reset password...</p>
        </div>
      </div>
    );
  }

  // Jika token tidak valid, halaman ini akan me-redirect otomatis

  // Jika token valid, tampilkan form reset password
  return (
    <div className="min-h-screen w-full flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Feedly</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Aplikasi Kasir Toko Pakan Ternak
          </p>
        </div>
        
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center font-bold">Atur Password Baru</CardTitle>
            <CardDescription className="text-center">
              Masukkan password baru untuk akun Anda
            </CardDescription>
          </CardHeader>
          
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {/* Password Baru */}
              <div className="space-y-2">
                <label
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  htmlFor="password"
                >
                  Password Baru
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    className={formErrors.password ? 'border-red-500 pr-10' : ''}
                  />
                  {formErrors.password && (
                    <AlertCircle className="h-5 w-5 text-red-500 absolute right-3 top-1/2 transform -translate-y-1/2" />
                  )}
                </div>
                {formErrors.password && (
                  <p className="text-sm text-red-500 mt-1">{formErrors.password}</p>
                )}
              </div>
              
              {/* Konfirmasi Password */}
              <div className="space-y-2">
                <label
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  htmlFor="confirmPassword"
                >
                  Konfirmasi Password
                </label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="••••••••"
                    className={formErrors.confirmPassword ? 'border-red-500 pr-10' : ''}
                  />
                  {formErrors.confirmPassword && (
                    <AlertCircle className="h-5 w-5 text-red-500 absolute right-3 top-1/2 transform -translate-y-1/2" />
                  )}
                </div>
                {formErrors.confirmPassword && (
                  <p className="text-sm text-red-500 mt-1">{formErrors.confirmPassword}</p>
                )}
              </div>
            </CardContent>
            
            <CardFooter className="flex flex-col space-y-4 mt-4">
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Memproses..." : "Reset Password"}
              </Button>
              <div className="text-center">
                <Link
                  href="/login"
                  className="text-sm text-primary underline-offset-4 hover:underline"
                >
                  Kembali ke halaman login
                </Link>
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}

// Komponen utama yang membungkus ResetPasswordContent dengan Suspense
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen w-full flex items-center justify-center">
        <div className="w-full max-w-md space-y-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Memuat halaman reset password...</p>
        </div>
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
} 