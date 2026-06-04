-- AlterTable
ALTER TABLE "booking_groups" ADD COLUMN     "deposit_snapshot" JSONB,
ALTER COLUMN "deposit_amount" SET DATA TYPE DECIMAL(12,2);
