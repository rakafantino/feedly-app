/**
 * @jest-environment node
 */
import { GET } from './route';
import { auth } from '@/lib/auth';
import { subscribeToStore } from '@/lib/notificationEvents';
import { getStoreNotifications } from '@/lib/notificationService';
import { NextRequest } from 'next/server';

jest.mock('@/lib/auth', () => ({
    auth: jest.fn(),
}));

jest.mock('@/lib/notificationEvents', () => ({
    subscribeToStore: jest.fn(),
}));

jest.mock('@/lib/notificationService', () => ({
    getStoreNotifications: jest.fn(),
}));

describe('Stock Alerts SSE Stream API', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    const createRequest = (url = 'http://localhost:3000/api/stock-alerts/stream?storeId=store-1') => {
        return new NextRequest(url);
    };

    it('should return 401 if unauthorized', async () => {
        (auth as jest.Mock).mockResolvedValue(null);
        const req = createRequest();
        const res = await GET(req as any); // Type cast if needed often for SSE req
        expect(res.status).toBe(401);
    });

    it('should return 400 if storeId missing', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' } });
        const req = createRequest('http://localhost:3000/api/stock-alerts/stream'); // No query param
        const res = await GET(req);
        expect(res.status).toBe(400);
    });

    it('should initialize stream with headers and initial data', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1', storeId: 'store-1' } });
        (getStoreNotifications as jest.Mock).mockResolvedValue([{ id: 'n1', read: false }]);
        (subscribeToStore as jest.Mock).mockImplementation(() => {
            // Mock sending data? Or just verifying subscription
            return () => { }; // unsubscribe function
        });

        const req = createRequest();
        const res = await GET(req);

        expect(res.status).toBe(200);
        expect(res.headers.get('Content-Type')).toBe('text/event-stream');
        expect(getStoreNotifications).toHaveBeenCalledWith('store-1');
        expect(subscribeToStore).toHaveBeenCalledWith('store-1', expect.any(Function));

        // Check stream existence (polyfilled environment behaviour varries)
        expect(res.body).toBeDefined();
    });
});
