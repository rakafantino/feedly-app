
/**
 * @jest-environment node
 */
import { GET } from "./route";
import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { inventoryService } from "@/services/inventory.service";

// Mock dependencies
jest.mock("@/lib/auth", () => ({
    auth: jest.fn()
}));
jest.mock("@/services/inventory.service");

describe("GET /api/reports/inventory", () => {
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

    it("should return 401 if not authenticated", async () => {
        (auth as jest.Mock).mockResolvedValue(null);
        const req = new NextRequest("http://localhost/api/reports/inventory");
        const res = await GET(req);
        
        expect(res.status).toBe(401);
    });

    it("should return inventory valuation data on success", async () => {
        const mockData = {
            summary: { totalValuation: 1000, totalItems: 1 },
            items: []
        };
        (inventoryService.getInventoryValuation as jest.Mock).mockResolvedValue(mockData);

        const req = new NextRequest("http://localhost/api/reports/inventory");
        const res = await GET(req);
        const json = await res.json();
        
        expect(res.status).toBe(200);
        expect(json).toEqual(mockData);
        expect(inventoryService.getInventoryValuation).toHaveBeenCalledWith("store-1");
    });

    it("should use storeId from query param if provided", async () => {
        const req = new NextRequest("http://localhost/api/reports/inventory?storeId=other-store");
        await GET(req);
        
        expect(inventoryService.getInventoryValuation).toHaveBeenCalledWith("other-store");
    });
    
     it("should return 400 if no storeId is found", async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { storeId: null } });
        const req = new NextRequest("http://localhost/api/reports/inventory");
        const res = await GET(req);
        
        expect(res.status).toBe(400);
    });
});
