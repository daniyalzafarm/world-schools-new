-- AlterTable
ALTER TABLE "providers" ADD COLUMN     "stripe_attention_required" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "stripe_webhook_events_processed_at_idx" ON "stripe_webhook_events"("processed_at");
