-- CreateEnum
CREATE TYPE "ScheduledCaptureStatus" AS ENUM ('scheduled', 'processing', 'completed', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "CaptureMode" AS ENUM ('binary', 'two_stage', 'custom');

-- CreateEnum
CREATE TYPE "PaymentAuditEventType" AS ENUM ('deposit_auth_created', 'deposit_captured', 'grace_scheduled', 'balance_capture_scheduled', 'balance_capture_fired', 'balance_capture_failed', 'capture_cancelled', 'grace_refund_issued', 'policy_refund_issued', 'provider_cancellation_refund', 'force_majeure_action', 'payment_review_flagged', 'admin_override', 'consent_captured');

-- CreateEnum
CREATE TYPE "PlatformFeeDisposition" AS ENUM ('retained', 'refunded');

-- CreateEnum
CREATE TYPE "ProviderSuspensionCategory" AS ENUM ('precautionary', 'safeguarding', 'fraud', 'insolvency', 'failed_capture_escalation');

-- CreateEnum
CREATE TYPE "ProviderReviewStatus" AS ENUM ('pending', 'under_review', 'resolved');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "BookingGroupStatus" ADD VALUE 'payment_authorized';
ALTER TYPE "BookingGroupStatus" ADD VALUE 'provider_accepted';
ALTER TYPE "BookingGroupStatus" ADD VALUE 'waiting_for_grace_deadline';
ALTER TYPE "BookingGroupStatus" ADD VALUE 'deposit_captured';
ALTER TYPE "BookingGroupStatus" ADD VALUE 'payment_review';

-- AlterTable
ALTER TABLE "booking_groups" ADD COLUMN     "capture_mode" "CaptureMode",
ADD COLUMN     "deposit_captured_at" TIMESTAMP(3),
ADD COLUMN     "deposit_payment_intent_id" TEXT,
ADD COLUMN     "grace_deadline" TIMESTAMP(3),
ADD COLUMN     "payment_review_flagged_at" TIMESTAMP(3),
ADD COLUMN     "payment_review_resolved_at" TIMESTAMP(3),
ADD COLUMN     "payment_review_resolved_by_admin_id" TEXT,
ADD COLUMN     "payment_review_status" TEXT,
ADD COLUMN     "saved_payment_method_id" TEXT;

-- AlterTable
ALTER TABLE "camps" ADD COLUMN     "deposit_enabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "provider_settings" ADD COLUMN     "capture_schedule" JSONB;

-- AlterTable
ALTER TABLE "providers" ADD COLUMN     "suspension_categories" JSONB,
ADD COLUMN     "suspension_reason_text" VARCHAR(2000);

-- CreateTable
CREATE TABLE "booking_scheduled_captures" (
    "id" TEXT NOT NULL,
    "booking_group_id" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "application_fee_amount" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "capture_date" TIMESTAMP(3) NOT NULL,
    "effective_capture_date" TIMESTAMP(3) NOT NULL,
    "status" "ScheduledCaptureStatus" NOT NULL DEFAULT 'scheduled',
    "stripe_payment_intent_id" TEXT,
    "payment_id" TEXT,
    "failure_code" TEXT,
    "failure_message" TEXT,
    "retry_deadline" TIMESTAMP(3),
    "cancelled_reason" TEXT,
    "fm_event_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booking_scheduled_captures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_consent_snapshots" (
    "id" TEXT NOT NULL,
    "booking_group_id" TEXT NOT NULL,
    "policy_text" TEXT NOT NULL,
    "charge_schedule" JSONB NOT NULL,
    "deposit_info" JSONB NOT NULL,
    "grace_period_hours" INTEGER NOT NULL DEFAULT 24,
    "acknowledged_at" TIMESTAMP(3) NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    "superseded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_consent_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_payment_audit_log" (
    "id" TEXT NOT NULL,
    "timestamp_utc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor" TEXT NOT NULL,
    "event_type" "PaymentAuditEventType" NOT NULL,
    "booking_group_id" TEXT NOT NULL,
    "scheduled_capture_id" TEXT,
    "payment_intent_id" TEXT,
    "amount_minor_units" BIGINT,
    "currency" VARCHAR(3),
    "prior_status" TEXT,
    "new_status" TEXT,
    "reason_text" TEXT,
    "fm_event_id" TEXT,
    "platform_fee_disposition" "PlatformFeeDisposition",

    CONSTRAINT "booking_payment_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "force_majeure_events" (
    "id" TEXT NOT NULL,
    "administrator_user_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "affected_programme_date_from" TIMESTAMP(3),
    "affected_programme_date_to" TIMESTAMP(3),
    "affected_provider_id" TEXT,
    "affected_region" TEXT,
    "affected_booking_count" INTEGER NOT NULL DEFAULT 0,
    "total_refunded_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "platform_fee_refunded" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "force_majeure_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_admin_review_queue" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "suspension_type" "ProviderSuspensionCategory" NOT NULL,
    "status" "ProviderReviewStatus" NOT NULL DEFAULT 'pending',
    "affected_listing_ids" JSONB,
    "affected_booking_count" INTEGER NOT NULL DEFAULT 0,
    "reason_text" TEXT NOT NULL,
    "initiating_refund_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by_user_id" TEXT,
    "decision" TEXT,
    "decision_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_admin_review_queue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "booking_scheduled_captures_status_effective_capture_date_idx" ON "booking_scheduled_captures"("status", "effective_capture_date");

-- CreateIndex
CREATE INDEX "booking_scheduled_captures_booking_group_id_idx" ON "booking_scheduled_captures"("booking_group_id");

-- CreateIndex
CREATE UNIQUE INDEX "booking_scheduled_captures_booking_group_id_sequence_key" ON "booking_scheduled_captures"("booking_group_id", "sequence");

-- CreateIndex
CREATE INDEX "booking_consent_snapshots_booking_group_id_idx" ON "booking_consent_snapshots"("booking_group_id");

-- CreateIndex
CREATE INDEX "booking_payment_audit_log_booking_group_id_timestamp_utc_idx" ON "booking_payment_audit_log"("booking_group_id", "timestamp_utc");

-- CreateIndex
CREATE INDEX "booking_payment_audit_log_event_type_idx" ON "booking_payment_audit_log"("event_type");

-- CreateIndex
CREATE INDEX "booking_payment_audit_log_actor_idx" ON "booking_payment_audit_log"("actor");

-- CreateIndex
CREATE INDEX "booking_payment_audit_log_timestamp_utc_idx" ON "booking_payment_audit_log"("timestamp_utc");

-- CreateIndex
CREATE INDEX "force_majeure_events_affected_provider_id_idx" ON "force_majeure_events"("affected_provider_id");

-- CreateIndex
CREATE INDEX "force_majeure_events_created_at_idx" ON "force_majeure_events"("created_at");

-- CreateIndex
CREATE INDEX "provider_admin_review_queue_provider_id_idx" ON "provider_admin_review_queue"("provider_id");

-- CreateIndex
CREATE INDEX "provider_admin_review_queue_status_idx" ON "provider_admin_review_queue"("status");

-- AddForeignKey
ALTER TABLE "booking_scheduled_captures" ADD CONSTRAINT "booking_scheduled_captures_booking_group_id_fkey" FOREIGN KEY ("booking_group_id") REFERENCES "booking_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_consent_snapshots" ADD CONSTRAINT "booking_consent_snapshots_booking_group_id_fkey" FOREIGN KEY ("booking_group_id") REFERENCES "booking_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_payment_audit_log" ADD CONSTRAINT "booking_payment_audit_log_booking_group_id_fkey" FOREIGN KEY ("booking_group_id") REFERENCES "booking_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_admin_review_queue" ADD CONSTRAINT "provider_admin_review_queue_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
