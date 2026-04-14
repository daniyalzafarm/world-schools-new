import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { ConfigModule } from '../../config/config.module'
import { AuthModule } from '../core/auth/auth.module'
import { MessagingModule } from '../messaging/messaging.module'
import { SupportTicketsController } from './controllers/support-tickets.controller'
import { SupportTicketConversationsController } from './controllers/support-ticket-conversations.controller'
import { UserSupportTicketsController } from './controllers/user-support-tickets.controller'
import { UserSupportTicketConversationsController } from './controllers/user-support-ticket-conversations.controller'
import { UserSupportTicketCategoriesController } from './controllers/user-support-ticket-categories.controller'
import { ProviderSupportTicketsController } from './controllers/provider-support-tickets.controller'
import { ProviderSupportTicketConversationsController } from './controllers/provider-support-ticket-conversations.controller'
import { ProviderSupportTicketCategoriesController } from './controllers/provider-support-ticket-categories.controller'
import { SupportTicketsService } from './services/support-tickets.service'
import { SupportTicketConversationService } from './services/support-ticket-conversation.service'
import { SupportTicketSlaService } from './services/support-ticket-sla.service'
import { SlaBreachMonitorService } from './services/sla-breach-monitor.service'

@Module({
  imports: [PrismaModule, ConfigModule, AuthModule, MessagingModule],
  controllers: [
    SupportTicketsController,
    SupportTicketConversationsController,
    UserSupportTicketsController,
    UserSupportTicketConversationsController,
    UserSupportTicketCategoriesController,
    ProviderSupportTicketsController,
    ProviderSupportTicketConversationsController,
    ProviderSupportTicketCategoriesController,
  ],
  providers: [
    SupportTicketsService,
    SupportTicketConversationService,
    SupportTicketSlaService,
    SlaBreachMonitorService,
  ],
  exports: [SupportTicketsService, SupportTicketConversationService, SupportTicketSlaService],
})
export class SupportTicketsModule {}
