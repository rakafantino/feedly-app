# Price History Tracking Design Document

## 1. Overview
The goal of this feature is to track changes in both Purchase Prices (Harga Beli) and Selling Prices (Harga Jual) across the system. This provides business owners with clear visibility into price fluctuations from suppliers and how those affect selling prices, aiding in margin analysis and auditing.

## 2. Architecture & Database Changes
We will modify the existing but currently unused `PriceHistory` model in `schema.prisma`.

**Modifications:**
- Add `priceType` column: A string enum to differentiate between `PURCHASE` (cost from supplier) and `SELLING` (retail price to customer).
- Ensure existing fields are utilized properly: `oldPrice`, `newPrice`, `changeAmount` (new - old), `changePercentage` ((changeAmount / old) * 100).
- `source`: To track where the change originated (e.g., `PURCHASE_ORDER`, `MANUAL_EDIT`).
- `referenceId`: To link to the originating Purchase Order ID or User ID (for manual edits).

```prisma
model PriceHistory {
  id               String   @id @default(uuid())
  productId        String   @map("product_id")
  storeId          String   @map("store_id")
  priceType        String   @map("price_type") // 'PURCHASE' or 'SELLING'
  oldPrice         Float    @map("old_price")
  newPrice         Float    @map("new_price")
  changeAmount     Float    @map("change_amount")
  changePercentage Float    @map("change_percentage")
  source           String   // 'PURCHASE_ORDER', 'MANUAL_EDIT', 'SYSTEM_CASCADE'
  referenceId      String?  @map("reference_id")
  createdAt        DateTime @default(now()) @map("created_at")

  product Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  store   Store   @relation(fields: [storeId], references: [id], onDelete: Cascade)

  @@index([productId])
  @@index([storeId])
  @@index([createdAt])
  @@map("price_histories")
}
```

## 3. Backend Logic (Data Flow)

**3.1. Purchase Order Receiving (`PUT /api/purchase-orders/[id]`)**
- When a Purchase Order is received, compare the PO item `price` with the product's current `purchase_price`.
- If different, calculate the difference and percentage.
- Create a `PriceHistory` record with `priceType = 'PURCHASE'` and `source = 'PURCHASE_ORDER'`.
- **Cascade Logic:** If the product has a conversion target (retail/child product), calculate the new child purchase price. If it differs from the child's current purchase price, create a `PriceHistory` record for the child product with `source = 'SYSTEM_CASCADE'`.

**3.2. Manual Product Editing (`PUT /api/products/[id]`)**
- When saving a product, check if `price` (Selling Price) and/or `purchase_price` (Purchase Price) have changed.
- If `purchase_price` changed: Create a `PriceHistory` record with `priceType = 'PURCHASE'`, `source = 'MANUAL_EDIT'`.
- If `price` changed: Create a `PriceHistory` record with `priceType = 'SELLING'`, `source = 'MANUAL_EDIT'`.
- **Cascade Logic:** Handled similarly for the child product if the parent's `purchase_price` changes manually.

## 4. User Interface (UI) Components

**4.1. Product Detail Page - "Riwayat Harga" Tab**
- Add a new tab in the Product Detail/Edit view.
- Displays a table of `PriceHistory` specifically for that product.
- Columns: Date, Type (Modal/Jual), Source, Old Price, New Price, Nominal Change, % Change.
- Visuals: Use red text/icons for price increases (bad for purchase, good for selling - need clear UI indicators like up/down arrows), and green for price decreases.

**4.2. Global Report Page (`/reports/price-movements`)**
- A new page under the Reports section.
- Displays a global data table of `PriceHistory` across all products.
- Filters: Date range (e.g., this month, last month), Product Category, Price Type (Purchase/Selling).
- This allows the owner to see a macroscopic view of supplier inflation or mass pricing updates.

## 5. Error Handling & Edge Cases
- **Division by Zero:** When calculating `changePercentage`, if `oldPrice` is 0 or null, set the percentage to 100% or 0% logically, avoiding NaN errors.
- **Initial Setup:** If a product is updated for the first time and had no previous `purchase_price`, the `oldPrice` should default to 0.

## 6. Testing Strategy
- Unit tests for the percentage calculation logic.
- Integration tests for PO receiving to ensure `PriceHistory` records are generated for both parent and child products.
- UI tests to ensure the tab renders correctly when history exists.
