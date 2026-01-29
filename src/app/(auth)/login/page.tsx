"use client";

import { useState, useEffect, Suspense, useRef } from "react";
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
import { loginUser } from "@/lib/auth-client";
import { useAuthStore } from "@/store/useAuthStore";
import { ROLES } from "@/lib/constants";
import { AlertCircle } from "lucide-react";

/**
 * Helper untuk menerjemahkan kode error
 */
const getErrorMessage = (errorCode: string) => {
  const errorMessages: Record<string, string> = {
    CredentialsSignin: "Email atau password salah. Silakan periksa kembali dan coba lagi.",
    MissingCSRF: "Session expired, silahkan coba lagi",
    SessionRequired: "Anda harus login terlebih dahulu",
    AccessDenied: "Anda tidak memiliki akses untuk halaman ini",
    Configuration: "Terjadi kesalahan konfigurasi pada sistem, harap hubungi administrator",
    default: "Login gagal: " + errorCode
  };

  return errorMessages[errorCode] || errorMessages.default;
};

// Komponen terpisah yang menggunakan useSearchParams
function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams?.get("callbackUrl") || "/dashboard";
  const error = searchParams?.get("error");
  const reset = searchParams?.get("reset");
  const signout = searchParams?.get("signout");
  const resetEmailSent = searchParams?.get("reset-email");
  const registerSuccess = searchParams?.get("register");
  const resetSuccess = searchParams?.get("reset-success");
  const { login } = useAuthStore();
  
  // Track if toast was already shown to prevent duplicates
  const toastShownRef = useRef(false);

  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [formError, setFormError] = useState("");

  // Tampilkan pesan berdasarkan parameter URL - gunakan useEffect untuk menghindari hydration error
  useEffect(() => {
    // Prevent duplicate toasts on re-renders
    if (toastShownRef.current) return;
    
    const hasNotification = error || reset || signout || resetEmailSent || registerSuccess || resetSuccess;
    if (!hasNotification) return;
    
    toastShownRef.current = true;
    
    if (error) {
      toast.error(getErrorMessage(error), {
        duration: 5000,
        position: 'top-center'
      });

      // Set form error untuk visual cue
      if (error === 'CredentialsSignin') {
        setFormError('credentials');
      }
    }

    if (reset) {
      toast.success("Session berhasil di-reset. Silakan login kembali", {
        duration: 3000
      });
    }

    if (signout) {
      toast.success("Anda berhasil logout", {
        duration: 3000
      });
    }

    if (resetEmailSent) {
      toast.success("Instruksi reset password telah dikirim ke email Anda", {
        duration: 5000,
        position: 'top-center'
      });
    }

    if (registerSuccess) {
      toast.success("Registrasi berhasil! Silakan login dengan akun Anda.", {
        duration: 5000,
        position: 'top-center'
      });
    }

    if (resetSuccess) {
      toast.success("Password berhasil diubah. Silakan login dengan password baru Anda.", {
        duration: 5000,
        position: 'top-center'
      });
    }
  }, [error, reset, signout, resetEmailSent, registerSuccess, resetSuccess]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Reset form error ketika user mulai mengetik
    if (formError) {
      setFormError("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setFormError("");

    try {
      // Gunakan loginUser dari auth-client
      const result = await loginUser(formData.email, formData.password);

      if (!result.success) {
        if (result.error === 'CredentialsSignin') {
          setFormError('credentials');
          toast.error("Email atau password salah. Silakan periksa kembali dan coba lagi.", {
            duration: 5000,
            position: 'top-center'
          });
        } else {
          toast.error(result.error || "Terjadi kesalahan saat login", {
            duration: 5000,
            position: 'top-center'
          });
        }
        setIsLoading(false);
        return;
      }

      // Login juga ke Zustand store (opsional, untuk kompatibilitas)
      login(
        {
          id: formData.email.includes("owner") ? "1" : "2",
          name: formData.email.includes("owner") ? "Owner User" : "Cashier User",
          email: formData.email,
          role: ROLES.CASHIER, // Default fallback, actual role handles by backend/session
        }
      );

      // Tampilkan toast sukses
      toast.success("Login berhasil! Mengalihkan...");

      // Redirect ke callback URL
      router.push(callbackUrl);
      router.refresh(); // Refresh untuk update middleware
    } catch (error: any) {
      console.error("Login error:", error);
      toast.error("Terjadi kesalahan saat login. Silakan coba lagi nanti.", {
        duration: 5000
      });
    } finally {
      setIsLoading(false);
    }
  };

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
            <CardTitle className="text-2xl text-center font-bold">Login</CardTitle>
            <CardDescription className="text-center">
              Masukkan email dan password untuk mengakses akun
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  htmlFor="email"
                >
                  Email
                </label>
                <div className="relative">
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="email@example.com"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className={formError === 'credentials' ? 'border-red-500 pr-10' : ''}
                  />
                  {formError === 'credentials' && (
                    <AlertCircle className="h-5 w-5 text-red-500 absolute right-3 top-1/2 transform -translate-y-1/2" />
                  )}
                </div>
                {formError === 'credentials' && (
                  <p className="text-sm text-red-500 mt-1">Email atau password tidak valid</p>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    htmlFor="password"
                  >
                    Password
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-sm text-primary underline-offset-4 hover:underline"
                    data-testid="forgot-password-link"
                    onClick={(e) => {
                      e.preventDefault();
                      router.push('/forgot-password');
                    }}
                  >
                    Lupa password?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    className={formError === 'credentials' ? 'border-red-500 pr-10' : ''}
                  />
                  {formError === 'credentials' && (
                    <AlertCircle className="h-5 w-5 text-red-500 absolute right-3 top-1/2 transform -translate-y-1/2" />
                  )}
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4 mt-4">
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
                data-testid="login-button"
              >
                {isLoading ? "Memproses..." : "Login"}
              </Button>
              <div className="flex items-center justify-center">
                <span className="text-sm text-muted-foreground">
                  Belum punya akun?{" "}
                </span>
                <Link
                  href="/register"
                  className="text-sm text-primary underline-offset-4 hover:underline ml-1"
                  data-testid="register-link"
                >
                  Registrasi
                </Link>
              </div>
            </CardFooter>
          </form>
          <div className="mt-6 p-4 border rounded-lg bg-muted/30">
            <h3 className="text-sm font-medium text-center mb-3">Akun Demo</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="bg-primary/10 p-3 rounded-md h-full flex flex-col">
                  <h4 className="text-xs font-semibold text-primary mb-2">Toko Utama</h4>
                  <div className="space-y-2 flex-grow">
                    <div className="flex flex-col">
                      <span className="text-xs font-medium mb-1">Owner:</span>
                      <code className="bg-background px-2 py-1 rounded text-xs flex-1 overflow-hidden text-ellipsis">owner@feedly.com</code>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-medium mb-1">Kasir:</span>
                      <code className="bg-background px-2 py-1 rounded text-xs flex-1 overflow-hidden text-ellipsis">kasir1@feedly.com</code>
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="bg-primary/10 p-3 rounded-md h-full flex flex-col">
                  <h4 className="text-xs font-semibold text-primary mb-2">Toko Kedua</h4>
                  <div className="space-y-2 flex-grow">
                    <div className="flex flex-col">
                      <span className="text-xs font-medium mb-1">Owner:</span>
                      <code className="bg-background px-2 py-1 rounded text-xs flex-1 overflow-hidden text-ellipsis">owner2@feedly.com</code>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-medium mb-1">Kasir:</span>
                      <code className="bg-background px-2 py-1 rounded text-xs flex-1 overflow-hidden text-ellipsis">kasir2@feedly.com</code>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-3 bg-background/50 p-2 rounded-md text-center">
              <p className="text-xs text-muted-foreground">
                Password untuk semua akun: <code className="bg-primary/5 px-2 py-0.5 rounded font-medium">password123</code>
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

// Komponen utama yang membungkus LoginContent dengan Suspense
export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen w-full flex items-center justify-center">
        <div className="w-full max-w-md space-y-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Memuat halaman login...</p>
        </div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
} 