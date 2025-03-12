"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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

export default function RegisterPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!formData.name.trim()) {
      errors.name = "Nama harus diisi";
    }
    
    if (!formData.email.trim()) {
      errors.email = "Email harus diisi";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = "Format email tidak valid";
    }
    
    if (!formData.password) {
      errors.password = "Password harus diisi";
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
    
    // Validasi form
    if (!validateForm()) {
      return;
    }
    
    setIsLoading(true);

    try {
      // Kirim data ke API registrasi
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        // Jika error
        if (response.status === 409) {
          // Email sudah terdaftar
          setFormErrors((prev) => ({ ...prev, email: data.error }));
          toast.error(data.error);
        } else {
          // Error lainnya
          toast.error(data.error || 'Terjadi kesalahan saat registrasi');
        }
        setIsLoading(false);
        return;
      }
      
      // Reset form dan tampilkan toast sukses
      toast.success("Akun berhasil dibuat! Silakan login.", {
        duration: 5000
      });
      
      // Redirect ke halaman login setelah beberapa detik
      setTimeout(() => {
        router.push("/login?register=success");
      }, 1000);
    } catch (error) {
      console.error("Registration error:", error);
      toast.error("Terjadi kesalahan saat menghubungi server");
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
            <CardTitle className="text-2xl text-center font-bold">Buat Akun</CardTitle>
            <CardDescription className="text-center">
              Daftar untuk mulai menggunakan aplikasi
            </CardDescription>
          </CardHeader>
          
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {/* Nama Lengkap */}
              <div className="space-y-2">
                <label
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  htmlFor="name"
                >
                  Nama Lengkap
                </label>
                <div className="relative">
                  <Input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Masukkan nama lengkap"
                    className={formErrors.name ? 'border-red-500 pr-10' : ''}
                  />
                  {formErrors.name && (
                    <AlertCircle className="h-5 w-5 text-red-500 absolute right-3 top-1/2 transform -translate-y-1/2" />
                  )}
                </div>
                {formErrors.name && (
                  <p className="text-sm text-red-500 mt-1">{formErrors.name}</p>
                )}
              </div>
              
              {/* Email */}
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
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="email@example.com"
                    className={formErrors.email ? 'border-red-500 pr-10' : ''}
                  />
                  {formErrors.email && (
                    <AlertCircle className="h-5 w-5 text-red-500 absolute right-3 top-1/2 transform -translate-y-1/2" />
                  )}
                </div>
                {formErrors.email && (
                  <p className="text-sm text-red-500 mt-1">{formErrors.email}</p>
                )}
              </div>
              
              {/* Password */}
              <div className="space-y-2">
                <label
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  htmlFor="password"
                >
                  Password
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
              
              {/* Confirm Password */}
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
                {isLoading ? "Mendaftar..." : "Daftar"}
              </Button>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  Sudah punya akun?{" "}
                  <Link
                    href="/login"
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    Login
                  </Link>
                </p>
              </div>
            </CardFooter>
          </form>
        </Card>
        
        <div className="text-center text-sm text-muted-foreground">
          <p>
            Catatan: Dalam aplikasi demo ini, fitur registrasi hanya simulasi.
            <br />
            Harap gunakan kredensial demo yang disediakan di halaman login.
          </p>
        </div>
      </div>
    </div>
  );
} 