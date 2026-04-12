import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { ConfigModule } from '../../config/config.module'
import { ConfigService } from '../../config/config.service'
import { GlobalWebSocketGateway } from './websocket.gateway'
import { WebSocketService } from './websocket.service'
import { WebSocketRedisService } from './websocket-redis.service'

/**
 * Global WebSocket Module
 *
 * Provides application-level WebSocket connection management.
 * Domain-specific modules (messaging, notifications, presence)
 * import this module and register event handlers to process
 * WebSocket events routed via EventEmitter2.
 *
 * WebSocketRedisService owns the two shared Redis connections used by:
 *  - The Socket.io Redis adapter (cross-replica broadcasting)
 *  - RedisPubSubService (application-level pub/sub channels)
 */
@Module({
  imports: [
    ConfigModule,
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
  providers: [GlobalWebSocketGateway, WebSocketService, WebSocketRedisService],
  exports: [WebSocketService, WebSocketRedisService],
})
export class WebSocketModule {}
