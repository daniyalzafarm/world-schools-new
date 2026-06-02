-- AlterTable
ALTER TABLE "booking_groups" ADD COLUMN     "eligibility_check_snapshot" JSONB,
ADD COLUMN     "extension_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "last_extended_at" TIMESTAMP(3);
