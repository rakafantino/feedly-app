
/**
 * @jest-environment node
 */
import { GET } from "./route";
import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { purchaseReportService } from "@/services/purchase-report.service";

// Mock dependencies
jest.mock("@/lib/auth", () => ({
    auth: jest.fn()
}));
jest.mock("@/services/purchase-report.service");

describe("GET /api/reports/purchases", () => {
    const mockSession = {
        user: {
            id: "user-1",
            storeId: "store-1"
        }
    };
    
    beforeEach(() => {
        jest.clearAllMocks();
        (auth as jest.Mock).mockResolvedValue(mockSession);
    });

    it("should return purchase report data on success", async () => {
        const mockData = {
            summary: { totalSpend: 50000, totalTransactions: 1, averageSpend: 50000 },
            items: []
        };
        (purchaseReportService.getPurchaseReport as jest.Mock).mockResolvedValue(mockData);

        const req = new NextRequest("http://localhost/api/reports/purchases?startDate=2024-01-01&endDate=2024-01-31");
        const res = await GET(req);
        const json = await res.json();
        
        expect(res.status).toBe(200);
        expect(json).toEqual(mockData);
        
        // Verify service call with correct dates
        expect(purchaseReportService.getPurchaseReport).toHaveBeenCalledWith(
            "store-1",
            new Date("2023-12-31T17:00:00.000Z"),
            expect.any(Date),
            1, // page
            10 // limit
        );
    });

    it("should accept pagination parameters", async () => {
        const mockData = {
            summary: { totalSpend: 50000, totalTransactions: 1, averageSpend: 50000 },
            items: [],
            pagination: { total: 100, page: 2, limit: 20, totalPages: 5 }
        };
        (purchaseReportService.getPurchaseReport as jest.Mock).mockResolvedValue(mockData);

        const req = new NextRequest("http://localhost/api/reports/purchases?page=2&limit=20");
        const res = await GET(req);
        const json = await res.json();
        
        expect(res.status).toBe(200);
        expect(json.pagination.page).toBe(2);
        expect(json.pagination.limit).toBe(20);
        
        expect(purchaseReportService.getPurchaseReport).toHaveBeenCalledWith(
            expect.any(String),
            expect.any(Date),
            expect.any(Date),
            2,
            20
        );
    });

    it("should return 400 if no storeId found", async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { storeId: null } });
        const req = new NextRequest("http://localhost/api/reports/purchases");
        const res = await GET(req);
        
        expect(res.status).toBe(400);
    });
});
