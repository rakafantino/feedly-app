import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { 
  checkLowStockProducts, 
  getStoreNotifications, 
  markNotificationAsRead, 
  markAllNotificationsAsRead, 
  dismissNotification, 
  dismissAllNotifications
} from '@/lib/notificationService';

// Pastikan notifikasi diinisialisasi setiap kali handler dijalankan
async function ensureNotificationsInitialized() {
  // Import di dalam fungsi untuk menghindari error circular dependency
  const { initializeNotifications } = await import('@/lib/initNotifications');
  await initializeNotifications();
}

/**
 * GET - Mendapatkan notifikasi stok rendah
 */
export async function GET(req: NextRequest) {
  try {
    await ensureNotificationsInitialized();
    
    // Dapatkan session untuk memeriksa otentikasi
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Dapatkan storeId dari query params
    const url = new URL(req.url);
    const storeId = url.searchParams.get('storeId');
    
    console.log(`[API] GET /api/stock-alerts, storeId: ${storeId || 'all'}`);
    
    // Opsional parameter untuk aksi terhadap notifikasi
    const notificationId = url.searchParams.get('notificationId');
    const action = url.searchParams.get('action');
    
    // Jika ada aksi terhadap notifikasi tertentu
    if (action && notificationId) {
      if (action === 'markAsRead') {
        const success = markNotificationAsRead(notificationId, storeId || undefined);
        return NextResponse.json({ success });
      } else if (action === 'dismiss') {
        const success = dismissNotification(notificationId, storeId || undefined);
        return NextResponse.json({ success });
      }
    }
    
    // Jika ada aksi untuk semua notifikasi
    if (action && !notificationId) {
      if (action === 'markAllAsRead') {
        const count = markAllNotificationsAsRead(storeId || undefined);
        return NextResponse.json({ success: true, count });
      } else if (action === 'dismissAll') {
        const count = dismissAllNotifications(storeId || undefined);
        return NextResponse.json({ success: true, count });
      }
    }
    
    // Dapatkan notifikasi untuk toko
    const notifications = await getStoreNotifications(storeId);
    
    // Hitung jumlah notifikasi yang belum dibaca
    const unreadCount = notifications.filter(n => !n.read).length;
    
    return NextResponse.json({
      notifications,
      unreadCount,
      total: notifications.length,
      storeId: storeId || null
    });
  } catch (error) {
    console.error('[API] Error getting stock alerts:', error);
    return NextResponse.json(
      { error: 'Failed to get stock alerts' },
      { status: 500 }
    );
  }
}

/**
 * POST - Memperbarui notifikasi stok rendah
 */
export async function POST(req: NextRequest) {
  try {
    await ensureNotificationsInitialized();
    
    // Dapatkan session untuk memeriksa otentikasi
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Parse body request
    const body = await req.json();
    const { storeId, forceCheck = false } = body;
    
    console.log(`[API] POST /api/stock-alerts, storeId: ${storeId || 'all'}, forceCheck: ${forceCheck}`);
    
    // Periksa produk stok rendah dan dapatkan jumlah notifikasi
    const result = await checkLowStockProducts(storeId || null, forceCheck);
    
    return NextResponse.json({
      success: true,
      notificationCount: result.count,
      storeId: storeId || null
    });
  } catch (error) {
    console.error('[API] Error updating stock alerts:', error);
    return NextResponse.json(
      { error: 'Failed to update stock alerts' },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS - Menangani CORS preflight request
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Origin': '*',
    },
  });
} 