# Design Spec: Void Transaction System

## Context
Currently, cashiers do not have a way to cancel or void a transaction if they make a mistake (e.g., ringing up a 5L product instead of a 10L product). Using the manual "Stock Adjustment" feature to correct the physical inventory breaks the financial reports (revenue and profit margins are misaligned). We need a dedicated "Void Transaction" feature that safely reverses the inventory and financial impacts of a mistake while maintaining an audit trail (Soft Delete approach).

## Goals
- Allow users to mark a transaction as "VOIDED".
- Revert the inventory changes (restore product stocks) automatically when a transaction is voided.
- Exclude voided transactions from revenue, profit, and debt calculations in the Sales Report.
- Keep the transaction record in the database for audit purposes (Soft Delete).

## Architecture & UI Components

### 1. Database Changes
- **Model**: `Transaction`
- **Addition**: Add `status String @default("COMPLETED")` field.
- **Migration**: Run prisma migration to apply the new schema.

### 2. Backend API: Void Endpoint
- **Route**: Create `POST /api/transactions/[id]/void/route.ts` (or `PUT /api/transactions/[id]/void/route.ts`).
- **Processing Logic**:
  - Verify the transaction exists and is not already voided.
  - Update the transaction's `status` to `VOIDED`.
  - For each `TransactionItem`, increment the `stock` of the corresponding `Product` by the `quantity` sold.
  - Wrap the entire operation in a `prisma.$transaction` to ensure atomicity.

### 3. Backend API: Sales Report Adjustments
- **Route**: `src/app/api/reports/sales/route.ts`
- **Processing Logic**:
  - Modify the query that fetches transactions to only include those where `status === "COMPLETED"` (or `status !== "VOIDED"`).
  - Modify the calculation logic so that voided transactions do not contribute to `totalTransactions`, `totalRevenue`, `totalProfit`, `totalCashReceived`, `totalUnpaid`, and `totalDiscount`.
  - *Note*: We will likely fetch all transactions (including voided ones) for the list view, but exclude them from the summary cards. Alternatively, we show voided transactions in the list but with a strikethrough.

### 4. Frontend: Detail View & Report Page
- **Route**: `src/app/(dashboard)/reports/sales/page.tsx`
- **UI Elements**:
  - In the `SheetContent` (Transaction Detail panel), add a red "Batalkan Transaksi (Void)" button.
  - Add an alert dialog confirming the void action ("Apakah Anda yakin ingin membatalkan transaksi ini? Stok akan dikembalikan...").
  - If the `selectedTransaction.status === "VOIDED"`, hide the void button and display a red badge "DIBATALKAN".
  - In the main Transactions Table, style the rows of voided transactions with a strikethrough effect (`line-through`) and a muted text color.

## Data Flow
1. User identifies a wrong transaction and clicks on it in the Sales Report to open the details sheet.
2. User clicks "Batalkan Transaksi (Void)" and confirms in the dialog.
3. Frontend sends a request to the backend void endpoint.
4. Backend updates the transaction status and restores the inventory quantities.
5. The frontend invalidates the `sales-report` query, causing the list and summary boxes to refresh. The voided transaction is now struck-through and the revenue totals are updated.

## Error Handling
- **400 Bad Request**: If the transaction is already voided.
- **404 Not Found**: If the transaction does not exist.
- **500 Internal Server Error**: If the database transaction fails (e.g., concurrent update issues).