-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "amount_paid" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "due_date" TIMESTAMP(3),
ADD COLUMN     "payment_status" TEXT NOT NULL DEFAULT 'PAID',
ADD COLUMN     "remaining_amount" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "debt_payments" (
    "id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "payment_method" TEXT NOT NULL,
    "notes" TEXT,
    "paid_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "debt_payments_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "debt_payments" ADD CONSTRAINT "debt_payments_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
