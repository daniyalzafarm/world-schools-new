/*
  Warnings:

  - A unique constraint covering the columns `[stripe_account_id]` on the table `providers` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "providers" ADD COLUMN     "stripe_account_id" TEXT,
ADD COLUMN     "stripe_charges_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "stripe_commission_percentage" DECIMAL(5,2),
ADD COLUMN     "stripe_details_submitted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "stripe_onboarding_completed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "stripe_onboarding_completed_at" TIMESTAMP(3),
ADD COLUMN     "stripe_payouts_enabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "providers_stripe_account_id_key" ON "providers"("stripe_account_id");
