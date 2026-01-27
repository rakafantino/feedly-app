-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "purchase_order_id" TEXT;

-- AlterTable
ALTER TABLE "purchase_orders" ADD COLUMN     "amount_paid" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "due_date" TIMESTAMP(3),
ADD COLUMN     "payment_status" TEXT NOT NULL DEFAULT 'UNPAID',
ADD COLUMN     "remaining_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "total_amount" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
