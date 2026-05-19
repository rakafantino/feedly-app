-- CreateTable
CREATE TABLE "price_recommendation_dismissals" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "dismissed_at_purchase_price" DOUBLE PRECISION NOT NULL,
    "dismissed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_recommendation_dismissals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "price_recommendation_dismissals_product_id_dismissed_at_purchase_price_key" ON "price_recommendation_dismissals"("product_id", "dismissed_at_purchase_price");

-- CreateIndex
CREATE INDEX "price_recommendation_dismissals_store_id_idx" ON "price_recommendation_dismissals"("store_id");

-- CreateIndex
CREATE INDEX "price_recommendation_dismissals_product_id_idx" ON "price_recommendation_dismissals"("product_id");

-- AddForeignKey
ALTER TABLE "price_recommendation_dismissals" ADD CONSTRAINT "price_recommendation_dismissals_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_recommendation_dismissals" ADD CONSTRAINT "price_recommendation_dismissals_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
