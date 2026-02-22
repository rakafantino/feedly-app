import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-middleware';
import { NotificationService } from '@/services/notification.service';

interface ExpiredResult {
  count: number;
}

/**
 * GET - Mendapatkan notifikasi stok rendah
 */
export const GET = withAuth(async (req: NextRequest, session, storeId) => {
  try {
    const url = new URL(req.url);
    
    // Opsional parameter untuk aksi terhadap notifikasi
    const notificationId = url.searchParams.get('notificationId');
    const action = url.searchParams.get('action');
    
    // Jika ada aksi terhadap notifikasi tertentu
    if (action && notificationId) {
      if (action === 'markAsRead') {
        await NotificationService.markAsRead(notificationId, storeId!);
        return NextResponse.json({ success: true });
      } else if (action === 'dismiss') {
        await NotificationService.deleteNotification(notificationId, storeId!);
        return NextResponse.json({ success: true });
      } else if (action === 'snooze') {
        const minutes = parseInt(url.searchParams.get('minutes') || '60', 10);
        await NotificationService.snoozeNotification(notificationId, storeId!, minutes);
        return NextResponse.json({ success: true });
      }
    }
    
    // Jika ada aksi untuk semua notifikasi
    if (action && !notificationId) {
      if (action === 'markAllAsRead') {
        const count = await NotificationService.markAllAsRead(storeId!);
        return NextResponse.json({ success: true, count });
      } else if (action === 'dismissAll') {
        const count = await NotificationService.dismissAllNotifications(storeId!);
        return NextResponse.json({ success: true, count });
      }
    }

    // Dapatkan notifikasi untuk toko
    // By default, only return unread notifications as requested ("Inbox Zero" style)
    const notifications = await NotificationService.getNotifications(storeId!, { isRead: false });
    
    // Hitung jumlah notifikasi yang belum dibaca
    const unreadCount = notifications.length;
    
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
}, { requireStore: true });

/**
 * POST - Memperbarui notifikasi stok rendah (Trigger Check)
 */
export const POST = withAuth(async (req: NextRequest, session, storeId) => {
  try {
    // Run all checks
    const [stockResult, , expiredResult] = await Promise.all([
        NotificationService.checkLowStockProducts(storeId || undefined),
        storeId ? NotificationService.checkDebtDue(storeId) : Promise.resolve(),
        storeId ? NotificationService.checkExpiredProducts(storeId) : Promise.resolve({ count: 0 })
    ]);
    
    return NextResponse.json({
      success: true,
      notificationCount: stockResult.count + ((expiredResult as ExpiredResult)?.count || 0),
      details: {
          stock: stockResult.count,
          expired: (expiredResult as ExpiredResult)?.count || 0
      },
      storeId: storeId || null
    });
  } catch (error) {
    console.error('[API] Error updating stock alerts:', error);
    return NextResponse.json(
      { error: 'Failed to update stock alerts' },
      { status: 500 }
    );
  }
}, { requireStore: true });

/**
 * DELETE - Menghapus notifikasi stok rendah
 */
export const DELETE = withAuth(async (req: NextRequest, session, storeId) => {
  try {
    const url = new URL(req.url);
    const notificationId = url.searchParams.get('notificationId'); 
    const productId = url.searchParams.get('productId');
    
    if (productId && storeId) {
       // Find notification for this product
       const notifications = await NotificationService.getNotifications(storeId);
       const removing = notifications.find(n => n.productId === productId);
       
       if (removing) {
          await NotificationService.deleteNotification(removing.id, storeId);
          return NextResponse.json({ success: true });
       }
       return NextResponse.json({ success: false, message: 'Notification not found' });
    }
    
    if (notificationId && storeId) {
       await NotificationService.deleteNotification(notificationId, storeId);
       return NextResponse.json({ success: true });
    }
    
    return NextResponse.json({ error: 'ID or ProductID required' }, { status: 400 });
  } catch (error) {
    console.error('[API] Error deleting stock alerts:', error);
    return NextResponse.json(
      { error: 'Failed to delete stock alerts' },
      { status: 500 }
    );
  }
}, { requireStore: true });

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