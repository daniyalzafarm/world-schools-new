/*
  Warnings:

  - You are about to drop the column `blackoutDates` on the `sessions` table. All the data in the column will be lost.
  - You are about to drop the column `durations` on the `sessions` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "sessions" DROP COLUMN "blackoutDates",
DROP COLUMN "durations",
ADD COLUMN     "age_range" JSONB,
ADD COLUMN     "available_days_of_week" JSONB,
ADD COLUMN     "base_price_per_day" DECIMAL(10,2),
ADD COLUMN     "blackout_dates" JSONB,
ADD COLUMN     "boys_capacity" INTEGER,
ADD COLUMN     "day_of_week_pricing" JSONB,
ADD COLUMN     "discount_tiers" JSONB,
ADD COLUMN     "girls_capacity" INTEGER,
ADD COLUMN     "max_days_limit" INTEGER,
ADD COLUMN     "min_days_limit" INTEGER,
ADD COLUMN     "require_consecutive_days" BOOLEAN DEFAULT false,
ADD COLUMN     "separate_gender_capacity" BOOLEAN DEFAULT false,
ADD COLUMN     "specific_start_days" JSONB,
ADD COLUMN     "unlimited_capacity" BOOLEAN DEFAULT false;
