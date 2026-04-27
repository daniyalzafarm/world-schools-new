import { Module } from '@nestjs/common'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { ScheduleModule } from '@nestjs/schedule'
import { AppController } from './app.controller'
import { AppService } from './app.service'

// Core modules
import { ConfigModule } from '../config/config.module'
import { PrismaModule } from '../prisma/prisma.module'
import { CommonModule } from '../common/common.module'

// Feature modules
import { AuthModule } from '../modules/core/auth/auth.module'
import { HealthModule } from '../modules/health/health.module'
import { MessagingModule } from '../modules/messaging/messaging.module'
import { SupportTicketsModule } from '../modules/support-tickets/support-tickets.module'

// Global WebSocket module
import { WebSocketModule } from '../modules/websocket/websocket.module'

// Stripe module (global — exports StripeService)
import { StripeModule } from '../modules/stripe/stripe.module'

// Domain modules
import { SuperAdminModule } from '../modules/superadmin/superadmin.module'
import { ProviderModule } from '../modules/provider/provider.module'
import { UserModule } from '../modules/user/user.module'
import { KbModule } from '../modules/kb/kb.module'
import { CatalogueModule } from '../modules/catalogue/catalogue.module'
import { NotificationsModule } from '../modules/notifications/notifications.module'

@Module({
  imports: [
    // Core infrastructure
    ConfigModule,
    PrismaModule,
    CommonModule,
    EventEmitterModule.forRoot({
      // Raise the listener limit per event to surface any unintended accumulation early.
      // Default Node.js limit is 10; 20 gives headroom for all @OnEvent handlers while
      // still triggering a warning if something registers listeners unexpectedly.
      maxListeners: 20,
    }),
    ScheduleModule.forRoot(),

    // Feature modules
    AuthModule,
    HealthModule,
    MessagingModule,
    SupportTicketsModule,

    // Global WebSocket
    WebSocketModule,

    // Stripe (global — registers StripeService + webhook handler)
    StripeModule,

    // Domain modules
    SuperAdminModule,
    ProviderModule,
    UserModule,
    KbModule,
    CatalogueModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
