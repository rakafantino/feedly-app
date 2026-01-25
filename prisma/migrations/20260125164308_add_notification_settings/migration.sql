-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "snoozed_until" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "stores" ADD COLUMN     "stock_notification_interval" INTEGER NOT NULL DEFAULT 60;
