-- CreateEnum
CREATE TYPE "DiscountCategory" AS ENUM ('early_bird', 'sibling', 'returning_camper', 'multi_week', 'group_booking', 'promo_code');

-- CreateEnum
CREATE TYPE "CalculationType" AS ENUM ('percent', 'fixed');

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "discounts" JSONB;

-- CreateTable
CREATE TABLE "global_discounts" (
    "id" TEXT NOT NULL,
    "camp_id" TEXT NOT NULL,
    "category" "DiscountCategory" NOT NULL,
    "entries" JSONB NOT NULL DEFAULT '[]',
    "is_enabled" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "global_discounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "global_discounts_camp_id_idx" ON "global_discounts"("camp_id");

-- CreateIndex
CREATE INDEX "global_discounts_is_enabled_idx" ON "global_discounts"("is_enabled");

-- CreateIndex
CREATE UNIQUE INDEX "global_discounts_camp_id_category_key" ON "global_discounts"("camp_id", "category");

-- AddForeignKey
ALTER TABLE "global_discounts" ADD CONSTRAINT "global_discounts_camp_id_fkey" FOREIGN KEY ("camp_id") REFERENCES "camps"("id") ON DELETE CASCADE ON UPDATE CASCADE;
