import { Module } from '@nestjs/common'
import { MessagingModule } from '../../messaging/messaging.module'
import { ProviderMessagesController } from './provider-messages.controller'
import { ProviderConversationsController } from './provider-conversations.controller'
import { ProviderAttachmentsController } from './provider-attachments.controller'

/**
 * Provider Messaging Module
 *
 * This module provides app-specific messaging endpoints for the wc-provider app.
 * It wraps the shared MessagingModule services with provider-specific controllers.
 *
 * Endpoints:
 * - /provider/messaging/messages/*
 * - /provider/messaging/conversations/*
 * - /provider/messaging/attachments/*
 *
 * Authentication:
 * - Uses wc_provider_access_token cookie (automatically selected by JWT strategy based on /provider/* path)
 */
@Module({
  imports: [MessagingModule],
  controllers: [
    ProviderMessagesController,
    ProviderConversationsController,
    ProviderAttachmentsController,
  ],
})
export class ProviderMessagingModule {}
