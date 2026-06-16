-- AlterTable
-- Per-user "marked unread" flag (WhatsApp-style): a conversation can show as
-- unread with zero unread messages; cleared when the conversation is opened.
ALTER TABLE "conversation_participants" ADD COLUMN "manually_unread" BOOLEAN NOT NULL DEFAULT false;
