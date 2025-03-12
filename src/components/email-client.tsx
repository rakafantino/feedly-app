"use client";

import { useEffect, useCallback } from "react";
import emailjs from "@emailjs/browser";

// Inisialisasi EmailJS di sisi klien
emailjs.init(process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY || "");

/**
 * Komponen untuk mengirim email dari client-side
 * @param props - Parameter komponen
 * @returns React.ReactNode
 */
export default function EmailSender({
  templateId,
  serviceId,
  templateParams,
  onSuccess,
  onError,
  autoSend = true,
}: {
  templateId: string;
  serviceId: string;
  templateParams: Record<string, unknown>;
  onSuccess?: (result: any) => void;
  onError?: (error: any) => void;
  autoSend?: boolean;
}) {
  /**
   * Fungsi untuk mengirim email menggunakan EmailJS
   */
  const sendEmail = useCallback(async () => {
    try {
      console.log("Mengirim email via client-side EmailJS...");
      console.log("Template params:", templateParams);

      const result = await emailjs.send(
        serviceId, 
        templateId, 
        templateParams
      );

      console.log("Email berhasil dikirim:", result.text);
      
      if (onSuccess) {
        onSuccess(result);
      }
      
      return result;
    } catch (error) {
      console.error("Gagal mengirim email:", error);
      
      if (onError) {
        onError(error);
      }
      
      throw error;
    }
  }, [serviceId, templateId, templateParams, onSuccess, onError]);

  useEffect(() => {
    // Hanya kirim email saat komponen di-mount jika autoSend true
    if (autoSend) {
      sendEmail();
    }
  }, [autoSend, sendEmail]);

  // Komponen ini tidak merender apa-apa
  return null;
} 