/*
  Warnings:

  - You are about to drop the column `stripe_commission_percentage` on the `providers` table. All the data in the column will be lost.
  - You are about to alter the column `rejection_reason` on the `providers` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(2000)`.
  - You are about to drop the column `default_commission` on the `system_settings` table. All the data in the column will be lost.
  - You are about to alter the column `review_notes` on the `verification_documents` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(2000)`.
  - You are about to alter the column `rejection_reason` on the `verification_documents` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(2000)`.

*/
-- CreateEnum
CREATE TYPE "PaymentKind" AS ENUM ('deposit', 'balance', 'full', 'rebill');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('requires_payment_method', 'requires_confirmation', 'requires_action', 'processing', 'requires_capture', 'succeeded', 'canceled', 'failed');

-- CreateEnum
CREATE TYPE "CaptureMethod" AS ENUM ('automatic', 'manual');

-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('deposit_then_balance', 'full_at_due', 'full_at_booking');

-- CreateEnum
CREATE TYPE "RefundReason" AS ENUM ('grace_period', 'policy_balance', 'special_circumstance', 'provider_declined', 'provider_expired', 'camp_cancel', 'force_majeure', 'dispute', 'manual_admin', 'fraud');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('pending', 'succeeded', 'failed', 'canceled');

-- CreateEnum
CREATE TYPE "ReimbursementStatus" AS ENUM ('not_required', 'pending', 'invoiced', 'settled', 'written_off');

-- CreateEnum
CREATE TYPE "DisputeOutcome" AS ENUM ('open', 'won', 'lost', 'warning_closed', 'other');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('pending', 'in_transit', 'paid', 'failed', 'canceled');

-- CreateEnum
CREATE TYPE "PayoutMode" AS ENUM ('default_after_start', 'offset_days', 'policy_staged');

-- CreateEnum
CREATE TYPE "PayoutTrancheReason" AS ENUM ('deposit_grace', 'tier_threshold', 'final_default', 'offset_release', 'partial_residual');

-- CreateEnum
CREATE TYPE "PayoutTrancheStatus" AS ENUM ('pending', 'released', 'paid', 'failed', 'canceled', 'skipped');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "BookingGroupStatus" ADD VALUE 'payment_failed';
ALTER TYPE "BookingGroupStatus" ADD VALUE 'partially_refunded';
ALTER TYPE "BookingGroupStatus" ADD VALUE 'fully_refunded';
ALTER TYPE "BookingGroupStatus" ADD VALUE 'disputed';

-- AlterTable
ALTER TABLE "booking_groups" ADD COLUMN     "app_fee_percentage_snapshot" DECIMAL(5,2),
ADD COLUMN     "balance_due_at" TIMESTAMP(3),
ADD COLUMN     "cancellation_policy_snapshot" JSONB,
ADD COLUMN     "cancelled_at" TIMESTAMP(3),
ADD COLUMN     "cancelled_by_user_id" TEXT,
ADD COLUMN     "cancelled_reason" TEXT,
ADD COLUMN     "grace_period_ends_at" TIMESTAMP(3),
ADD COLUMN     "payment_mode" "PaymentMode",
ADD COLUMN     "payout_mode" "PayoutMode" NOT NULL DEFAULT 'default_after_start',
ADD COLUMN     "payout_offset_days_snapshot" INTEGER,
ADD COLUMN     "payout_override_agreed_at" TIMESTAMP(3),
ADD COLUMN     "payout_override_agreed_by_admin_id" TEXT,
ADD COLUMN     "payout_released_at" TIMESTAMP(3),
ADD COLUMN     "service_fee_amount" DECIMAL(12,2),
ADD COLUMN     "transfer_date" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "camps" ADD COLUMN     "deposit_fixed_amount" DECIMAL(10,2),
ADD COLUMN     "deposit_percentage" INTEGER,
ADD COLUMN     "deposit_required" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "deposit_type" TEXT;

-- AlterTable
ALTER TABLE "provider_settings" ADD COLUMN     "early_payout_offset_days" INTEGER,
ADD COLUMN     "payout_mode" "PayoutMode" NOT NULL DEFAULT 'default_after_start',
ADD COLUMN     "payout_mode_agreed_at" TIMESTAMP(3),
ADD COLUMN     "payout_mode_agreed_by_admin_id" TEXT,
ADD COLUMN     "payout_mode_agreement_note" TEXT;

-- AlterTable
ALTER TABLE "providers" DROP COLUMN "stripe_commission_percentage",
ADD COLUMN     "app_fee_custom" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "app_fee_percentage" DECIMAL(5,2),
ADD COLUMN     "app_fee_updated_at" TIMESTAMP(3),
ADD COLUMN     "app_fee_updated_by_admin_id" TEXT,
ALTER COLUMN "rejection_reason" SET DATA TYPE VARCHAR(2000);

-- AlterTable
ALTER TABLE "system_settings" DROP COLUMN "default_commission",
ADD COLUMN     "default_app_fee" DECIMAL(5,2) NOT NULL DEFAULT 10;

-- AlterTable
ALTER TABLE "verification_documents" ALTER COLUMN "review_notes" SET DATA TYPE VARCHAR(2000),
ALTER COLUMN "rejection_reason" SET DATA TYPE VARCHAR(2000);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "booking_group_id" TEXT NOT NULL,
    "kind" "PaymentKind" NOT NULL,
    "stripe_payment_intent_id" TEXT,
    "stripe_setup_intent_id" TEXT,
    "stripe_charge_id" TEXT,
    "stripe_payment_method_id" TEXT,
    "provider_connect_customer_id" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "application_fee_amount" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "stripe_account_id" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL,
    "capture_method" "CaptureMethod" NOT NULL,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "next_retry_at" TIMESTAMP(3),
    "due_at" TIMESTAMP(3),
    "failure_code" TEXT,
    "failure_message" TEXT,
    "captured_at" TIMESTAMP(3),
    "succeeded_at" TIMESTAMP(3),
    "canceled_at" TIMESTAMP(3),
    "processing_started_at" TIMESTAMP(3),
    "idempotency_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "booking_group_id" TEXT NOT NULL,
    "stripe_refund_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" "RefundReason" NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'pending',
    "policy_snapshot" JSONB,
    "requires_reimbursement" BOOLEAN NOT NULL DEFAULT false,
    "reimbursement_status" "ReimbursementStatus" NOT NULL DEFAULT 'not_required',
    "stripe_failure_reason" TEXT,
    "initiated_by_user_id" TEXT,
    "succeeded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_payment_methods" (
    "id" TEXT NOT NULL,
    "provider_connect_customer_id" TEXT NOT NULL,
    "stripe_payment_method_id" TEXT NOT NULL,
    "brand" VARCHAR(20) NOT NULL,
    "last4" VARCHAR(4) NOT NULL,
    "exp_month" INTEGER NOT NULL,
    "exp_year" INTEGER NOT NULL,
    "funding" VARCHAR(20) NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_connect_customers" (
    "id" TEXT NOT NULL,
    "parent_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "stripe_account_id" TEXT NOT NULL,
    "stripe_customer_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_connect_customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disputes" (
    "id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "booking_group_id" TEXT NOT NULL,
    "stripe_dispute_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "outcome" "DisputeOutcome" NOT NULL DEFAULT 'open',
    "evidence_due_by" TIMESTAMP(3),
    "funds_withdrawn_at" TIMESTAMP(3),
    "funds_reinstated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payout_events" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "stripe_payout_id" TEXT NOT NULL,
    "stripe_account_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "arrival_date" TIMESTAMP(3) NOT NULL,
    "status" "PayoutStatus" NOT NULL,
    "failure_code" TEXT,
    "failure_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payout_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_payout_schedules" (
    "id" TEXT NOT NULL,
    "booking_group_id" TEXT NOT NULL,
    "reason" "PayoutTrancheReason" NOT NULL,
    "release_at" TIMESTAMP(3) NOT NULL,
    "planned_amount" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "tier_days_before_start" INTEGER,
    "tier_refund_percent" INTEGER,
    "status" "PayoutTrancheStatus" NOT NULL DEFAULT 'pending',
    "released_at" TIMESTAMP(3),
    "released_amount" DECIMAL(12,2),
    "stripe_payout_id" TEXT,
    "payout_event_id" TEXT,
    "skip_reason" TEXT,
    "release_attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booking_payout_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reimbursements" (
    "id" TEXT NOT NULL,
    "booking_group_id" TEXT NOT NULL,
    "refund_id" TEXT NOT NULL,
    "amount_owed" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "status" "ReimbursementStatus" NOT NULL DEFAULT 'pending',
    "last_reminder_sent_at" TIMESTAMP(3),
    "settled_at" TIMESTAMP(3),
    "settled_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reimbursements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payments_stripe_payment_intent_id_key" ON "payments"("stripe_payment_intent_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_stripe_setup_intent_id_key" ON "payments"("stripe_setup_intent_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_stripe_charge_id_key" ON "payments"("stripe_charge_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_idempotency_key_key" ON "payments"("idempotency_key");

-- CreateIndex
CREATE INDEX "payments_booking_group_id_idx" ON "payments"("booking_group_id");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE INDEX "payments_due_at_idx" ON "payments"("due_at");

-- CreateIndex
CREATE INDEX "payments_next_retry_at_idx" ON "payments"("next_retry_at");

-- CreateIndex
CREATE INDEX "payments_kind_idx" ON "payments"("kind");

-- CreateIndex
CREATE INDEX "payments_provider_connect_customer_id_idx" ON "payments"("provider_connect_customer_id");

-- CreateIndex
CREATE INDEX "payments_stripe_account_id_idx" ON "payments"("stripe_account_id");

-- CreateIndex
CREATE INDEX "payments_processing_started_at_idx" ON "payments"("processing_started_at");

-- CreateIndex
CREATE UNIQUE INDEX "refunds_stripe_refund_id_key" ON "refunds"("stripe_refund_id");

-- CreateIndex
CREATE INDEX "refunds_booking_group_id_idx" ON "refunds"("booking_group_id");

-- CreateIndex
CREATE INDEX "refunds_reimbursement_status_idx" ON "refunds"("reimbursement_status");

-- CreateIndex
CREATE INDEX "refunds_status_idx" ON "refunds"("status");

-- CreateIndex
CREATE UNIQUE INDEX "refunds_payment_id_reason_key" ON "refunds"("payment_id", "reason");

-- CreateIndex
CREATE INDEX "saved_payment_methods_provider_connect_customer_id_idx" ON "saved_payment_methods"("provider_connect_customer_id");

-- CreateIndex
CREATE INDEX "saved_payment_methods_is_default_idx" ON "saved_payment_methods"("is_default");

-- CreateIndex
CREATE UNIQUE INDEX "saved_payment_methods_provider_connect_customer_id_stripe_p_key" ON "saved_payment_methods"("provider_connect_customer_id", "stripe_payment_method_id");

-- CreateIndex
CREATE INDEX "provider_connect_customers_stripe_customer_id_idx" ON "provider_connect_customers"("stripe_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "provider_connect_customers_parent_id_provider_id_key" ON "provider_connect_customers"("parent_id", "provider_id");

-- CreateIndex
CREATE UNIQUE INDEX "provider_connect_customers_stripe_account_id_stripe_custome_key" ON "provider_connect_customers"("stripe_account_id", "stripe_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "disputes_stripe_dispute_id_key" ON "disputes"("stripe_dispute_id");

-- CreateIndex
CREATE INDEX "disputes_booking_group_id_idx" ON "disputes"("booking_group_id");

-- CreateIndex
CREATE INDEX "disputes_outcome_idx" ON "disputes"("outcome");

-- CreateIndex
CREATE UNIQUE INDEX "payout_events_stripe_payout_id_key" ON "payout_events"("stripe_payout_id");

-- CreateIndex
CREATE INDEX "payout_events_provider_id_idx" ON "payout_events"("provider_id");

-- CreateIndex
CREATE INDEX "payout_events_arrival_date_idx" ON "payout_events"("arrival_date");

-- CreateIndex
CREATE INDEX "payout_events_status_idx" ON "payout_events"("status");

-- CreateIndex
CREATE INDEX "booking_payout_schedules_booking_group_id_idx" ON "booking_payout_schedules"("booking_group_id");

-- CreateIndex
CREATE INDEX "booking_payout_schedules_release_at_status_idx" ON "booking_payout_schedules"("release_at", "status");

-- CreateIndex
CREATE INDEX "booking_payout_schedules_stripe_payout_id_idx" ON "booking_payout_schedules"("stripe_payout_id");

-- CreateIndex
CREATE INDEX "booking_payout_schedules_payout_event_id_idx" ON "booking_payout_schedules"("payout_event_id");

-- CreateIndex
CREATE INDEX "reimbursements_booking_group_id_idx" ON "reimbursements"("booking_group_id");

-- CreateIndex
CREATE INDEX "reimbursements_status_idx" ON "reimbursements"("status");

-- CreateIndex
CREATE INDEX "reimbursements_due_date_idx" ON "reimbursements"("due_date");

-- CreateIndex
CREATE INDEX "booking_groups_transfer_date_idx" ON "booking_groups"("transfer_date");

-- CreateIndex
CREATE INDEX "booking_groups_balance_due_at_idx" ON "booking_groups"("balance_due_at");

-- AddForeignKey
ALTER TABLE "providers" ADD CONSTRAINT "providers_app_fee_updated_by_admin_id_fkey" FOREIGN KEY ("app_fee_updated_by_admin_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_settings" ADD CONSTRAINT "provider_settings_payout_mode_agreed_by_admin_id_fkey" FOREIGN KEY ("payout_mode_agreed_by_admin_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_groups" ADD CONSTRAINT "booking_groups_cancelled_by_user_id_fkey" FOREIGN KEY ("cancelled_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_groups" ADD CONSTRAINT "booking_groups_payout_override_agreed_by_admin_id_fkey" FOREIGN KEY ("payout_override_agreed_by_admin_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_group_id_fkey" FOREIGN KEY ("booking_group_id") REFERENCES "booking_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_provider_connect_customer_id_fkey" FOREIGN KEY ("provider_connect_customer_id") REFERENCES "provider_connect_customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_booking_group_id_fkey" FOREIGN KEY ("booking_group_id") REFERENCES "booking_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_initiated_by_user_id_fkey" FOREIGN KEY ("initiated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_payment_methods" ADD CONSTRAINT "saved_payment_methods_provider_connect_customer_id_fkey" FOREIGN KEY ("provider_connect_customer_id") REFERENCES "provider_connect_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_connect_customers" ADD CONSTRAINT "provider_connect_customers_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "parents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_connect_customers" ADD CONSTRAINT "provider_connect_customers_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_booking_group_id_fkey" FOREIGN KEY ("booking_group_id") REFERENCES "booking_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_events" ADD CONSTRAINT "payout_events_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_payout_schedules" ADD CONSTRAINT "booking_payout_schedules_booking_group_id_fkey" FOREIGN KEY ("booking_group_id") REFERENCES "booking_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_payout_schedules" ADD CONSTRAINT "booking_payout_schedules_payout_event_id_fkey" FOREIGN KEY ("payout_event_id") REFERENCES "payout_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reimbursements" ADD CONSTRAINT "reimbursements_booking_group_id_fkey" FOREIGN KEY ("booking_group_id") REFERENCES "booking_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reimbursements" ADD CONSTRAINT "reimbursements_refund_id_fkey" FOREIGN KEY ("refund_id") REFERENCES "refunds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reimbursements" ADD CONSTRAINT "reimbursements_settled_by_user_id_fkey" FOREIGN KEY ("settled_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
