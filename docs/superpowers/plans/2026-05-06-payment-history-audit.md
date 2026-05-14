# Payment History Audit Trail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a payment history audit trail that records and displays the remaining debt before and after each payment for both Purchase Orders and Transactions.

**Architecture:** Database schema updates to store the snapshot amounts. API updates to fetch current remaining amount before recording payment. UI updates to neatly display the snapshots inline with the payment amount.

**Tech Stack:** Prisma, Next.js API Routes, React, Tailwind

---

### Task 1: Update Database Schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add new fields to DebtPayment and PurchaseOrderPayment**

```prisma
// In DebtPayment model, add:
  remainingDebtBefore Float @default(0) @map("remaining_debt_before")
  remainingDebtAfter  Float @default(0) @map("remaining_debt_after")

// In PurchaseOrderPayment model, add:
  remainingDebtBefore Float @default(0) @map("remaining_debt_before")
  remainingDebtAfter  Float @default(0) @map("remaining_debt_after")
```

- [ ] **Step 2: Generate Prisma Client and create migration**

```bash
npx prisma generate
npx prisma migrate dev --name add_payment_audit_trail
```

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): add remaining debt audit fields to payment models"
```

---

### Task 2: Update Purchase Order Payment API

**Files:**
- Modify: `src/app/api/purchase-orders/[id]/pay/route.ts`

- [ ] **Step 1: Calculate and store remaining debt snapshots**

```typescript
// Find the logic where the payment is created.
// Usually it looks like: await tx.purchaseOrderPayment.create({ data: { ... } })

// Before creating the payment, we need the `existingPO.remainingAmount`.
// The route already fetches the `existingPO` to validate the payment.
// Let's modify the creation payload:

const currentRemainingAmount = existingPO.remainingAmount || 0;
const newRemainingAmount = Math.max(0, currentRemainingAmount - paymentAmount);

// Update the `purchaseOrderPayment.create` call to include:
// remainingDebtBefore: currentRemainingAmount,
// remainingDebtAfter: newRemainingAmount,

/* Example of what to change:
await tx.purchaseOrderPayment.create({
  data: {
    purchaseOrderId: purchaseOrderId,
    amount: paymentAmount,
    paymentMethod,
    notes,
    remainingDebtBefore: currentRemainingAmount,
    remainingDebtAfter: newRemainingAmount,
  }
});
*/
// Implementer must carefully integrate this into the existing transaction block.
```

- [ ] **Step 2: Update the GET API to include these fields in the response**

Modify `src/app/api/purchase-orders/[id]/route.ts` so the `formattedPO.payments` mapping includes the new fields.

```typescript
// Find `payments: purchaseOrder.payments.map((payment) => ({`
// Add:
// remainingDebtBefore: payment.remainingDebtBefore,
// remainingDebtAfter: payment.remainingDebtAfter,
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/purchase-orders/[id]/pay/route.ts src/app/api/purchase-orders/[id]/route.ts
git commit -m "feat(api): record and return debt snapshots for purchase order payments"
```

---

### Task 3: Update Transaction Payment API

**Files:**
- Modify: `src/app/api/transactions/[id]/pay/route.ts`
- Modify: `src/app/api/transactions/[id]/route.ts`

- [ ] **Step 1: Calculate and store remaining debt snapshots in pay endpoint**

```typescript
// Modify src/app/api/transactions/[id]/pay/route.ts
// Similar to Task 2, fetch the existing transaction's remainingAmount (already done in the route).
// Calculate before and after:
// const currentRemainingAmount = existingTransaction.remainingAmount || 0;
// const newRemainingAmount = Math.max(0, currentRemainingAmount - paymentAmount);

// Add to `tx.debtPayment.create` data:
// remainingDebtBefore: currentRemainingAmount,
// remainingDebtAfter: newRemainingAmount,
```

- [ ] **Step 2: Update GET endpoint to include these fields**

```typescript
// Modify src/app/api/transactions/[id]/route.ts
// Make sure `debtPayments` or `payments` are included and the new fields are returned.
// Wait, looking at the previous GET endpoint, it doesn't seem to explicitly map debt payments, but if it does, make sure they are included.
// Actually, `src/app/(dashboard)/transactions/` might not be the place where customer debt payments are shown. The user mentioned "laporan piutang pelanggan" or "Riwayat Pembayaran".
// We need to ensure that wherever `DebtPayment` is returned to the frontend, these fields are included.
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/transactions/[id]/pay/route.ts src/app/api/transactions/[id]/route.ts
git commit -m "feat(api): record and return debt snapshots for customer transactions"
```

---

### Task 4: Update Frontend UI for PO Payments

**Files:**
- Modify: `src/app/(dashboard)/purchase-orders/[id]/components/PurchaseOrderDetail.tsx`

- [ ] **Step 1: Update the Payment interface**

```typescript
// Add to the PurchaseOrderPayment interface at the top:
interface PurchaseOrderPayment {
  // ... existing fields
  remainingDebtBefore?: number;
  remainingDebtAfter?: number;
}
```

- [ ] **Step 2: Update the Payment History Table UI**

```tsx
// Find the TableCell rendering the amount:
// <TableCell className="text-right text-xs font-medium text-green-600">{formatRupiah(payment.amount)}</TableCell>

// Change it to display the historical data if it exists and is > 0:
<TableCell className="text-right">
  <div className="text-xs font-medium text-green-600 mb-1">
    Dibayar: {formatRupiah(payment.amount)}
  </div>
  {payment.remainingDebtBefore !== undefined && (payment.remainingDebtBefore > 0 || payment.remainingDebtAfter !== undefined) && (
    <div className="text-[10px] text-muted-foreground whitespace-nowrap">
      (Sisa sblm: {formatRupiah(payment.remainingDebtBefore || 0)} → skrg: {formatRupiah(payment.remainingDebtAfter || 0)})
    </div>
  )}
</TableCell>
```

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/purchase-orders/[id]/components/PurchaseOrderDetail.tsx
git commit -m "feat(ui): display remaining debt snapshot in PO payment history"
```

---

### Task 5: Update Frontend UI for Transaction (Customer) Payments

**Files:**
- Modify: The file where customer debt payments are displayed. Let's assume it is in the customer detail or debt reports.
- *Implementer Note:* You will need to use `grep` or `glob` to find where `DebtPayment` history is rendered in the frontend (e.g. `src/app/(dashboard)/reports/receivables/...` or similar).

- [ ] **Step 1: Find where DebtPayment history is rendered and update the UI**

```tsx
// Locate the component mapping over debt payments.
// Update the payment amount cell similarly to Task 4:
<div className="text-xs font-medium text-green-600 mb-1">
  Dibayar: {formatRupiah(payment.amount)}
</div>
{payment.remainingDebtBefore !== undefined && (payment.remainingDebtBefore > 0 || payment.remainingDebtAfter !== undefined) && (
  <div className="text-[10px] text-muted-foreground whitespace-nowrap">
    (Sisa sblm: {formatRupiah(payment.remainingDebtBefore || 0)} → skrg: {formatRupiah(payment.remainingDebtAfter || 0)})
  </div>
)}
```

- [ ] **Step 2: Commit**

```bash
# Add the modified file(s)
git commit -m "feat(ui): display remaining debt snapshot in customer payment history"
```