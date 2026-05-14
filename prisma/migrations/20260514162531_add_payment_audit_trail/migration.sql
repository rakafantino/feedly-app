-- AlterTable
ALTER TABLE "debt_payments" ADD COLUMN     "remaining_debt_after" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "remaining_debt_before" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "purchase_order_payments" ADD COLUMN     "remaining_debt_after" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "remaining_debt_before" DOUBLE PRECISION NOT NULL DEFAULT 0;