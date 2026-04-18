# Price Recommendation Dashboard Widget Design

## 1. Overview
The goal is to provide a proactive alert system on the Dashboard that notifies the user when a product's current selling price (`price`) has fallen below the expected profit margin due to increases in its purchase price/modal. This feature will use a "Quick Apply" widget to allow the user to easily update selling prices with a single click.

## 2. Calculation Logic
The system already tracks `purchase_price` and uses a `PriceCalculator` to determine `min_selling_price` (Purchase Price + Costs + Safety Margin). The JSON field `hppCalculationDetails` stores the margins (including `retailMargin`).

**Recommended Price Formula:**
- Base: `min_selling_price` (which is updated dynamically when `purchase_price` changes).
- Retail Margin: Extracted from `hppCalculationDetails.retailMargin` (defaults to 0 if missing).
- `Raw Recommended Price` = `min_selling_price + (min_selling_price * (retailMargin / 100))`
- `Rounded Recommended Price` = `Math.ceil(Raw Recommended Price / 100) * 100` (rounded up to nearest 100).
- Condition: If `price < Rounded Recommended Price`, the product is flagged for recommendation.

## 3. Backend Architecture
We will create a new API endpoint to serve these recommendations.

**Endpoint:** `GET /api/dashboard/price-recommendations`
- Queries all active products for the current store.
- Filters out products that do not have `min_selling_price`.
- Iterates through the products, calculating the `Rounded Recommended Price` using the formula above.
- Returns a list of products where the current `price` is less than the `Rounded Recommended Price`.
- The response will include: `id`, `name`, `currentPrice`, `recommendedPrice`, `retailMargin`.

## 4. Frontend Architecture
We will create a new Dashboard Widget component.

**Component:** `src/components/dashboard/PriceRecommendationWidget.tsx`
- Fetches data from `/api/dashboard/price-recommendations`.
- If the list is empty, the widget can either hide itself or show a "Semua harga jual sudah optimal" message.
- If there are recommendations, it displays a compact table or list:
  - **Product Name**
  - **Current Price** (Red) vs **Recommended Price** (Green)
  - **Quick Apply Action:** A button that triggers a `PUT /api/products/[id]` request with `{ price: recommendedPrice }`.
- Upon successful update, the product is removed from the widget's list (optimistic UI update).

**Dashboard Integration:**
- The widget will be imported and placed on the main dashboard page (`src/app/(dashboard)/dashboard/page.tsx`), likely alongside or below the existing Low Stock Alert widget.

## 5. Handling Cascade (Retail Products)
- When "Quick Apply" updates a parent product's selling price, it does NOT automatically update the child's selling price (this maintains the existing design choice where retail selling prices are controlled independently).
- However, since child products also have their own `min_selling_price` and `hppCalculationDetails` (if set), they will appear as their own separate rows in the Recommendation Widget if their margins fall behind.

## 6. Testing Strategy
- Create a unit test or integration test for the API endpoint to ensure the rounding logic and margin extraction works correctly.
- Ensure that clicking "Quick Apply" successfully updates the product's selling price and that it no longer appears in the recommendation list on refresh.
