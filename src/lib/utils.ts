import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatIDR(amount: number): string {
  return new Intl.NumberFormat('id-ID', { 
    style: 'currency', 
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format a date string to a localized format
 * @param dateString Date string to format
 * @returns Formatted date string in ID locale
 */
export function formatDate(dateString: string): string {
  if (!dateString) return '-';
  
  const date = new Date(dateString);
  
  // Check if date is valid
  if (isNaN(date.getTime())) return '-';
  
  return date.toLocaleDateString('id-ID', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Menentukan variant badge untuk stok produk
 */
export function getStockVariant(stock: number, threshold?: number | null) {
  // Jika stok habis
  if (stock <= 0) return "destructive";
  
  // Jika threshold tersedia, gunakan untuk perbandingan
  if (threshold !== undefined && threshold !== null) {
    // Jika stok di bawah threshold
    if (stock <= threshold) return "secondary";
  } else {
    // Default threshold: 5
    if (stock <= 5) return "secondary";
  }
  
  // Stok aman
  return "default";
}

/**
 * Get cookie value by name
 * @param name Cookie name
 * @returns Cookie value or undefined if not found
 */
export function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  
  const cookies = document.cookie.split(';');
  const cookie = cookies.find(c => c.trim().startsWith(`${name}=`));
  
  if (!cookie) return undefined;
  
  return cookie.split('=')[1].trim();
}
