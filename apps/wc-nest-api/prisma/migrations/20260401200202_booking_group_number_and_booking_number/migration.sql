/*
  Warnings:

  - A unique constraint covering the columns `[booking_group_number]` on the table `booking_groups` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[booking_number]` on the table `bookings` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `booking_group_number` to the `booking_groups` table without a default value. This is not possible if the table is not empty.
  - Added the required column `booking_number` to the `bookings` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "booking_groups" ADD COLUMN     "booking_group_number" VARCHAR(32) NOT NULL;

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "booking_number" VARCHAR(36) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "booking_groups_booking_group_number_key" ON "booking_groups"("booking_group_number");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_booking_number_key" ON "bookings"("booking_number");
