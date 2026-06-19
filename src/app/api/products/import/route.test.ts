/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";

jest.mock("@/lib/api-middleware", () => ({
  withAuth: jest.fn((handler) => {
    return async (req: NextRequest, ...args: any[]) => {
      return handler(req, { user: { id: "user-1", storeId: "store-1" } }, "store-1", ...args);
    };
  }),
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    supplier: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn((callback) =>
      callback({
        product: {
          findFirst: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
        },
      }),
    ),
  },
}));

global.File = class MockFile {
  name: string;
  type: string;
  size: number;
  content: string;

  constructor(parts: string[], name: string, options: { type: string }) {
    this.name = name;
    this.type = options.type;
    this.content = parts.join("");
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

import { POST } from "./route";
import prisma from "@/lib/prisma";

describe("Product Import API", () => {
  const prismaMock = prisma as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createRequest = (formData: any): NextRequest => {
    const req = {
      formData: async () => formData,
      url: "http://localhost:3000/api/products/import",
    } as unknown as NextRequest;
    return req;
  };

  it("should return 400 if no file provided", async () => {
    const formData = new FormData();
    const req = createRequest(formData);
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("should return 400 if CSV is empty", async () => {
    const formData = new FormData();
    const file = new File([""], "empty.csv", { type: "text/csv" });
    formData.append("file", file);

    const req = createRequest(formData);
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toMatch(/empty/i);
  });

  it("should return 400 if required headers missing", async () => {
    const csvContent = "name,other\nval1,val2";
    const formData = new FormData();
    const file = new File([csvContent], "test.csv", { type: "text/csv" });
    formData.append("file", file);

    const req = createRequest(formData);
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toMatch(/Missing required headers/);
  });

  it("should import valid csv", async () => {
    const csvContent = `name,price,stock,unit,barcode
Test Product,1000,10,pcs,12345`;
    const formData = new FormData();
    const file = new File([csvContent], "valid.csv", { type: "text/csv" });
    formData.append("file", file);

    const txMock = {
      product: {
        // findFirst is used to look up an existing product (none here).
        findFirst: jest.fn().mockResolvedValue(null),
        // findUnique is used by StockMutationService.createBatch to load the
        // freshly-created product before incrementing its stock.
        findUnique: jest.fn().mockResolvedValue({ id: "p1", stock: 0 }),
        create: jest.fn().mockResolvedValue({ id: "p1" }),
        update: jest.fn().mockResolvedValue({ id: "p1", stock: 10 }),
      },
      productBatch: {
        create: jest.fn().mockResolvedValue({
          id: "batch-1",
          productId: "p1",
          stock: 10,
          batchNumber: "IMPORT-1",
          expiryDate: null,
          purchasePrice: 1000,
          supplierId: null,
          inDate: new Date(),
        }),
      },
    };
    prismaMock.$transaction.mockImplementation(async (cb: any) => cb(txMock));

    const req = createRequest(formData);
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.imported).toBe(1);
    expect(data.errors).toHaveLength(0);
  });
});
