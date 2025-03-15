/**
 * Format tanggal relatif (misal: "5 menit yang lalu")
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInSecs = Math.floor(diffInMs / 1000);
  const diffInMins = Math.floor(diffInSecs / 60);
  const diffInHours = Math.floor(diffInMins / 60);
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInSecs < 60) {
    return 'baru saja';
  } else if (diffInMins < 60) {
    return `${diffInMins} menit yang lalu`;
  } else if (diffInHours < 24) {
    return `${diffInHours} jam yang lalu`;
  } else if (diffInDays < 7) {
    return `${diffInDays} hari yang lalu`;
  } else {
    // Format tanggal lengkap untuk > 7 hari
    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }
}

/**
 * Menghitung rentang tanggal berdasarkan timeframe yang dipilih
 */
export function calculateDateRange(timeframe: 'day' | 'week' | 'month') {
  const now = new Date();
  let startDate: Date;
  const endDate: Date = new Date(now);
  let interval: 'hour' | 'day' | 'week';
  
  if (timeframe === 'day') {
    // 24 jam terakhir
    startDate = new Date(now);
    startDate.setHours(now.getHours() - 24);
    interval = 'hour';
  } else if (timeframe === 'week') {
    // 7 hari terakhir
    startDate = new Date(now);
    startDate.setDate(now.getDate() - 6);
    startDate.setHours(0, 0, 0, 0);
    interval = 'day';
  } else {
    // 30 hari terakhir (sekitar sebulan)
    startDate = new Date(now);
    startDate.setDate(now.getDate() - 30);
    startDate.setHours(0, 0, 0, 0);
    interval = 'week';
  }
  
  return { startDate, endDate, interval };
} 