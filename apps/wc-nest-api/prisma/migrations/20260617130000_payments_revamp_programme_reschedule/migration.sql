-- Programme Reschedule by Provider (Payments revamp, Spec v2.5 §9.7). Additive only.
-- (1) New audit event type, (2) reschedule-proposal status enum + table, (3) the
-- agreed-new-start override on booking_groups. No destructive changes.

-- (1) Audit event for a consented reschedule recompute (§12).
ALTER TYPE "PaymentAuditEventType" ADD VALUE IF NOT EXISTS 'reschedule_recompute';

-- (2) Proposal lifecycle enum + table.
DO $$ BEGIN
  CREATE TYPE "RescheduleProposalStatus" AS ENUM ('pending', 'consented', 'declined', 'expired');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "reschedule_proposals" (
  "id"                  TEXT NOT NULL,
  "booking_group_id"    TEXT NOT NULL,
  "proposed_by_user_id" TEXT NOT NULL,
  "original_start_date" TIMESTAMP(3) NOT NULL,
  "proposed_start_date" TIMESTAMP(3) NOT NULL,
  "status"              "RescheduleProposalStatus" NOT NULL DEFAULT 'pending',
  "reason_text"         TEXT,
  "responded_by_user_id" TEXT,
  "responded_at"        TIMESTAMP(3),
  "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"          TIMESTAMP(3) NOT NULL,
  CONSTRAINT "reschedule_proposals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "reschedule_proposals_booking_group_id_status_idx"
  ON "reschedule_proposals" ("booking_group_id", "status");

ALTER TABLE "reschedule_proposals"
  ADD CONSTRAINT "reschedule_proposals_booking_group_id_fkey"
  FOREIGN KEY ("booking_group_id") REFERENCES "booking_groups" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- (3) Agreed new programme start after a consented reschedule (null ⇒ session.start_date).
ALTER TABLE "booking_groups" ADD COLUMN IF NOT EXISTS "rescheduled_start_date" TIMESTAMP(3);
