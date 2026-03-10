-- CreateEnum
CREATE TYPE "SupportTicketRequesterType" AS ENUM ('PARENT', 'PROVIDER');

-- CreateEnum
CREATE TYPE "SupportTicketSourceApp" AS ENUM ('WC_BOOKING', 'WC_PROVIDER', 'WC_SUPERADMIN', 'API');

-- CreateEnum
CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'PENDING_REQUESTER', 'PENDING_SUPPORT', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "SupportTicketPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "SupportTicketAudience" AS ENUM ('PARENT', 'PROVIDER', 'BOTH');

-- CreateEnum
CREATE TYPE "SupportTicketResolutionCode" AS ENUM ('FIXED', 'ANSWERED', 'WORKAROUND_PROVIDED', 'DUPLICATE', 'REFUNDED', 'POLICY_APPLIED', 'CANNOT_REPRODUCE', 'USER_NO_RESPONSE', 'OTHER');

-- AlterEnum
ALTER TYPE "ContextType" ADD VALUE 'SUPPORT_TICKET';

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" TEXT NOT NULL,
    "ticket_number" VARCHAR(30) NOT NULL,
    "subject" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "requester_type" "SupportTicketRequesterType" NOT NULL,
    "requester_user_id" TEXT,
    "requester_provider_id" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "source_app" "SupportTicketSourceApp" NOT NULL DEFAULT 'WC_BOOKING',
    "category_id" TEXT,
    "priority" "SupportTicketPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "conversation_id" TEXT NOT NULL,
    "assigned_to_user_id" TEXT,
    "assigned_by_user_id" TEXT,
    "assigned_at" TIMESTAMP(3),
    "sla_policy_id" TEXT,
    "first_response_due_at" TIMESTAMP(3),
    "first_responded_at" TIMESTAMP(3),
    "resolution_due_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "sla_first_response_breached_at" TIMESTAMP(3),
    "sla_resolution_breached_at" TIMESTAMP(3),
    "resolved_by_user_id" TEXT,
    "resolution_code" "SupportTicketResolutionCode",
    "resolution_summary" TEXT,
    "closed_by_user_id" TEXT,
    "closure_reason" TEXT,
    "reopened_count" INTEGER NOT NULL DEFAULT 0,
    "last_reopened_at" TIMESTAMP(3),
    "last_reopened_by_user_id" TEXT,
    "last_requester_reply_at" TIMESTAMP(3),
    "last_support_reply_at" TIMESTAMP(3),
    "booking_id" TEXT,
    "camp_id" TEXT,
    "session_id" TEXT,
    "satisfaction_score" INTEGER,
    "satisfaction_comment" TEXT,
    "satisfaction_submitted_at" TIMESTAMP(3),
    "satisfaction_submitted_by_user_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_ticket_categories" (
    "id" TEXT NOT NULL,
    "key" VARCHAR(60) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "audience" "SupportTicketAudience" NOT NULL DEFAULT 'BOTH',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "default_priority" "SupportTicketPriority",
    "default_sla_policy_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_ticket_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_ticket_sla_policies" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "first_response_target_minutes" INTEGER NOT NULL,
    "resolution_target_minutes" INTEGER NOT NULL,
    "business_hours_only" BOOLEAN NOT NULL DEFAULT true,
    "business_time_zone" VARCHAR(64),
    "pause_on_pending_requester" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_ticket_sla_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_ticket_status_history" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "from_status" "SupportTicketStatus",
    "to_status" "SupportTicketStatus" NOT NULL,
    "changed_by_user_id" TEXT,
    "change_reason" TEXT,
    "metadata" JSONB,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_ticket_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_ticket_assignment_history" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "from_assignee_user_id" TEXT,
    "to_assignee_user_id" TEXT,
    "changed_by_user_id" TEXT,
    "assignment_reason" TEXT,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_ticket_assignment_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "support_tickets_ticket_number_key" ON "support_tickets"("ticket_number");

-- CreateIndex
CREATE UNIQUE INDEX "support_tickets_conversation_id_key" ON "support_tickets"("conversation_id");

-- CreateIndex
CREATE INDEX "support_tickets_status_priority_created_at_idx" ON "support_tickets"("status", "priority", "created_at" DESC);

-- CreateIndex
CREATE INDEX "support_tickets_requester_type_status_created_at_idx" ON "support_tickets"("requester_type", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "support_tickets_assigned_to_user_id_status_updated_at_idx" ON "support_tickets"("assigned_to_user_id", "status", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "support_tickets_category_id_idx" ON "support_tickets"("category_id");

-- CreateIndex
CREATE INDEX "support_tickets_sla_policy_id_idx" ON "support_tickets"("sla_policy_id");

-- CreateIndex
CREATE INDEX "support_tickets_requester_user_id_idx" ON "support_tickets"("requester_user_id");

-- CreateIndex
CREATE INDEX "support_tickets_requester_provider_id_idx" ON "support_tickets"("requester_provider_id");

-- CreateIndex
CREATE INDEX "support_tickets_booking_id_idx" ON "support_tickets"("booking_id");

-- CreateIndex
CREATE INDEX "support_tickets_camp_id_idx" ON "support_tickets"("camp_id");

-- CreateIndex
CREATE INDEX "support_tickets_session_id_idx" ON "support_tickets"("session_id");

-- CreateIndex
CREATE INDEX "support_tickets_resolved_at_idx" ON "support_tickets"("resolved_at");

-- CreateIndex
CREATE INDEX "support_tickets_closed_at_idx" ON "support_tickets"("closed_at");

-- CreateIndex
CREATE INDEX "support_tickets_last_requester_reply_at_idx" ON "support_tickets"("last_requester_reply_at");

-- CreateIndex
CREATE INDEX "support_tickets_last_support_reply_at_idx" ON "support_tickets"("last_support_reply_at");

-- CreateIndex
CREATE INDEX "support_tickets_deleted_at_idx" ON "support_tickets"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "support_ticket_categories_key_key" ON "support_ticket_categories"("key");

-- CreateIndex
CREATE INDEX "support_ticket_categories_audience_is_active_idx" ON "support_ticket_categories"("audience", "is_active");

-- CreateIndex
CREATE INDEX "support_ticket_categories_sort_order_idx" ON "support_ticket_categories"("sort_order");

-- CreateIndex
CREATE INDEX "support_ticket_categories_default_sla_policy_id_idx" ON "support_ticket_categories"("default_sla_policy_id");

-- CreateIndex
CREATE UNIQUE INDEX "support_ticket_sla_policies_name_key" ON "support_ticket_sla_policies"("name");

-- CreateIndex
CREATE INDEX "support_ticket_sla_policies_is_active_idx" ON "support_ticket_sla_policies"("is_active");

-- CreateIndex
CREATE INDEX "support_ticket_status_history_ticket_id_changed_at_idx" ON "support_ticket_status_history"("ticket_id", "changed_at" DESC);

-- CreateIndex
CREATE INDEX "support_ticket_status_history_to_status_changed_at_idx" ON "support_ticket_status_history"("to_status", "changed_at" DESC);

-- CreateIndex
CREATE INDEX "support_ticket_status_history_changed_by_user_id_idx" ON "support_ticket_status_history"("changed_by_user_id");

-- CreateIndex
CREATE INDEX "support_ticket_assignment_history_ticket_id_assigned_at_idx" ON "support_ticket_assignment_history"("ticket_id", "assigned_at" DESC);

-- CreateIndex
CREATE INDEX "support_ticket_assignment_history_to_assignee_user_id_assig_idx" ON "support_ticket_assignment_history"("to_assignee_user_id", "assigned_at" DESC);

-- CreateIndex
CREATE INDEX "support_ticket_assignment_history_changed_by_user_id_idx" ON "support_ticket_assignment_history"("changed_by_user_id");

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_requester_user_id_fkey" FOREIGN KEY ("requester_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_requester_provider_id_fkey" FOREIGN KEY ("requester_provider_id") REFERENCES "providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "support_ticket_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assigned_to_user_id_fkey" FOREIGN KEY ("assigned_to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assigned_by_user_id_fkey" FOREIGN KEY ("assigned_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_sla_policy_id_fkey" FOREIGN KEY ("sla_policy_id") REFERENCES "support_ticket_sla_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_resolved_by_user_id_fkey" FOREIGN KEY ("resolved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_closed_by_user_id_fkey" FOREIGN KEY ("closed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_last_reopened_by_user_id_fkey" FOREIGN KEY ("last_reopened_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_camp_id_fkey" FOREIGN KEY ("camp_id") REFERENCES "camps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_satisfaction_submitted_by_user_id_fkey" FOREIGN KEY ("satisfaction_submitted_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_ticket_categories" ADD CONSTRAINT "support_ticket_categories_default_sla_policy_id_fkey" FOREIGN KEY ("default_sla_policy_id") REFERENCES "support_ticket_sla_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_ticket_status_history" ADD CONSTRAINT "support_ticket_status_history_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_ticket_status_history" ADD CONSTRAINT "support_ticket_status_history_changed_by_user_id_fkey" FOREIGN KEY ("changed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_ticket_assignment_history" ADD CONSTRAINT "support_ticket_assignment_history_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_ticket_assignment_history" ADD CONSTRAINT "support_ticket_assignment_history_from_assignee_user_id_fkey" FOREIGN KEY ("from_assignee_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_ticket_assignment_history" ADD CONSTRAINT "support_ticket_assignment_history_to_assignee_user_id_fkey" FOREIGN KEY ("to_assignee_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_ticket_assignment_history" ADD CONSTRAINT "support_ticket_assignment_history_changed_by_user_id_fkey" FOREIGN KEY ("changed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
