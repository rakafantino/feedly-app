/*
  Warnings:

  - A unique constraint covering the columns `[store_id,phone]` on the table `customers` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[store_id,product_code]` on the table `products` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[store_id,po_number]` on the table `purchase_orders` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[store_id,code]` on the table `suppliers` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[store_id,invoice_number]` on the table `transactions` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "products_product_code_key";

-- DropIndex
DROP INDEX "purchase_orders_po_number_key";

-- DropIndex
DROP INDEX "suppliers_code_key";

-- DropIndex
DROP INDEX "transactions_invoice_number_key";

-- CreateIndex
CREATE UNIQUE INDEX "customers_store_id_phone_key" ON "customers"("store_id", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "products_store_id_product_code_key" ON "products"("store_id", "product_code");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_store_id_po_number_key" ON "purchase_orders"("store_id", "po_number");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_store_id_code_key" ON "suppliers"("store_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_store_id_invoice_number_key" ON "transactions"("store_id", "invoice_number");
