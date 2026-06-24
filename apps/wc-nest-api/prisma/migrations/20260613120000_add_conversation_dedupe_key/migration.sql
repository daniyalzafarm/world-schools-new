-- AlterTable
ALTER TABLE "conversations" ADD COLUMN "dedupe_key" TEXT;

-- Backfill dedupe_key for existing USER_PROVIDER conversations so the unique
-- index below holds. The key format mirrors buildProviderConversationKey() in
-- conversations.service.ts:
--   <parentUserId>:<providerId>:<contextType|GENERAL>:<contextId|''>
-- The parent participant is the conversation_participants row with no provider_id
-- (provider staff rows carry a provider_id). Pre-existing threads keep their key;
-- no thread is split. Old creation logic enforced one thread per (parent,
-- provider), so these backfilled keys cannot collide.
UPDATE "conversations" c
SET "dedupe_key" =
      cp."user_id" || ':' ||
      (c."metadata" ->> 'providerId') || ':' ||
      COALESCE(c."context_type"::text, 'GENERAL') || ':' ||
      COALESCE(c."context_id", '')
FROM "conversation_participants" cp
WHERE cp."conversation_id" = c."id"
  AND cp."provider_id" IS NULL
  AND c."type" = 'USER_PROVIDER'
  AND c."metadata" ? 'providerId';

-- CreateIndex
CREATE UNIQUE INDEX "conversations_dedupe_key_key" ON "conversations"("dedupe_key");
