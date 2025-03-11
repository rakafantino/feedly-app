"use client";

import { useState, Suspense } from "react";
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
import { useAuthStore } from "@/store/useAuthStore";
import { toast } from "sonner";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";

// Komponen yang menggunakan useSearchParams
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  const { login } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Menggunakan NextAuth untuk login
      const response = await signIn("credentials", {
        email: formData.email,
        password: formData.password,
        redirect: false,
      });

      if (response?.error) {
        toast.error("Email atau password salah");
        return;
      }

      // Login berhasil
      toast.success("Login berhasil");
      
      // Juga update state zustand (opsional jika masih dibutuhkan)
      // Sesuaikan dengan nilai di store (lowercase)
      const role = formData.email.includes("manager") ? "manager" : "cashier";
      login(
        {
          id: formData.email.includes("manager") ? "1" : "2",
          name: formData.email.includes("manager") ? "Manager User" : "Cashier User",
          email: formData.email,
          role: role,
        },
        "auth-token"
      );

      // Redirect ke callback URL (biasanya /dashboard)
      router.push(callbackUrl);
      router.refresh(); // Refresh halaman untuk memastikan middleware mendeteksi session baru
    } catch (error) {
      toast.error("Terjadi kesalahan saat login");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            htmlFor="email"
          >
            Email
          </label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="email@example.com"
            value={formData.email}
            onChange={handleChange}
            required
          />
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
            >
              Lupa password?
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            value={formData.password}
            onChange={handleChange}
            required
          />
        </div>
      </CardContent>
      <CardFooter className="flex flex-col space-y-4">
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "Logging in..." : "Login"}
        </Button>
        <div className="text-center text-sm text-muted-foreground">
          <p className="font-medium">Demo users:</p>
          <p>manager@example.com / password123</p>
          <p>cashier@example.com / password123</p>
        </div>
      </CardFooter>
    </form>
  );
}

// Komponen fallback sederhana
function LoginFormFallback() {
  return (
    <div className="p-4">
      <p className="text-center">Loading login form...</p>
    </div>
  );
}

export default function LoginPage() {
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
          <Suspense fallback={<LoginFormFallback />}>
            <LoginForm />
          </Suspense>
        </Card>
      </div>
    </div>
  );
} 