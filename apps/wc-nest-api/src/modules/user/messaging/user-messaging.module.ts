import { Module } from '@nestjs/common'
import { MessagingModule } from '../../messaging/messaging.module'
import { UserMessagesController } from './user-messages.controller'
import { UserConversationsController } from './user-conversations.controller'

/**
 * User Messaging Module
 *
 * This module provides app-specific messaging endpoints for the wc-booking (user) app.
 * It wraps the shared MessagingModule services with user-specific controllers.
 *
 * Endpoints:
 * - /user/messaging/messages/*
 * - /user/messaging/conversations/*
 *
 * Authentication:
 * - Uses wc_user_access_token cookie (automatically selected by JWT strategy based on /user/* path)
 */
@Module({
  imports: [MessagingModule],
  controllers: [UserMessagesController, UserConversationsController],
})
export class UserMessagingModule {}
