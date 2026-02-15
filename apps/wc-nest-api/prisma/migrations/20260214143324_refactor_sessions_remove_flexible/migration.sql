/*
  Warnings:

  - You are about to drop the column `session_type` on the `camps` table. All the data in the column will be lost.
  - You are about to drop the column `age_range` on the `sessions` table. All the data in the column will be lost.
  - You are about to drop the column `available_days_of_week` on the `sessions` table. All the data in the column will be lost.
  - You are about to drop the column `base_price_per_day` on the `sessions` table. All the data in the column will be lost.
  - You are about to drop the column `blackout_dates` on the `sessions` table. All the data in the column will be lost.
  - You are about to drop the column `boys_capacity` on the `sessions` table. All the data in the column will be lost.
  - You are about to drop the column `capacity` on the `sessions` table. All the data in the column will be lost.
  - You are about to drop the column `day_of_week_pricing` on the `sessions` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `sessions` table. All the data in the column will be lost.
  - You are about to drop the column `discount_tiers` on the `sessions` table. All the data in the column will be lost.
  - You are about to drop the column `girls_capacity` on the `sessions` table. All the data in the column will be lost.
  - You are about to drop the column `is_active` on the `sessions` table. All the data in the column will be lost.
  - You are about to drop the column `max_days_limit` on the `sessions` table. All the data in the column will be lost.
  - You are about to drop the column `min_days_limit` on the `sessions` table. All the data in the column will be lost.
  - You are about to drop the column `require_consecutive_days` on the `sessions` table. All the data in the column will be lost.
  - You are about to drop the column `separate_gender_capacity` on the `sessions` table. All the data in the column will be lost.
  - You are about to drop the column `session_end_date` on the `sessions` table. All the data in the column will be lost.
  - You are about to drop the column `session_start_date` on the `sessions` table. All the data in the column will be lost.
  - You are about to drop the column `specific_start_days` on the `sessions` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `sessions` table. All the data in the column will be lost.
  - You are about to drop the column `unlimited_capacity` on the `sessions` table. All the data in the column will be lost.
  - You are about to alter the column `name` on the `sessions` table. The data in that column could be lost. The data in that column will be cast from `VarChar(100)` to `VarChar(60)`.
  - Made the column `start_date` on table `sessions` required. This step will fail if there are existing NULL values in that column.
  - Made the column `end_date` on table `sessions` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "SessionDayType" AS ENUM ('full_day', 'half_day');

-- CreateEnum
CREATE TYPE "PricingType" AS ENUM ('single', 'age_group');

-- CreateEnum
CREATE TYPE "AvailabilityType" AS ENUM ('single', 'age_group');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('draft', 'published');

-- DropIndex
DROP INDEX "camps_session_type_idx";

-- DropIndex
DROP INDEX "sessions_is_active_idx";

-- DropIndex
DROP INDEX "sessions_type_idx";

-- AlterTable
ALTER TABLE "camps" DROP COLUMN "session_type";

-- AlterTable
ALTER TABLE "sessions" DROP COLUMN "age_range",
DROP COLUMN "available_days_of_week",
DROP COLUMN "base_price_per_day",
DROP COLUMN "blackout_dates",
DROP COLUMN "boys_capacity",
DROP COLUMN "capacity",
DROP COLUMN "day_of_week_pricing",
DROP COLUMN "description",
DROP COLUMN "discount_tiers",
DROP COLUMN "girls_capacity",
DROP COLUMN "is_active",
DROP COLUMN "max_days_limit",
DROP COLUMN "min_days_limit",
DROP COLUMN "require_consecutive_days",
DROP COLUMN "separate_gender_capacity",
DROP COLUMN "session_end_date",
DROP COLUMN "session_start_date",
DROP COLUMN "specific_start_days",
DROP COLUMN "type",
DROP COLUMN "unlimited_capacity",
ADD COLUMN     "age_group_prices" JSONB,
ADD COLUMN     "age_group_spots" JSONB,
ADD COLUMN     "arrival_time" TEXT,
ADD COLUMN     "availability_type" "AvailabilityType" NOT NULL DEFAULT 'single',
ADD COLUMN     "departure_time" TEXT,
ADD COLUMN     "pricing_type" "PricingType" NOT NULL DEFAULT 'single',
ADD COLUMN     "session_day_type" "SessionDayType",
ADD COLUMN     "status" "SessionStatus" NOT NULL DEFAULT 'draft',
ADD COLUMN     "total_spots" INTEGER,
ALTER COLUMN "name" SET DATA TYPE VARCHAR(60),
ALTER COLUMN "start_date" SET NOT NULL,
ALTER COLUMN "end_date" SET NOT NULL;

-- DropEnum
DROP TYPE "SessionType";

-- CreateIndex
CREATE INDEX "sessions_status_idx" ON "sessions"("status");
