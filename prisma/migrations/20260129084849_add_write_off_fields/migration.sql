-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "written_off_amount" DOUBLE PRECISION,
ADD COLUMN     "written_off_at" TIMESTAMP(3),
ADD COLUMN     "written_off_reason" TEXT;
