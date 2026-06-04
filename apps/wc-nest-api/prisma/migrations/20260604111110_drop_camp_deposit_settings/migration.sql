/*
  Warnings:

  - You are about to drop the column `deposit_fixed_amount` on the `camps` table. All the data in the column will be lost.
  - You are about to drop the column `deposit_percentage` on the `camps` table. All the data in the column will be lost.
  - You are about to drop the column `deposit_required` on the `camps` table. All the data in the column will be lost.
  - You are about to drop the column `deposit_type` on the `camps` table. All the data in the column will be lost.

  Camp-level deposit settings are removed; provider-level `ProviderSettings.deposit*`
  is now the single source of truth. The booking flow reads deposit settings off
  the provider at submit and snapshots the resolved amount onto each BookingGroup,
  so existing/in-flight bookings are unaffected by this column drop.
*/
-- AlterTable
ALTER TABLE "camps" DROP COLUMN "deposit_fixed_amount",
DROP COLUMN "deposit_percentage",
DROP COLUMN "deposit_required",
DROP COLUMN "deposit_type";
