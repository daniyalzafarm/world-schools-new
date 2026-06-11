import { Module } from '@nestjs/common'
import { MessagingModule } from '../../messaging/messaging.module'
import { ConfigModule } from '../../../config/config.module'
import { ProviderMessagesController } from './provider-messages.controller'
import { ProviderConversationsController } from './provider-conversations.controller'
import { ProviderAttachmentsController } from './provider-attachments.controller'
import { ProviderContactProfileService } from './provider-contact-profile.service'
import { ProfilePhotoService } from '../../user/auth/services/profile-photo.service'

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
  imports: [MessagingModule, ConfigModule],
  controllers: [
    ProviderMessagesController,
    ProviderConversationsController,
    ProviderAttachmentsController,
  ],
  providers: [ProviderContactProfileService, ProfilePhotoService],
})
export class ProviderMessagingModule {}
