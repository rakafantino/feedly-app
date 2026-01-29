import { POST } from "./route";
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// Mock Prisma
jest.mock("@/lib/prisma", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { mockDeep } = require("jest-mock-extended");
  return {
    __esModule: true,
    default: mockDeep(),
  };
});

// Mock Auth
jest.mock("@/lib/auth", () => ({
  auth: jest.fn(() => Promise.resolve({ user: { name: "Test User", email: "test@example.com", storeId: "store-1" } })),
}));

const prismaMock = prisma as any;
const authMock = auth as jest.Mock;

describe("POST /api/inventory/convert", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const validPayload = {
    sourceProductId: "source-123",
    quantity: 10,
  };

  const mockSourceProduct = {
    id: "source-123",
    name: "Gula Pasir (Karung)",
    stock: 50,
    unit: "sak",
    conversionTargetId: "target-456",
    conversionRate: 50, // 1 sak = 50 kg
    conversionTarget: {
      id: "target-456",
      name: "Gula Pasir (Kg)",
    },
    batches: [] // Initialize empty batches to prevent undefined error
  };

  it("should return 401 if not authenticated", async () => {
    authMock.mockResolvedValue(null);

    const req = new NextRequest("http://localhost:3000/api/inventory/convert", {
      method: "POST",
      body: JSON.stringify(validPayload),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("should return 400 if input is invalid", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", storeId: "store-1" } });

    const req = new NextRequest("http://localhost:3000/api/inventory/convert", {
      method: "POST",
      body: JSON.stringify({ sourceProductId: "", quantity: 0 }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Data konversi tidak valid");
  });

  it("should return 404 if source product not found", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", storeId: "store-1" } });
    prismaMock.product.findFirst.mockResolvedValue(null);

    const req = new NextRequest("http://localhost:3000/api/inventory/convert", {
      method: "POST",
      body: JSON.stringify(validPayload),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("Produk sumber tidak ditemukan");
  });

  it("should return 400 if conversion config is missing", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", storeId: "store-1" } });
    prismaMock.product.findFirst.mockResolvedValue({
      ...mockSourceProduct,
      conversionTargetId: null,
    });

    const req = new NextRequest("http://localhost:3000/api/inventory/convert", {
      method: "POST",
      body: JSON.stringify(validPayload),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Produk ini tidak memiliki konfigurasi konversi satuan");
  });

  it("should return 400 if stock is insufficient", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", storeId: "store-1" } });
    prismaMock.product.findFirst.mockResolvedValue({
      ...mockSourceProduct,
      stock: 5, // Less than requested 10
    });

    const req = new NextRequest("http://localhost:3000/api/inventory/convert", {
      method: "POST",
      body: JSON.stringify(validPayload),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("Stok tidak cukup");
  });

  it("should execute conversion successfully", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", storeId: "store-1" } });
    prismaMock.product.findFirst.mockResolvedValue(mockSourceProduct);

    // Mock transaction implementation
    prismaMock.$transaction.mockImplementation(async (callback: any) => {
      return callback(prismaMock);
    });

    const req = new NextRequest("http://localhost:3000/api/inventory/convert", {
      method: "POST",
      body: JSON.stringify(validPayload),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.message).toBe("Konversi berhasil");
    expect(data.details.convertedAmount).toBe(10);
    expect(data.details.resultAmount).toBe(500); // 10 * 50

    // Check transaction calls
    expect(prismaMock.product.update).toHaveBeenCalledTimes(2);
    // 1. Decrement source
    expect(prismaMock.product.update).toHaveBeenCalledWith({
      where: { id: "source-123" },
      data: { stock: { decrement: 10 } },
    });
    // 2. Increment target
    expect(prismaMock.product.update).toHaveBeenCalledWith({
      where: { id: "target-456" },
      data: { stock: { increment: 500 } },
    });
  });

  it("should return 500 on database error", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", storeId: "store-1" } });
    prismaMock.product.findFirst.mockRejectedValue(new Error("DB Error"));

    const req = new NextRequest("http://localhost:3000/api/inventory/convert", {
      method: "POST",
      body: JSON.stringify(validPayload),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe("Terjadi kesalahan saat memproses konversi");
  });
});
