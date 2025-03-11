/**
 * Format angka ke format mata uang Rupiah
 * 
 * @param amount - Jumlah dalam angka yang akan diformat
 * @returns String dalam format Rupiah (contoh: Rp 75.000)
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Konversi string Rupiah ke angka
 * 
 * @param currencyString - String dalam format Rupiah (contoh: Rp 75.000)
 * @returns Jumlah dalam angka
 */
export function parseCurrency(currencyString: string): number {
  // Hilangkan 'Rp', spasi, dan karakter non-digit
  const numericString = currencyString.replace(/[^\d]/g, '');
  return parseInt(numericString, 10);
} 