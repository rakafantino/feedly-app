import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { subscribeToStore } from '@/lib/notificationEvents';
import { getStoreNotifications } from '@/lib/notificationService';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  // Autentikasi pengguna
  const session = await auth();
  if (!session || !session.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const url = new URL(req.url);
  // Ambil storeId dari query, jika tidak ada fallback ke session atau cookie
  const storeId = url.searchParams.get('storeId') || session.user.storeId || req.cookies.get('selectedStoreId')?.value || null;
  
  if (!storeId) {
    return new Response('Store ID required', { status: 400 });
  }

  // Set headers untuk SSE
  const headers = new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let unsubscribe: (() => void) | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (payload: string) => controller.enqueue(encoder.encode(payload));

      // Kirim snapshot awal untuk store
      try {
        const notifications = await getStoreNotifications(storeId);
        const unreadCount = notifications.filter(n => !n.read).length;
        const initMsg = { type: 'init', storeId, notifications, unreadCount };
        send(`data: ${JSON.stringify(initMsg)}\n\n`);
      } catch {
        // Abaikan error snapshot awal, koneksi tetap dibuka
      }

      // Subscribe untuk store tertentu
      unsubscribe = subscribeToStore(storeId, send);

      // Heartbeat agar koneksi tidak diputus oleh proxy
      heartbeat = setInterval(() => {
        // komentar SSE menjaga koneksi
        send(': heartbeat\n\n');
      }, 30000);

      // Tandai stream dimulai (komentar SSE)
      send(': stream-started\n\n');
    },
    cancel() {
      // Cleanup saat klien menutup koneksi
      if (heartbeat) {
        clearInterval(heartbeat);
        heartbeat = null;
      }
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
    }
  });

  return new Response(stream, { headers });
}