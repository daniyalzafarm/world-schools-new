/*
  Warnings:

  - You are about to drop the column `provider_id` on the `google_business_profiles` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[gbp_id]` on the table `providers` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "google_business_profiles" DROP CONSTRAINT "google_business_profiles_provider_id_fkey";

-- DropIndex
DROP INDEX "google_business_profiles_provider_id_key";

-- AlterTable
ALTER TABLE "camps" ADD COLUMN     "gbp_id" TEXT;

-- AlterTable
ALTER TABLE "google_business_profiles" DROP COLUMN "provider_id";

-- AlterTable
ALTER TABLE "providers" ADD COLUMN     "gbp_id" TEXT;

-- CreateIndex
CREATE INDEX "camps_gbp_id_idx" ON "camps"("gbp_id");

-- CreateIndex
CREATE UNIQUE INDEX "providers_gbp_id_key" ON "providers"("gbp_id");

-- AddForeignKey
ALTER TABLE "providers" ADD CONSTRAINT "providers_gbp_id_fkey" FOREIGN KEY ("gbp_id") REFERENCES "google_business_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camps" ADD CONSTRAINT "camps_gbp_id_fkey" FOREIGN KEY ("gbp_id") REFERENCES "google_business_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
