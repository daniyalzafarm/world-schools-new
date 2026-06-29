import { Logger, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { PrismaModule } from '../../prisma/prisma.module'
import { ConfigModule } from '../../config/config.module'
import { ConfigService } from '../../config/config.service'
import { RedisModule } from '../redis/redis.module'
import { WebSocketModule } from '../websocket/websocket.module'

// Services
import { ConversationsService } from './services/conversations.service'
import { MessagesService } from './services/messages.service'
import { SearchService } from './services/search.service'
import { RedisPubSubService } from './services/redis-pub-sub.service'
import { PresenceService } from './services/presence.service'
import { TypingService } from './services/typing.service'
import { AttachmentsService } from './services/attachments.service'
import { AttachmentCleanupService } from './services/attachment-cleanup.service'
import { GdprService } from './services/gdpr.service'
import { ReportsService } from './services/reports.service'
import { SanitizationService } from './services/sanitization.service'

// Controllers
import { ConversationsController } from './controllers/conversations.controller'
import { MessagesController } from './controllers/messages.controller'
import { SearchController } from './controllers/search.controller'
import { GdprController } from './controllers/gdpr.controller'
import { ReportsController } from './controllers/reports.controller'

// WebSocket Event Handler (uses global WebSocket gateway)
import { MessagingWebSocketHandler } from './messaging.websocket-handler'

// Auth dependencies
import { AuthService } from '../core/auth/auth.service'
import { JwtStrategy } from '../core/auth/strategies/jwt.strategy'
import { WsJwtGuard } from '../core/auth/guards/ws-jwt.guard'

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    RedisModule,
    WebSocketModule,
    PassportModule,
    // JWT module for WebSocket authentication
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.jwtConfig.secret,
        signOptions: {
          expiresIn: configService.jwtConfig.expiresIn as any,
        },
      }),
    }),
  ],
  providers: [
    // Core services
    ConversationsService,
    MessagesService,
    SearchService,

    // Real-time services
    RedisPubSubService,
    PresenceService,
    TypingService,

    // Attachment service
    AttachmentsService,
    AttachmentCleanupService,

    // Security & Compliance services
    SanitizationService,
    GdprService,
    ReportsService,

    // WebSocket Event Handler (handles events from global WebSocket gateway)
    MessagingWebSocketHandler,

    // Auth dependencies for WebSocket and HTTP
    AuthService,
    JwtStrategy,
    WsJwtGuard,
  ],
  controllers: [
    ConversationsController,
    MessagesController,
    SearchController,
    GdprController,
    ReportsController,
  ],
  exports: [
    // Export services for use in other modules
    ConversationsService,
    MessagesService,
    SearchService,
    RedisPubSubService,
    PresenceService,
    TypingService,
    AttachmentsService,
    SanitizationService,
    GdprService,
    ReportsService,
  ],
})
export class MessagingModule implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MessagingModule.name)
  private cacheMetricsInterval: ReturnType<typeof setInterval> | null = null

  constructor(private readonly conversationsService: ConversationsService) {}

  async onModuleInit() {
    // Warm cache on startup
    this.logger.log('Initializing messaging module...')
    await this.conversationsService.warmCache()

    // Monitor cache size every 5 minutes
    this.cacheMetricsInterval = setInterval(
      async () => {
        try {
          const metrics = await this.conversationsService.getCacheMetrics()

          // Log metrics for monitoring dashboard
          this.logger.log('Cache metrics:', {
            memoryUsageMB: (metrics.usedMemory / 1024 / 1024).toFixed(2),
            keyCount: metrics.keyCount,
            evictedKeys: metrics.evictedKeys,
            fragmentationRatio: metrics.memoryFragmentationRatio,
          })
        } catch (error) {
          this.logger.error('Failed to get cache metrics', error)
        }
      },
      5 * 60 * 1000
    ) // Every 5 minutes
  }

  onModuleDestroy() {
    if (this.cacheMetricsInterval) {
      clearInterval(this.cacheMetricsInterval)
      this.cacheMetricsInterval = null
    }
  }
}
