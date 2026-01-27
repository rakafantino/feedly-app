# TDD Checklists & Templates

## API Endpoint Test Template (Vitest/Jest)

```typescript
import { POST } from "./route";
import { createMockRequest } from "@/lib/test-utils";

describe("POST /api/inventory", () => {
  it("should return 400 if quantity is negative (Edge Case)", async () => {
    const req = createMockRequest({ quantity: -1 });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("should create a record with valid data (Happy Path)", async () => {
    // Logic for Neon DB mock or test container
  });
});
```
