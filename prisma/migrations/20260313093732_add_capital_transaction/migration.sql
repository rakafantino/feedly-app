-- CreateTable
CREATE TABLE "capital_transactions" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "type" TEXT NOT NULL,
    "notes" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "capital_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "capital_transactions_store_id_idx" ON "capital_transactions"("store_id");

-- CreateIndex
CREATE INDEX "capital_transactions_date_idx" ON "capital_transactions"("date");

-- AddForeignKey
ALTER TABLE "capital_transactions" ADD CONSTRAINT "capital_transactions_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
