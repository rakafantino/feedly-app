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
  auth: jest.fn(),
}));

const prismaMock = prisma as any;
const authMock = auth as jest.Mock;

describe("POST /api/inventory/setup-retail", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const validPayload = {
    parentProductId: "parent-123",
    conversionRate: 10,
    retailUnit: "pcs",
    retailPrice: "5000",
  };

  const mockParentProduct = {
    id: "parent-123",
    name: "Parent Product",
    product_code: "P-123",
    category: "General",
    supplierId: "sup-1",
    conversionTargetId: null,
    purchase_price: 40000,
    min_selling_price: 45000,
  };

  it("should return 401 if not authenticated", async () => {
    authMock.mockResolvedValue(null);

    const req = new NextRequest("http://localhost:3000/api/inventory/setup-retail", {
      method: "POST",
      body: JSON.stringify(validPayload),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("should return 400 if storeId is missing", async () => {
    // Auth success but no storeId
    authMock.mockResolvedValue({ user: { id: "user-1", role: "OWNER" } });
    // Note: withAuth checks session.user.storeId or cookies.
    // We provide neither here.

    const req = new NextRequest("http://localhost:3000/api/inventory/setup-retail", {
      method: "POST",
      body: JSON.stringify(validPayload),
    });

    const res = await POST(req);
    const data = await res.json();

    // setup-retail uses { requireStore: true } in withAuth
    expect(res.status).toBe(400);
    expect(data.error).toBe("Store selection required");
  });

  it("should return 400 if required fields are missing", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", role: "OWNER", storeId: "store-123" } });

    const req = new NextRequest("http://localhost:3000/api/inventory/setup-retail", {
      method: "POST",
      body: JSON.stringify({ parentProductId: "" }), // Missing fields
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("Missing required fields");
  });

  it("should return 404 if parent product not found", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", role: "OWNER", storeId: "store-123" } });
    prismaMock.product.findUnique.mockResolvedValue(null);

    const req = new NextRequest("http://localhost:3000/api/inventory/setup-retail", {
      method: "POST",
      body: JSON.stringify(validPayload),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("Product not found");
  });

  it("should return 400 if parent already has retail variant", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", role: "OWNER", storeId: "store-123" } });
    prismaMock.product.findUnique.mockResolvedValue({
      ...mockParentProduct,
      conversionTargetId: "existing-child-id",
    });

    const req = new NextRequest("http://localhost:3000/api/inventory/setup-retail", {
      method: "POST",
      body: JSON.stringify(validPayload),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Product already has a retail variant linked");
  });

  it("should create retail variant successfully", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", role: "OWNER", storeId: "store-123" } });
    prismaMock.product.findUnique.mockResolvedValue(mockParentProduct);

    // Mock transaction
    prismaMock.$transaction.mockImplementation(async (callback: any) => {
      return callback(prismaMock);
    });

    // Mock create return
    prismaMock.product.create.mockResolvedValue({
      id: "child-456",
      name: "Parent Product (Eceran)",
    });

    // Mock update return
    prismaMock.product.update.mockResolvedValue({
      id: "parent-123",
      conversionTargetId: "child-456",
    });

    const req = new NextRequest("http://localhost:3000/api/inventory/setup-retail", {
      method: "POST",
      body: JSON.stringify(validPayload),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.message).toBe("Retail variant created successfully");

    // Verify Create Logic
    expect(prismaMock.product.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: expect.stringContaining("(Eceran)"),
          unit: "pcs",
          storeId: "store-123",
          price: 5000,
        }),
      }),
    );

    // Verify Update Logic
    expect(prismaMock.product.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "parent-123" },
        data: expect.objectContaining({
          conversionTargetId: "child-456",
          conversionRate: 10,
        }),
      }),
    );
  });

  it("should return 500 on database error", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", role: "OWNER", storeId: "store-123" } });
    prismaMock.product.findUnique.mockRejectedValue(new Error("DB Error"));

    const req = new NextRequest("http://localhost:3000/api/inventory/setup-retail", {
      method: "POST",
      body: JSON.stringify(validPayload),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe("Internal Server Error");
  });
});
