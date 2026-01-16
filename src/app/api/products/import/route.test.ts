/**
 * @jest-environment node
 */
import { POST } from './route';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

jest.mock('@/lib/auth', () => ({
    auth: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
    __esModule: true,
    default: {
        supplier: {
            findFirst: jest.fn(),
        },
        $transaction: jest.fn((callback) => callback({
            product: {
                findFirst: jest.fn(),
                create: jest.fn(),
                update: jest.fn(),
            }
        })),
    },
}));

// Mock File and FormData since they might not be fully available in test env or need specific behavior
global.File = class MockFile {
    name: string;
    type: string;
    size: number;
    content: string;

    constructor(parts: string[], name: string, options: { type: string }) {
        this.name = name;
        this.type = options.type;
        this.content = parts.join('');
        this.size = this.content.length;
    }

    async text() {
        return this.content;
    }
} as any;

global.FormData = class MockFormData {
    data: Map<string, any>;
    constructor() {
        this.data = new Map();
    }
    append(key: string, value: any) {
        this.data.set(key, value);
    }
    get(key: string) {
        return this.data.get(key);
    }
} as any;

describe('Product Import API', () => {
    const prismaMock = prisma as any;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    const createRequest = (formData: any) => {
        return {
            formData: async () => formData,
            url: 'http://localhost:3000/api/products/import',
        } as unknown as Request;
    };

    it('should return 401 if unauthorized', async () => {
        (auth as jest.Mock).mockResolvedValue(null);
        const req = createRequest(new FormData());
        const res = await POST(req);
        expect(res.status).toBe(401);
    });

    it('should return 400 if no file provided', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { storeId: 'store-1' } });
        const formData = new FormData();
        const req = createRequest(formData);
        const res = await POST(req);
        expect(res.status).toBe(400);
    });

    it('should return 400 if CSV is empty', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { storeId: 'store-1' } });
        const formData = new FormData();
        const file = new File([''], 'empty.csv', { type: 'text/csv' });
        formData.append('file', file);

        const req = createRequest(formData);
        const res = await POST(req);
        const data = await res.json();
        expect(res.status).toBe(400);
        expect(data.error).toMatch(/empty/i);
    });

    it('should return 400 if required headers missing', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { storeId: 'store-1' } });
        const csvContent = "name,other\nval1,val2";
        const formData = new FormData();
        const file = new File([csvContent], 'test.csv', { type: 'text/csv' });
        formData.append('file', file);

        const req = createRequest(formData);
        const res = await POST(req);
        const data = await res.json();
        expect(res.status).toBe(400);
        expect(data.error).toMatch(/Missing required headers/);
    });

    it('should import valid csv', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { storeId: 'store-1' } });
        const csvContent = `name,price,stock,unit,barcode
Test Product,1000,10,pcs,12345`;
        const formData = new FormData();
        const file = new File([csvContent], 'valid.csv', { type: 'text/csv' });
        formData.append('file', file);

        // Mock transaction behavior
        const txMock = {
            product: {
                findFirst: jest.fn().mockResolvedValue(null), // No existing product
                create: jest.fn().mockResolvedValue({ id: 'p1' }),
                update: jest.fn(),
            }
        };
        (prismaMock.$transaction).mockImplementation(async (cb: any) => cb(txMock));

        const req = createRequest(formData);
        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.imported).toBe(1);
        expect(data.errors).toHaveLength(0);
    });
});
