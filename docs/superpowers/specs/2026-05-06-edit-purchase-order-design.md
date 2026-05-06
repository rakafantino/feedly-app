# Design Spec: Purchase Order Editing System

## Context
When a user orders items from a supplier, the items may be delivered partially. Sometimes, before the order is fully fulfilled, the user adds more items to the same order. Currently, the system lacks a way to modify an ongoing Purchase Order (PO). As a result, users might record a new PO, leading to confusion with the supplier, risk of double ordering, and disorganized debt tracking.

## Goals
- Allow users to modify an existing Purchase Order (PO) that has not been completely received.
- Ensure data integrity by preventing users from reducing the target order quantity below what has already been received.
- Maintain accurate financial records by recalculating the total PO amount and updating payment statuses accordingly.

## Architecture & UI Components

### 1. Frontend: Edit Page
- **Route**: Create a new page at `src/app/(dashboard)/purchase-orders/[id]/edit/page.tsx`.
- **UI Element**: Add an "Edit PO" button on the PO detail page (`src/app/(dashboard)/purchase-orders/[id]/components/PurchaseOrderDetail.tsx`). This button will only be visible if the PO status is NOT `received`, `completed`, or `cancelled`.
- **Form Component**: The edit page will utilize a form similar to the "Create PO" page. It will pre-populate with the existing PO data.
- **Client Validation**: The form will disable the removal of items that have `receivedQuantity > 0` and will prevent setting the target `quantity` lower than `receivedQuantity`.

### 2. Backend API: PUT Endpoint
- **Route**: Modify `src/app/api/purchase-orders/[id]/route.ts` specifically handling the PUT method.
- **Payload**: The API will accept a payload containing the updated `items` array along with `notes` and `estimatedDelivery`.
- **Processing Logic**:
  - Compare incoming items with existing database items.
  - **Updates**: For existing items, update their `quantity` and `price`.
  - **Additions**: Insert any new items added to the list.
  - **Deletions**: Remove any items that are missing from the incoming array (only if `receivedQuantity === 0`).
- **Financial Recalculation**: After modifying items, the system will calculate the new `totalAmount`.
  - If the new `totalAmount` is different, calculate the `remainingAmount = totalAmount - amountPaid`.
  - Update `paymentStatus` (e.g., if previously `PAID` but total increased, it becomes `PARTIAL`).

## Data Flow
1. User clicks "Edit PO" on the detail page and is navigated to the Edit PO page.
2. Form loads existing PO data and renders the interactive fields.
3. User adds new items or adjusts the target quantities of existing items.
4. Upon submission, the frontend sends a `PUT` request with the full items list.
5. Backend starts a database transaction:
   - Validates that no item's quantity is reduced below its `receivedQuantity`.
   - Modifies `PurchaseOrderItem` rows (upsert/delete).
   - Updates the main `PurchaseOrder` total and status.
6. Return success to frontend, which redirects the user back to the PO detail page.

## Error Handling
- **Validation Error (400)**: If target quantity < `receivedQuantity`, return a descriptive error message.
- **Not Found Error (404)**: If PO does not exist.
- **State Error (400)**: Prevent editing if PO is already fully received or cancelled.