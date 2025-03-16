-- AlterTable
ALTER TABLE "products" ADD COLUMN "batch_number" TEXT;
ALTER TABLE "products" ADD COLUMN "expiry_date" DATETIME;
ALTER TABLE "products" ADD COLUMN "min_selling_price" REAL;
ALTER TABLE "products" ADD COLUMN "purchase_date" DATETIME;
ALTER TABLE "products" ADD COLUMN "purchase_price" REAL;
