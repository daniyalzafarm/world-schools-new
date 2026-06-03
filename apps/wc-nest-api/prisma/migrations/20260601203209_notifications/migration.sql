-- CreateEnum
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('pending', 'sent', 'failed', 'skipped');

-- AlterTable
ALTER TABLE "booking_groups" ADD COLUMN     "abandoned_notified_at" TIMESTAMP(3),
ADD COLUMN     "checkout_started" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "last_activity_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "parents" ADD COLUMN     "profile_completion" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "providers" ADD COLUMN     "profile_completion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "stripe_account_disconnected_at" TIMESTAMP(3),
ADD COLUMN     "stripe_account_disconnected_reason" TEXT;

-- CreateTable
CREATE TABLE "notification_deliveries" (
    "id" TEXT NOT NULL,
    "template_key" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "recipient_user_id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "dedupe_key" TEXT NOT NULL,
    "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'pending',
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "job_id" TEXT,
    "error_message" TEXT,
    "enqueued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMP(3),

    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "template_key" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_deliveries_recipient_user_id_idx" ON "notification_deliveries"("recipient_user_id");

-- CreateIndex
CREATE INDEX "notification_deliveries_status_idx" ON "notification_deliveries"("status");

-- CreateIndex
CREATE INDEX "notification_deliveries_entity_type_entity_id_idx" ON "notification_deliveries"("entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_deliveries_template_key_channel_dedupe_key_key" ON "notification_deliveries"("template_key", "channel", "dedupe_key");

-- CreateIndex
CREATE INDEX "notification_preferences_user_id_idx" ON "notification_preferences"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_user_id_template_key_channel_key" ON "notification_preferences"("user_id", "template_key", "channel");

-- CreateIndex
CREATE INDEX "booking_groups_status_created_at_idx" ON "booking_groups"("status", "created_at");

-- CreateIndex
CREATE INDEX "booking_groups_status_updated_at_idx" ON "booking_groups"("status", "updated_at");

-- CreateIndex
CREATE INDEX "sessions_start_date_idx" ON "sessions"("start_date");

-- CreateIndex
CREATE INDEX "sessions_end_date_idx" ON "sessions"("end_date");

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
