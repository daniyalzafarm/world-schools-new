-- CreateIndex
CREATE INDEX "conversation_participants_conversation_id_user_id_archived_idx" ON "conversation_participants"("conversation_id", "user_id", "archived");

-- CreateIndex
CREATE INDEX "conversations_created_at_idx" ON "conversations"("created_at");

-- CreateIndex
CREATE INDEX "messages_priority_idx" ON "messages"("priority");

-- CreateIndex
CREATE INDEX "support_tickets_first_response_due_at_status_idx" ON "support_tickets"("first_response_due_at", "status");

-- CreateIndex
CREATE INDEX "support_tickets_resolution_due_at_status_idx" ON "support_tickets"("resolution_due_at", "status");
