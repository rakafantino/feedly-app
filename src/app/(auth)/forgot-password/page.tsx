"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import Link from "next/link";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import emailjs from "@emailjs/browser";

// Inisialisasi EmailJS client-side
if (typeof window !== 'undefined') {
  emailjs.init(process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY || "");
}

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
  };

  // Fungsi untuk mengirim email dengan EmailJS
  const sendEmailWithEmailJS = async (config: any) => {
    try {
      console.log("Mengirim email menggunakan EmailJS client-side...");
      console.log("Config:", config);
      
      const result = await emailjs.send(
        config.serviceId,
        config.templateId,
        config.templateParams
      );
      
      console.log("Email berhasil dikirim:", result.text);
      return true;
    } catch (error) {
      console.error("Gagal mengirim email:", error);
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast.error("Masukkan alamat email Anda");
      return;
    }
    
    setIsLoading(true);
    
    try {
      // 1. Kirim request ke API untuk mendapatkan token dan konfigurasi
      const response = await fetch("/api/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });
      
      const data = await response.json();

      // 2. Memeriksa hasil dari API
      if (response.ok) {
        console.log("Reset password request berhasil:", data);
        
        // 3. Jika perlu mengirim email, gunakan EmailJS client-side
        if (data.needToSendEmail && data.emailConfig) {
          const emailSent = await sendEmailWithEmailJS(data.emailConfig);
          
          if (emailSent) {
            toast.success("Instruksi reset password telah dikirim ke email Anda");
          } else {
            toast.error("Gagal mengirim email, tapi token reset sudah dibuat. Silakan hubungi admin.");
          }
        }
        
        setEmailSent(true);
        
        // Tunggu sebentar kemudian redirect ke halaman login
        setTimeout(() => {
          router.push("/login?reset-email=sent");
        }, 2000);
      } else {
        console.error("Error reset password:", data.error);
        toast.error(data.error || "Terjadi kesalahan, silahkan coba lagi");
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("Terjadi kesalahan, silahkan coba lagi");
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
            <CardTitle className="text-2xl text-center font-bold">
              Lupa Password
            </CardTitle>
            <CardDescription className="text-center">
              Masukkan email Anda dan kami akan mengirimkan instruksi untuk reset password
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {!emailSent ? (
                <div className="space-y-2">
                  <label
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    htmlFor="email"
                  >
                    Email
                  </label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={handleChange}
                    placeholder="nama@email.com"
                    autoComplete="email"
                    required
                    disabled={isLoading}
                  />
                </div>
              ) : (
                <div className="text-center p-4 bg-green-50 text-green-700 rounded-md mb-4">
                  <p>
                    Jika alamat email terdaftar, instruksi reset password telah dikirim.
                    Silakan periksa email Anda.
                  </p>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex flex-col space-y-4 pt-0">
              {!emailSent ? (
                <>
                  <Button type="submit" className="w-full mt-4" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Memproses...
                      </>
                    ) : (
                      "Kirim Instruksi Reset"
                    )}
                  </Button>
                  <div className="text-center text-sm text-muted-foreground">
                    <Link
                      href="/login"
                      className="text-sm text-primary underline-offset-4 hover:underline"
                    >
                      Kembali ke halaman login
                    </Link>
                  </div>
                </>
              ) : (
                <Link href="/login" className="w-full">
                  <Button type="button" className="w-full">
                    Kembali ke Login
                  </Button>
                </Link>
              )}
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
} 