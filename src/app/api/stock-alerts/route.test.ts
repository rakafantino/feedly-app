/**
 * @jest-environment node
 */
import { GET, POST } from './route';
import { auth } from '@/lib/auth';
import { NextRequest } from 'next/server';
import { NotificationService } from '@/services/notification.service';

// Mock dependencies
jest.mock('@/lib/auth', () => ({
    auth: jest.fn(),
}));

jest.mock('@/services/notification.service', () => ({
    NotificationService: {
        getNotifications: jest.fn(),
        markAsRead: jest.fn(),
        checkLowStockProducts: jest.fn(),
        markAllAsRead: jest.fn(),
        deleteNotification: jest.fn(),
        dismissAllNotifications: jest.fn(),
        checkDebtDue: jest.fn(),
        checkExpiredProducts: jest.fn(),
        snoozeNotification: jest.fn(),
    }
}));

describe('Stock Alerts API', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /api/stock-alerts', () => {
        it('should return 401 if unauthorized', async () => {
            (auth as jest.Mock).mockResolvedValue(null);
            const req = new NextRequest('http://localhost:3000/api/stock-alerts');
            const res = await GET(req);
            expect(res.status).toBe(401);
        });

        it('should return notifications list', async () => {
            (auth as jest.Mock).mockResolvedValue({ user: { storeId: 'store-1' } });

            const mockNotifications = [
                { id: 'notif-1', message: 'Low stock', read: false }
            ];
            (NotificationService.getNotifications as jest.Mock).mockResolvedValue(mockNotifications);

            const req = new NextRequest('http://localhost:3000/api/stock-alerts');
            const res = await GET(req);
            const data = await res.json();

            expect(res.status).toBe(200);
            expect(data.notifications).toEqual(mockNotifications);
            expect(data.unreadCount).toBe(1);
        });

        it('should handle actions like markAsRead', async () => {
            (auth as jest.Mock).mockResolvedValue({ user: { storeId: 'store-1' } });
            (NotificationService.markAsRead as jest.Mock).mockReturnValue(true);

            const req = new NextRequest('http://localhost:3000/api/stock-alerts?action=markAsRead&notificationId=notif-1');
            const res = await GET(req);
            const data = await res.json();

            expect(res.status).toBe(200);
            expect(data.success).toBe(true);
            expect(NotificationService.markAsRead).toHaveBeenCalledWith('notif-1', 'store-1');
        });
    });

    describe('POST /api/stock-alerts', () => {
        it('should trigger stock check', async () => {
            (auth as jest.Mock).mockResolvedValue({ user: { storeId: 'store-1' } });
            (NotificationService.checkLowStockProducts as jest.Mock).mockResolvedValue({ count: 5 });

            const req = new NextRequest('http://localhost:3000/api/stock-alerts', {
                method: 'POST',
                body: JSON.stringify({ forceCheck: true })
            });

            const res = await POST(req);
            const data = await res.json();

            expect(res.status).toBe(200);
            expect(data.notificationCount).toBe(5);
            expect(NotificationService.checkLowStockProducts).toHaveBeenCalledWith('store-1');
        });
    });
});
