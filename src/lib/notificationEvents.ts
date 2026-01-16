/**
 * notificationEvents.ts
 * Event hub sederhana untuk Server-Sent Events (SSE) notifikasi stok per toko
 */

// Tipe fungsi subscriber: menerima payload string yang sudah diformat SSE (mis. "data: ...\n\n")
type Subscriber = (payload: string) => void;

// Map storeId -> Set of subscribers
const subscribers: Map<string, Set<Subscriber>> = new Map();

/**
 * Mendaftarkan subscriber untuk storeId tertentu.
 * Mengembalikan fungsi unsubscribe untuk membersihkan saat koneksi ditutup.
 */
export function subscribeToStore(storeId: string, send: Subscriber): () => void {
  let set = subscribers.get(storeId);
  if (!set) {
    set = new Set<Subscriber>();
    subscribers.set(storeId, set);
  }
  set.add(send);
  return () => {
    const current = subscribers.get(storeId);
    if (current) {
      current.delete(send);
      if (current.size === 0) {
        subscribers.delete(storeId);
      }
    }
  };
}

/**
 * Broadcast pesan ke semua subscriber yang berlangganan storeId.
 * Pesan akan dikirim sebagai SSE event default (tanpa event name), dalam format:
 *   data: <json>\n\n
 */
export function broadcastStockAlerts(storeId: string, message: any): void {
  const set = subscribers.get(storeId);
  if (!set || set.size === 0) return;

  const payload = `data: ${JSON.stringify(message)}\n\n`;
  for (const send of set) {
    try {
      send(payload);
    } catch {
      // Jika terjadi error saat mengirim, biarkan route SSE melakukan cleanup saat cancel.
      // Di sini kita abaikan saja agar broadcast ke subscriber lain tetap berjalan.
      // console.warn(`[SSE] Error broadcasting to subscriber of store ${storeId}:`, err);
    }
  }
}