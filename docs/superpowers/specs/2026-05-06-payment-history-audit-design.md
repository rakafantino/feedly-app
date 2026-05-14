# Design Spec: Payment History Audit Trail

## Context
When displaying the payment history for supplier debts (Purchase Orders) or customer debts (Transactions), the system currently only displays the date, method, and payment amount. This makes it difficult for users to track how the remaining balance changed chronologically, especially when the total debt might fluctuate due to refunds, price corrections, or purchase order adjustments.

## Goals
- Provide an immutable audit trail of the remaining debt before and after each payment.
- Display this information clearly in the frontend UI alongside the payment history list.
- Ensure the data remains accurate historically, even if the parent transaction or PO's total amount changes later.

## Architecture & UI Components

### 1. Database Changes (Prisma Schema)
- **Model `DebtPayment`**: Add `remainingDebtBefore Float @default(0) @map("remaining_debt_before")` and `remainingDebtAfter Float @default(0) @map("remaining_debt_after")`.
- **Model `PurchaseOrderPayment`**: Add `remainingDebtBefore Float @default(0) @map("remaining_debt_before")` and `remainingDebtAfter Float @default(0) @map("remaining_debt_after")`.
- *Note*: We set defaults to 0 to prevent migration issues for existing rows.

### 2. Backend Logic (API Endpoints)
- Update `src/app/api/purchase-orders/[id]/pay/route.ts`:
  - Before creating the payment, fetch the PO's current `remainingAmount`.
  - Calculate `remainingDebtAfter` = `currentRemainingAmount - paymentAmount`.
  - Store both values in the `PurchaseOrderPayment` creation payload.
- Update `src/app/api/transactions/[id]/pay/route.ts`:
  - Before creating the payment, fetch the Transaction's current `remainingAmount`.
  - Calculate `remainingDebtAfter` = `currentRemainingAmount - paymentAmount`.
  - Store both values in the `DebtPayment` creation payload.

### 3. Frontend UI
- Update the payment history table in `src/app/(dashboard)/purchase-orders/[id]/components/PurchaseOrderDetail.tsx`.
- Update the payment history UI wherever customer transactions payments are displayed (e.g. `src/app/(dashboard)/reports/supplier-debt/components/BatchPaymentHistoryDialog.tsx` or Customer Debt page, need to check specific components).
- **UI Design**: Instead of just showing `Jumlah: Rp 40.000`, the table will have a modified column (e.g. `Nominal Pembayaran`) that displays:
  ```
  Dibayar: Rp 40.000
  (Sisa sblm: Rp 100.000 → Sisa skrg: Rp 60.000)
  ```
  This is compact and readable.

## Data Flow
1. User submits a payment for a PO or Transaction.
2. The backend looks up the current `remainingAmount` of that PO/Transaction.
3. The backend calculates the new remaining amount and stores the snapshot (`before` and `after`) in the payment record.
4. The frontend fetches the updated PO/Transaction including its payment history.
5. The frontend displays the payment amount alongside the historical snapshots.

## Edge Cases
- Existing payments: Since existing payments won't have this data (defaulting to 0), the frontend should conditionally hide the "Sisa sblm/Sisa skrg" text if `remainingDebtBefore` and `remainingDebtAfter` are exactly 0, or if they are mathematically inconsistent (e.g., legacy rows).
- Negative values: The system already prevents paying more than the remaining balance, so negative remaining debts should not occur natively through this flow.