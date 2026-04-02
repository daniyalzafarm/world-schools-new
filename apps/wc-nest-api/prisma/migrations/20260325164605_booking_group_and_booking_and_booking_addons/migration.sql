/*
  Warnings:

  - You are about to drop the column `add_ons` on the `bookings` table. All the data in the column will be lost.
  - You are about to drop the column `deposit_amount` on the `bookings` table. All the data in the column will be lost.
  - You are about to drop the column `paid_amount` on the `bookings` table. All the data in the column will be lost.
  - You are about to drop the column `payment_status` on the `bookings` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `bookings` table. All the data in the column will be lost.
  - Added the required column `base_price` to the `bookings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `booking_group_id` to the `bookings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `provider_id` to the `bookings` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "BookingGroupStatus" AS ENUM ('request', 'accepted', 'declined', 'expired', 'deposit_paid', 'fully_paid', 'at_camp', 'completed', 'cancelled');

-- DropIndex
DROP INDEX "bookings_payment_status_idx";

-- DropIndex
DROP INDEX "bookings_status_idx";

-- AlterTable
ALTER TABLE "bookings" DROP COLUMN "add_ons",
DROP COLUMN "deposit_amount",
DROP COLUMN "paid_amount",
DROP COLUMN "payment_status",
DROP COLUMN "status",
ADD COLUMN     "base_price" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "booking_group_id" TEXT NOT NULL,
ADD COLUMN     "discount_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "provider_id" TEXT NOT NULL,
ADD COLUMN     "provider_note" TEXT,
ADD COLUMN     "request_expires_at" TIMESTAMP(3),
ADD COLUMN     "responded_at" TIMESTAMP(3);

-- DropEnum
DROP TYPE "BookingStatus";

-- DropEnum
DROP TYPE "PaymentStatus";

-- CreateTable
CREATE TABLE "booking_groups" (
    "id" TEXT NOT NULL,
    "parent_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "camp_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "subtotal_amount" DECIMAL(12,2) NOT NULL,
    "discount_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discount_details" JSONB,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "deposit_amount" DECIMAL(10,2),
    "paid_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "refunded_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "BookingGroupStatus" NOT NULL DEFAULT 'request',
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "special_request" TEXT,
    "internal_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booking_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_camp_add_ons" (
    "booking_id" TEXT NOT NULL,
    "camp_id" TEXT NOT NULL,
    "add_on_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "line_total" DECIMAL(12,2) NOT NULL,
    "snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booking_camp_add_ons_pkey" PRIMARY KEY ("booking_id","camp_id","add_on_id")
);

-- CreateIndex
CREATE INDEX "booking_groups_parent_id_idx" ON "booking_groups"("parent_id");

-- CreateIndex
CREATE INDEX "booking_groups_session_id_idx" ON "booking_groups"("session_id");

-- CreateIndex
CREATE INDEX "booking_groups_camp_id_idx" ON "booking_groups"("camp_id");

-- CreateIndex
CREATE INDEX "booking_groups_provider_id_idx" ON "booking_groups"("provider_id");

-- CreateIndex
CREATE INDEX "booking_groups_created_at_idx" ON "booking_groups"("created_at");

-- CreateIndex
CREATE INDEX "booking_groups_status_idx" ON "booking_groups"("status");

-- CreateIndex
CREATE INDEX "booking_camp_add_ons_camp_id_idx" ON "booking_camp_add_ons"("camp_id");

-- CreateIndex
CREATE INDEX "booking_camp_add_ons_add_on_id_idx" ON "booking_camp_add_ons"("add_on_id");

-- CreateIndex
CREATE INDEX "bookings_booking_group_id_idx" ON "bookings"("booking_group_id");

-- CreateIndex
CREATE INDEX "bookings_provider_id_idx" ON "bookings"("provider_id");

-- CreateIndex
CREATE INDEX "bookings_request_expires_at_idx" ON "bookings"("request_expires_at");

-- AddForeignKey
ALTER TABLE "booking_groups" ADD CONSTRAINT "booking_groups_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "parents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_groups" ADD CONSTRAINT "booking_groups_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_groups" ADD CONSTRAINT "booking_groups_camp_id_fkey" FOREIGN KEY ("camp_id") REFERENCES "camps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_groups" ADD CONSTRAINT "booking_groups_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_booking_group_id_fkey" FOREIGN KEY ("booking_group_id") REFERENCES "booking_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_camp_id_fkey" FOREIGN KEY ("camp_id") REFERENCES "camps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_camp_add_ons" ADD CONSTRAINT "booking_camp_add_ons_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_camp_add_ons" ADD CONSTRAINT "booking_camp_add_ons_camp_id_add_on_id_fkey" FOREIGN KEY ("camp_id", "add_on_id") REFERENCES "camp_add_ons"("camp_id", "add_on_id") ON DELETE RESTRICT ON UPDATE CASCADE;
