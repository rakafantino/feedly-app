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

    // Dapatkan storeId dari query, jika tidak ada gunakan fallback dari session atau cookie
    const url = new URL(req.url);
    let storeId = url.searchParams.get('storeId');
    if (!storeId) {
      storeId = session.user.storeId || req.cookies.get('selectedStoreId')?.value || null;
    }
    
    console.log(`[API] GET /api/stock-alerts, storeId: ${storeId || 'fallback-none'}`);
    
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
    const { storeId: bodyStoreId, forceCheck = false } = body;
    
    // Fallback storeId dari session atau cookie jika tidak disediakan di body
    const effectiveStoreId = bodyStoreId || session.user.storeId || req.cookies.get('selectedStoreId')?.value || null;
    
    console.log(`[API] POST /api/stock-alerts, storeId: ${effectiveStoreId || 'fallback-none'}, forceCheck: ${forceCheck}`);
    
    // Periksa produk stok rendah dan dapatkan jumlah notifikasi
    const result = await checkLowStockProducts(effectiveStoreId || null, forceCheck);
    
    return NextResponse.json({
      success: true,
      notificationCount: result.count,
      storeId: effectiveStoreId || null
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
 * DELETE - Menghapus notifikasi stok rendah
 */
export async function DELETE(req: NextRequest) {
  try {
    await ensureNotificationsInitialized();
    
    // Dapatkan session untuk memeriksa otentikasi
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const url = new URL(req.url);
    const productId = url.searchParams.get('productId');
    
    // Dapatkan storeId dari query atau session
    let storeId = url.searchParams.get('storeId');
    if (!storeId) {
      storeId = session.user.storeId || req.cookies.get('selectedStoreId')?.value || null;
    }
    
    console.log(`[API] DELETE /api/stock-alerts, productId: ${productId || 'none'}, storeId: ${storeId || 'fallback-none'}`);
    
    if (productId) {
      // Hapus notifikasi untuk produk tertentu
      // Kita perlu mencari notificationId berdasarkan productId
      // Ini agak tricky karena kita biasanya menghapus by notificationId
      // Tapi logic di notificationService bisa kita perluas atau kita iterasi
      
      const notifications = await getStoreNotifications(storeId);
      const removing = notifications.find(n => n.productId === productId);
      
      if (removing) {
        const success = dismissNotification(removing.id, storeId || undefined);
        return NextResponse.json({ success });
      } else {
        return NextResponse.json({ success: false, message: 'Notification not found for this product' });
      }
    }
    
    return NextResponse.json({ error: 'Product ID required' }, { status: 400 });
  } catch (error) {
    console.error('[API] Error deleting stock alerts:', error);
    return NextResponse.json(
      { error: 'Failed to delete stock alerts' },
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