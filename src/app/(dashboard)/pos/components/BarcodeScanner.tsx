"use client";

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { toast } from 'sonner';
import { QrCode, X } from 'lucide-react';

interface BarcodeScannerProps {
  onScan: (barcodeValue: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export function BarcodeScanner({ onScan, isOpen, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [hasError, setHasError] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  // Memulai scanner ketika komponen terbuka
  useEffect(() => {
    if (isOpen) {
      startScanner();
    } else {
      stopScanner();
    }

    return () => {
      stopScanner();
    };
  }, [isOpen]);

  // Fungsi untuk memulai scanner
  const startScanner = async () => {
    try {
      setIsScanning(true);
      setHasError(false);

      // Mendapatkan akses kamera
      const constraints = {
        video: { 
          facingMode: 'environment', // Mencoba menggunakan kamera belakang
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Mulai pemindaian saat video siap
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            videoRef.current.play();
            // Di sini kita akan menambahkan logika deteksi barcode (sementara manual)
          }
        };
      }
    } catch (error) {
      console.error('Error starting scanner:', error);
      setHasError(true);
      toast.error('Gagal mengakses kamera');
    }
  };

  // Menghentikan scanner
  const stopScanner = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
  };

  // Mengemulasi pembacaan kode batang
  const simulateScan = (value: string) => {
    onScan(value);
    onClose();
  };

  return (
    <Card className="w-full border-0 sm:border overflow-hidden">
      <CardContent className="p-0 relative">
        {hasError ? (
          <div className="aspect-video bg-muted flex items-center justify-center p-6 text-center">
            <div>
              <p className="mb-4 text-destructive font-medium">
                Tidak dapat mengakses kamera.
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                Pastikan browser memiliki izin akses kamera
                dan tidak ada aplikasi lain yang menggunakan kamera.
              </p>
              <Button onClick={startScanner}>Coba Lagi</Button>
            </div>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              className="w-full aspect-video object-cover"
              muted
              playsInline
            />
            <canvas ref={canvasRef} className="hidden" />
            
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-2/3 border-2 border-primary rounded-lg h-1/3 flex items-center justify-center">
                {isScanning && (
                  <QrCode className="h-10 w-10 text-primary/30 animate-pulse" />
                )}
              </div>
            </div>
          </>
        )}
        
        <Button
          onClick={onClose}
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 bg-background/80 rounded-full z-10"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </Button>
      </CardContent>
      
      <CardFooter className="flex justify-between p-4">
        <div className="text-sm text-muted-foreground">
          Posisikan barcode di dalam kotak
        </div>
        
        {/* Simulasi button untuk testing tanpa deteksi barcode otomatis */}
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => simulateScan('8991234567890')}
            className="text-xs"
          >
            Simulasi Scan
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
} 