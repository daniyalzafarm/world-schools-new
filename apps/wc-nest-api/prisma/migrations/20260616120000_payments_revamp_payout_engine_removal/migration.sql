-- Payments revamp (Spec v2.3) — M2 destructive removal of the legacy payout engine.
--
-- Money is now captured only when it is already non-refundable and is immediately
-- the provider's (Stripe Standard accounts + Direct Charges + automatic payouts);
-- the platform no longer schedules, holds, or tracks payouts. The capture schedule
-- (booking_scheduled_captures) replaces the payout-tranche model. Safe to drop
-- outright — there are no production bookings/providers yet.

-- DropForeignKey
ALTER TABLE "booking_payout_schedules" DROP CONSTRAINT IF EXISTS "booking_payout_schedules_booking_group_id_fkey";
ALTER TABLE "booking_payout_schedules" DROP CONSTRAINT IF EXISTS "booking_payout_schedules_payout_event_id_fkey";
ALTER TABLE "payout_events" DROP CONSTRAINT IF EXISTS "payout_events_provider_id_fkey";
ALTER TABLE "provider_settings" DROP CONSTRAINT IF EXISTS "provider_settings_payout_mode_agreed_by_admin_id_fkey";
ALTER TABLE "booking_groups" DROP CONSTRAINT IF EXISTS "booking_groups_payout_override_agreed_by_admin_id_fkey";

-- DropTable (child first: booking_payout_schedules references payout_events)
DROP TABLE "booking_payout_schedules";
DROP TABLE "payout_events";

-- DropIndex
DROP INDEX IF EXISTS "booking_groups_transfer_date_idx";

-- AlterTable — drop payout snapshot/override columns from booking_groups
ALTER TABLE "booking_groups"
  DROP COLUMN IF EXISTS "transfer_date",
  DROP COLUMN IF EXISTS "payout_mode",
  DROP COLUMN IF EXISTS "payout_offset_days_snapshot",
  DROP COLUMN IF EXISTS "payout_override_agreed_at",
  DROP COLUMN IF EXISTS "payout_override_agreed_by_admin_id",
  DROP COLUMN IF EXISTS "payout_released_at";

-- AlterTable — drop payout-mode columns from provider_settings
ALTER TABLE "provider_settings"
  DROP COLUMN IF EXISTS "payout_mode",
  DROP COLUMN IF EXISTS "early_payout_offset_days",
  DROP COLUMN IF EXISTS "payout_mode_agreement_note",
  DROP COLUMN IF EXISTS "payout_mode_agreed_at",
  DROP COLUMN IF EXISTS "payout_mode_agreed_by_admin_id";

-- DropEnum (after every column referencing them is gone)
DROP TYPE "PayoutTrancheStatus";
DROP TYPE "PayoutTrancheReason";
DROP TYPE "PayoutMode";
DROP TYPE "PayoutStatus";
