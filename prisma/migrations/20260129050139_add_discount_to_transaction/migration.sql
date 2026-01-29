-- AlterTable
ALTER TABLE "products" ADD COLUMN     "hpp_price" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "discount" DOUBLE PRECISION NOT NULL DEFAULT 0;
