/*
  Warnings:

  - You are about to drop the column `cdn_url` on the `message_attachments` table. All the data in the column will be lost.
  - You are about to drop the column `attachments` on the `messages` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "message_attachments" DROP COLUMN "cdn_url",
ALTER COLUMN "message_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "messages" DROP COLUMN "attachments";

-- AddForeignKey
ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
