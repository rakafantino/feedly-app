
import { POST } from "./route";
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";

jest.mock("@/lib/prisma", () => ({
  productBatch: {
    findMany: jest.fn(),
  },
  product: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
}));

jest.mock("@/lib/api-middleware", () => ({
  withAuth: (handler: any) => async (req: any, ...args: any) => {
    // Mock session and storeId
    return handler(req, { user: { id: "user-1", role: "OWNER" } }, "store-1", ...args);
  },
}));

describe("POST /api/products/[id]/sync-stock", () => {
    const mockParams = { params: Promise.resolve({ id: "prod-1" }) };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should sync stock when batch total differs from product stock (Store Isolated)", async () => {
        const req = new NextRequest("http://localhost:3000/api/products/prod-1/sync-stock", {
            method: "POST",
        });

        // Mock batches
        (prisma.productBatch.findMany as jest.Mock).mockResolvedValue([
            { id: "batch-1", stock: 10 },
            { id: "batch-2", stock: 5 },
        ]); // Total 15

        // Mock product - finding with storeId
        (prisma.product.findFirst as jest.Mock).mockResolvedValue({
            id: "prod-1",
            stock: 10, // Mismatch
            storeId: "store-1"
        });

        // Mock update
        (prisma.product.update as jest.Mock).mockResolvedValue({
            id: "prod-1",
            stock: 15
        });

        const res = await POST(req, mockParams);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.message).toBe("Stock synchronized");
        expect(data.newStock).toBe(15);

        // VERIFY ISOLATION: Check if findFirst was called with storeId
        expect(prisma.product.findFirst).toHaveBeenCalledWith({
            where: {
                id: "prod-1",
                storeId: "store-1"
            },
            select: { stock: true }
        });
        
        expect(prisma.product.update).toHaveBeenCalledWith({
            where: { id: "prod-1" },
            data: { stock: 15 }
        });
    });

    it("should return 404 if product not found in store", async () => {
        const req = new NextRequest("http://localhost:3000/api/products/prod-1/sync-stock", {
            method: "POST",
        });

         // Mock batches
         (prisma.productBatch.findMany as jest.Mock).mockResolvedValue([]);

        // Mock product null (not found in this store)
        (prisma.product.findFirst as jest.Mock).mockResolvedValue(null);

        const res = await POST(req, mockParams);
        const data = await res.json();

        expect(res.status).toBe(404);
        expect(data.error).toBe("Product not found");

        expect(prisma.product.findFirst).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({ storeId: "store-1" })
        }));
    });
});
