import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { NotificationService } from '@/services/notification.service';

/**
 * GET - Mendapatkan notifikasi stok rendah
 */
export async function GET(req: NextRequest) {
  try {
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
    
    // Opsional parameter untuk aksi terhadap notifikasi
    const notificationId = url.searchParams.get('notificationId');
    const action = url.searchParams.get('action');
    
    // Jika ada aksi terhadap notifikasi tertentu
    if (action && notificationId) {
      if (action === 'markAsRead') {
        await NotificationService.markAsRead(notificationId, storeId || '');
        return NextResponse.json({ success: true });
      } else if (action === 'dismiss') {
        await NotificationService.deleteNotification(notificationId, storeId || '');
        return NextResponse.json({ success: true });
      } else if (action === 'snooze') {
        const minutes = parseInt(url.searchParams.get('minutes') || '60', 10);
        await NotificationService.snoozeNotification(notificationId, storeId || '', minutes);
        return NextResponse.json({ success: true });
      }
    }
    
    // Jika ada aksi untuk semua notifikasi
    if (action && !notificationId) {
      if (action === 'markAllAsRead') {
        const count = await NotificationService.markAllAsRead(storeId || '');
        return NextResponse.json({ success: true, count });
      } else if (action === 'dismissAll') {
        const count = await NotificationService.dismissAllNotifications(storeId || '');
        return NextResponse.json({ success: true, count });
      }
    }
    
    if (!storeId) {
         return NextResponse.json({ notifications: [], unreadCount: 0, total: 0 });
    }

    // Dapatkan notifikasi untuk toko
    // By default, only return unread notifications as requested ("Inbox Zero" style)
    // Read notifications are effectively "dismissed" from view until they resurface
    const notifications = await NotificationService.getNotifications(storeId, { isRead: false });
    
    // Hitung jumlah notifikasi yang belum dibaca (redundant given filter above, but safe)
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
}

/**
 * POST - Memperbarui notifikasi stok rendah (Trigger Check)
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await req.json();
    const { storeId: bodyStoreId } = body;
    
    const effectiveStoreId = bodyStoreId || session.user.storeId || req.cookies.get('selectedStoreId')?.value || null;
    
    // Run all checks
    const [stockResult, _debtResult, expiredResult] = await Promise.all([
        NotificationService.checkLowStockProducts(effectiveStoreId || undefined),
        effectiveStoreId ? NotificationService.checkDebtDue(effectiveStoreId) : Promise.resolve(),
        effectiveStoreId ? NotificationService.checkExpiredProducts(effectiveStoreId) : Promise.resolve({ count: 0 })
    ]);
    
    return NextResponse.json({
      success: true,
      notificationCount: stockResult.count + ((expiredResult as any)?.count || 0),
      details: {
          stock: stockResult.count,
          expired: (expiredResult as any)?.count || 0
      },
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
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const url = new URL(req.url);
    const notificationId = url.searchParams.get('notificationId'); 
    const productId = url.searchParams.get('productId');

    let storeId = url.searchParams.get('storeId');
    if (!storeId) {
      storeId = session.user.storeId || req.cookies.get('selectedStoreId')?.value || null;
    }
    
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