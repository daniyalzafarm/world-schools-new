# WebSocket Server - Code Implementation Guide

**Version:** 1.0  
**Date:** 2026-01-25  
**Companion to:** WEBSOCKET_IMPLEMENTATION_PLAN.md

---

## Table of Contents

1. [Module Structure](#module-structure)
2. [Core Files](#core-files)
3. [Configuration Files](#configuration-files)
4. [Testing Files](#testing-files)
5. [Docker & Deployment](#docker--deployment)

---

## Module Structure

```
apps/wc-nest-api/src/modules/messaging/
├── messaging.module.ts              # Main module
├── messaging.gateway.ts             # WebSocket gateway
├── config/
│   └── websocket.config.ts          # WebSocket configuration
├── services/
│   ├── redis-pubsub.service.ts      # Redis pub/sub for scaling
│   ├── presence.service.ts          # User presence tracking
│   ├── typing.service.ts            # Typing indicators
│   └── room.service.ts              # Room management
├── middleware/
│   └── ws-auth.middleware.ts        # WebSocket authentication
└── dto/
    ├── authenticate.dto.ts          # Authentication DTO
    ├── join-conversation.dto.ts     # Join conversation DTO
    └── typing-event.dto.ts          # Typing event DTO

apps/wc-nest-api/src/modules/core/auth/
├── guards/
│   └── ws-jwt.guard.ts              # WebSocket JWT guard
└── decorators/
    └── ws-user.decorator.ts         # WebSocket user decorator
```

---

## Core Files

### File 1: `messaging.module.ts`

**Path**: `apps/wc-nest-api/src/modules/messaging/messaging.module.ts`

```typescript
import { Module } from '@nestjs/common'
import { MessagingGateway } from './messaging.gateway'
import { RedisPubSubService } from './services/redis-pubsub.service'
import { PresenceService } from './services/presence.service'
import { TypingService } from './services/typing.service'
import { RoomService } from './services/room.service'
import { CoreModule } from '../core/core.module'

@Module({
  imports: [CoreModule],
  providers: [
    MessagingGateway,
    RedisPubSubService,
    PresenceService,
    TypingService,
    RoomService,
  ],
  exports: [RedisPubSubService],
})
export class MessagingModule {}
```

### File 2: `websocket.config.ts`

**Path**: `apps/wc-nest-api/src/modules/messaging/config/websocket.config.ts`

```typescript
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class WebSocketConfig {
  constructor(private configService: ConfigService) {}

  get port(): number {
    return this.configService.get<number>('WEBSOCKET_PORT', 3001)
  }

  get corsOrigins(): string[] {
    const origins = this.configService.get<string>('CORS_ORIGINS', '')
    return origins.split(',').filter(Boolean)
  }

  get redisUrl(): string {
    return this.configService.get<string>('REDIS_URL', 'redis://localhost:6379')
  }

  get namespace(): string {
    return '/messages'
  }

  get transports(): string[] {
    return ['websocket', 'polling']
  }

  get pingTimeout(): number {
    return 60000 // 60 seconds
  }

  get pingInterval(): number {
    return 25000 // 25 seconds
  }
}
```

### File 3: `redis-pubsub.service.ts`

**Path**: `apps/wc-nest-api/src/modules/messaging/services/redis-pubsub.service.ts`

```typescript
import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Redis from 'ioredis'
import { Server } from 'socket.io'

export interface PubSubMessage {
  event: string
  data: any
  room?: string
}

@Injectable()
export class RedisPubSubService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisPubSubService.name)
  private publisher: Redis
  private subscriber: Redis
  private server: Server

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const redisUrl = this.configService.get<string>('REDIS_URL')
    
    this.logger.log(`Connecting to Redis: ${redisUrl}`)

    // Create separate connections for pub and sub
    this.publisher = new Redis(redisUrl, {
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000)
        return delay
      },
    })

    this.subscriber = new Redis(redisUrl, {
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000)
        return delay
      },
    })

    // Subscribe to channels
    await this.subscriber.subscribe(
      'messages:new',
      'messages:updated',
      'messages:deleted',
      'typing:events',
      'presence:updates',
    )

    this.subscriber.on('message', (channel, message) => {
      this.handleRedisMessage(channel, message)
    })

    this.publisher.on('connect', () => {
      this.logger.log('Redis publisher connected')
    })

    this.subscriber.on('connect', () => {
      this.logger.log('Redis subscriber connected')
    })

    this.publisher.on('error', (error) => {
      this.logger.error('Redis publisher error:', error)
    })

    this.subscriber.on('error', (error) => {
      this.logger.error('Redis subscriber error:', error)
    })
  }

  async onModuleDestroy() {
    await this.publisher.quit()
    await this.subscriber.quit()
    this.logger.log('Redis connections closed')
  }

  setServer(server: Server) {
    this.server = server
  }

  async publish(channel: string, message: PubSubMessage) {
    try {
      await this.publisher.publish(channel, JSON.stringify(message))
      this.logger.debug(`Published to ${channel}:`, message.event)
    } catch (error) {
      this.logger.error(`Failed to publish to ${channel}:`, error)
    }
  }

  private handleRedisMessage(channel: string, message: string) {
    try {
      const data: PubSubMessage = JSON.parse(message)

      if (!this.server) {
        this.logger.warn('Socket.io server not set, cannot broadcast message')
        return
      }

      // Broadcast to appropriate room or all clients
      const target = data.room ? this.server.to(data.room) : this.server

      target.emit(data.event, data.data)

      this.logger.debug(`Broadcasted ${data.event} to ${data.room || 'all'}`)
    } catch (error) {
      this.logger.error(`Failed to handle Redis message from ${channel}:`, error)
    }
  }
}
```

### File 4: `presence.service.ts`

**Path**: `apps/wc-nest-api/src/modules/messaging/services/presence.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Redis from 'ioredis'

export enum PresenceStatus {
  ONLINE = 'ONLINE',
  AWAY = 'AWAY',
  OFFLINE = 'OFFLINE',
}

@Injectable()
export class PresenceService {
  private readonly logger = new Logger(PresenceService.name)
  private redis: Redis

  constructor(private configService: ConfigService) {
    const redisUrl = this.configService.get<string>('REDIS_URL')
    this.redis = new Redis(redisUrl)
  }

  async setOnline(userId: string): Promise<void> {
    const key = `presence:${userId}`
    await this.redis.setex(key, 300, PresenceStatus.ONLINE) // 5 minutes TTL
    this.logger.debug(`User ${userId} is now ONLINE`)
  }

  async setOffline(userId: string): Promise<void> {
    const key = `presence:${userId}`
    await this.redis.setex(key, 300, PresenceStatus.OFFLINE)
    this.logger.debug(`User ${userId} is now OFFLINE`)
  }

  async setAway(userId: string): Promise<void> {
    const key = `presence:${userId}`
    await this.redis.setex(key, 300, PresenceStatus.AWAY)
    this.logger.debug(`User ${userId} is now AWAY`)
  }

  async getStatus(userId: string): Promise<PresenceStatus> {
    const key = `presence:${userId}`
    const status = await this.redis.get(key)
    return (status as PresenceStatus) || PresenceStatus.OFFLINE
  }

  async heartbeat(userId: string): Promise<void> {
    const key = `presence:${userId}`
    const currentStatus = await this.redis.get(key)

    if (currentStatus) {
      await this.redis.expire(key, 300) // Extend TTL
    } else {
      await this.setOnline(userId)
    }
  }
}
```

### File 5: `typing.service.ts`

**Path**: `apps/wc-nest-api/src/modules/messaging/services/typing.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Redis from 'ioredis'

@Injectable()
export class TypingService {
  private readonly logger = new Logger(TypingService.name)
  private redis: Redis
  private readonly TYPING_TTL = 5 // 5 seconds

  constructor(private configService: ConfigService) {
    const redisUrl = this.configService.get<string>('REDIS_URL')
    this.redis = new Redis(redisUrl)
  }

  async startTyping(conversationId: string, userId: string): Promise<void> {
    const key = `typing:${conversationId}:${userId}`
    await this.redis.setex(key, this.TYPING_TTL, '1')
    this.logger.debug(`User ${userId} started typing in conversation ${conversationId}`)
  }

  async stopTyping(conversationId: string, userId: string): Promise<void> {
    const key = `typing:${conversationId}:${userId}`
    await this.redis.del(key)
    this.logger.debug(`User ${userId} stopped typing in conversation ${conversationId}`)
  }

  async getTypingUsers(conversationId: string): Promise<string[]> {
    const pattern = `typing:${conversationId}:*`
    const keys = await this.redis.keys(pattern)

    // Extract user IDs from keys
    const userIds = keys.map(key => {
      const parts = key.split(':')
      return parts[parts.length - 1]
    })

    return userIds
  }
}
```

### File 6: `room.service.ts`

**Path**: `apps/wc-nest-api/src/modules/messaging/services/room.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common'
import { Socket } from 'socket.io'

@Injectable()
export class RoomService {
  private readonly logger = new Logger(RoomService.name)

  async joinConversation(socket: Socket, conversationId: string, userId: string): Promise<void> {
    const room = `conversation:${conversationId}`
    await socket.join(room)
    this.logger.debug(`User ${userId} joined room ${room}`)
  }

  async leaveConversation(socket: Socket, conversationId: string, userId: string): Promise<void> {
    const room = `conversation:${conversationId}`
    await socket.leave(room)
    this.logger.debug(`User ${userId} left room ${room}`)
  }

  async joinUserRoom(socket: Socket, userId: string): Promise<void> {
    const room = `user:${userId}`
    await socket.join(room)
    this.logger.debug(`User ${userId} joined personal room ${room}`)
  }

  async leaveUserRoom(socket: Socket, userId: string): Promise<void> {
    const room = `user:${userId}`
    await socket.leave(room)
    this.logger.debug(`User ${userId} left personal room ${room}`)
  }

  getRoomName(type: 'conversation' | 'user', id: string): string {
    return `${type}:${id}`
  }
}
```

### File 7: `messaging.gateway.ts`

**Path**: `apps/wc-nest-api/src/modules/messaging/messaging.gateway.ts`

```typescript
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
} from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'
import { Logger, UseGuards } from '@nestjs/common'
import { createAdapter } from '@socket.io/redis-adapter'
import Redis from 'ioredis'
import { ConfigService } from '@nestjs/config'
import { WsJwtGuard } from '../core/auth/guards/ws-jwt.guard'
import { WsUser } from '../core/auth/decorators/ws-user.decorator'
import { RedisPubSubService } from './services/redis-pubsub.service'
import { PresenceService } from './services/presence.service'
import { TypingService } from './services/typing.service'
import { RoomService } from './services/room.service'

interface AuthenticatedUser {
  id: string
  email: string
  firstName: string
  lastName: string
}

@WebSocketGateway({
  namespace: '/messages',
  cors: {
    origin: (origin, callback) => {
      // Allow all origins in development, specific origins in production
      const allowedOrigins = process.env.CORS_ORIGINS?.split(',') || []

      if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
        callback(null, true)
      } else {
        callback(new Error('Not allowed by CORS'))
      }
    },
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
})
export class MessagingGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server

  private readonly logger = new Logger(MessagingGateway.name)

  constructor(
    private configService: ConfigService,
    private redisPubSub: RedisPubSubService,
    private presenceService: PresenceService,
    private typingService: TypingService,
    private roomService: RoomService,
  ) {}

  async afterInit(server: Server) {
    // Set up Redis adapter for horizontal scaling
    const redisUrl = this.configService.get<string>('REDIS_URL')
    const pubClient = new Redis(redisUrl)
    const subClient = pubClient.duplicate()

    server.adapter(createAdapter(pubClient, subClient))

    // Set server reference for pub/sub service
    this.redisPubSub.setServer(server)

    this.logger.log('WebSocket Gateway initialized with Redis adapter')
  }

  async handleConnection(client: Socket) {
    this.logger.log(`Client attempting to connect: ${client.id}`)

    // Note: Authentication happens in the 'authenticate' event
    // We allow connection but require authentication before any other events
  }

  async handleDisconnect(client: Socket) {
    const userId = client.data.userId

    if (userId) {
      await this.presenceService.setOffline(userId)

      // Publish presence update
      await this.redisPubSub.publish('presence:updates', {
        event: 'presence:update',
        data: {
          userId,
          status: 'OFFLINE',
          lastSeenAt: new Date().toISOString(),
        },
      })
    }

    this.logger.log(`Client disconnected: ${client.id}`)
  }

  @SubscribeMessage('authenticate')
  async handleAuthenticate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { token: string },
  ) {
    try {
      // JWT validation happens in WsJwtGuard
      // For now, we'll do basic validation here
      // In production, use proper JWT verification

      if (!data.token) {
        return { event: 'authenticated', data: { success: false, error: 'No token provided' } }
      }

      // TODO: Implement proper JWT verification
      // For now, mock user data
      const user: AuthenticatedUser = {
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
      }

      // Store user data in socket
      client.data.userId = user.id
      client.data.user = user

      // Join user's personal room
      await this.roomService.joinUserRoom(client, user.id)

      // Set user as online
      await this.presenceService.setOnline(user.id)

      // Publish presence update
      await this.redisPubSub.publish('presence:updates', {
        event: 'presence:update',
        data: {
          userId: user.id,
          status: 'ONLINE',
          lastSeenAt: new Date().toISOString(),
        },
      })

      this.logger.log(`User ${user.id} authenticated successfully`)

      return {
        event: 'authenticated',
        data: {
          success: true,
          userId: user.id,
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
          },
        },
      }
    } catch (error) {
      this.logger.error('Authentication failed:', error)
      return { event: 'authenticated', data: { success: false, error: 'Authentication failed' } }
    }
  }

  @SubscribeMessage('conversation:join')
  async handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userId = client.data.userId

    if (!userId) {
      return { event: 'error', data: { message: 'Not authenticated' } }
    }

    await this.roomService.joinConversation(client, data.conversationId, userId)

    return { event: 'conversation:joined', data: { conversationId: data.conversationId } }
  }

  @SubscribeMessage('conversation:leave')
  async handleLeaveConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userId = client.data.userId

    if (!userId) {
      return { event: 'error', data: { message: 'Not authenticated' } }
    }

    await this.roomService.leaveConversation(client, data.conversationId, userId)

    return { event: 'conversation:left', data: { conversationId: data.conversationId } }
  }

  @SubscribeMessage('typing:start')
  async handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userId = client.data.userId
    const user = client.data.user

    if (!userId) {
      return { event: 'error', data: { message: 'Not authenticated' } }
    }

    await this.typingService.startTyping(data.conversationId, userId)

    // Publish typing event to other replicas
    await this.redisPubSub.publish('typing:events', {
      event: 'typing:start',
      data: {
        conversationId: data.conversationId,
        userId,
        userName: `${user.firstName} ${user.lastName}`,
      },
      room: `conversation:${data.conversationId}`,
    })

    // Also broadcast locally (will be filtered by Redis adapter)
    client.to(`conversation:${data.conversationId}`).emit('typing:start', {
      conversationId: data.conversationId,
      userId,
      userName: `${user.firstName} ${user.lastName}`,
    })
  }

  @SubscribeMessage('typing:stop')
  async handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userId = client.data.userId

    if (!userId) {
      return { event: 'error', data: { message: 'Not authenticated' } }
    }

    await this.typingService.stopTyping(data.conversationId, userId)

    // Publish typing stop event
    await this.redisPubSub.publish('typing:events', {
      event: 'typing:stop',
      data: {
        conversationId: data.conversationId,
        userId,
      },
      room: `conversation:${data.conversationId}`,
    })

    client.to(`conversation:${data.conversationId}`).emit('typing:stop', {
      conversationId: data.conversationId,
      userId,
    })
  }

  @SubscribeMessage('presence:update')
  async handlePresenceUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { status: 'ONLINE' | 'AWAY' | 'OFFLINE' },
  ) {
    const userId = client.data.userId

    if (!userId) {
      return { event: 'error', data: { message: 'Not authenticated' } }
    }

    // Update presence in Redis
    if (data.status === 'ONLINE') {
      await this.presenceService.setOnline(userId)
    } else if (data.status === 'AWAY') {
      await this.presenceService.setAway(userId)
    } else {
      await this.presenceService.setOffline(userId)
    }

    // Publish presence update
    await this.redisPubSub.publish('presence:updates', {
      event: 'presence:update',
      data: {
        userId,
        status: data.status,
        lastSeenAt: new Date().toISOString(),
      },
    })
  }

  @SubscribeMessage('ping')
  async handlePing(@ConnectedSocket() client: Socket) {
    const userId = client.data.userId

    if (userId) {
      // Heartbeat to keep presence alive
      await this.presenceService.heartbeat(userId)
    }

    return { event: 'pong', data: { timestamp: Date.now() } }
  }
}
```

### File 8: `ws-jwt.guard.ts`

**Path**: `apps/wc-nest-api/src/modules/core/auth/guards/ws-jwt.guard.ts`

```typescript
import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { WsException } from '@nestjs/websockets'
import { Socket } from 'socket.io'

@Injectable()
export class WsJwtGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtGuard.name)

  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const client: Socket = context.switchToWs().getClient()
      const token = this.extractTokenFromHandshake(client)

      if (!token) {
        throw new WsException('No token provided')
      }

      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET,
      })

      // Attach user to socket data
      client.data.userId = payload.sub
      client.data.user = payload

      return true
    } catch (error) {
      this.logger.error('WebSocket authentication failed:', error)
      throw new WsException('Unauthorized')
    }
  }

  private extractTokenFromHandshake(client: Socket): string | null {
    // Try to get token from handshake auth
    const authToken = client.handshake.auth?.token
    if (authToken) {
      return authToken
    }

    // Try to get token from query parameters
    const queryToken = client.handshake.query?.token as string
    if (queryToken) {
      return queryToken
    }

    // Try to get token from headers
    const authHeader = client.handshake.headers?.authorization
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7)
    }

    return null
  }
}
```

### File 9: `ws-user.decorator.ts`

**Path**: `apps/wc-nest-api/src/modules/core/auth/decorators/ws-user.decorator.ts`

```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import { Socket } from 'socket.io'

export const WsUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const client: Socket = ctx.switchToWs().getClient()
    const user = client.data.user

    return data ? user?.[data] : user
  },
)
```

### File 10: DTOs

**Path**: `apps/wc-nest-api/src/modules/messaging/dto/authenticate.dto.ts`

```typescript
import { IsString, IsNotEmpty } from 'class-validator'

export class AuthenticateDto {
  @IsString()
  @IsNotEmpty()
  token: string
}
```

**Path**: `apps/wc-nest-api/src/modules/messaging/dto/join-conversation.dto.ts`

```typescript
import { IsString, IsNotEmpty, IsUUID } from 'class-validator'

export class JoinConversationDto {
  @IsUUID()
  @IsNotEmpty()
  conversationId: string
}
```

**Path**: `apps/wc-nest-api/src/modules/messaging/dto/typing-event.dto.ts`

```typescript
import { IsString, IsNotEmpty, IsUUID } from 'class-validator'

export class TypingEventDto {
  @IsUUID()
  @IsNotEmpty()
  conversationId: string
}
```

---

## Configuration Files

### File 11: Update `main.ts` for WebSocket Mode

**Path**: `apps/wc-nest-api/src/main.ts`

Add the following code to support WebSocket-only mode:

```typescript
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  const configService = app.get(ConfigService)

  // Enable CORS
  app.enableCors({
    origin: configService.get('CORS_ORIGINS')?.split(',') || '*',
    credentials: true,
  })

  // Enable validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  )

  // Check if running in WebSocket-only mode
  const websocketMode = configService.get('WEBSOCKET_MODE') === 'true'
  const port = websocketMode
    ? configService.get('WEBSOCKET_PORT', 3001)
    : configService.get('PORT', 3000)

  await app.listen(port)

  console.log(`Application is running on: ${await app.getUrl()}`)
  console.log(`Mode: ${websocketMode ? 'WebSocket Only' : 'Full API'}`)
}

bootstrap()
```

### File 12: Environment Variables

**Path**: `apps/wc-nest-api/.env.example`

```bash
# Application
NODE_ENV=development
PORT=3000

# WebSocket Configuration
WEBSOCKET_MODE=false
WEBSOCKET_PORT=3001

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/worldschools

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:4200

# Application Insights (Azure)
APPLICATIONINSIGHTS_CONNECTION_STRING=InstrumentationKey=...
```

### File 13: Docker Configuration

**Path**: `apps/wc-nest-api/Dockerfile`

Update or create Dockerfile with WebSocket support:

```dockerfile
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY nx.json ./
COPY tsconfig.base.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY apps/wc-nest-api ./apps/wc-nest-api
COPY libs ./libs

# Build application
RUN npx nx build wc-nest-api --configuration=production

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy built application
COPY --from=builder /app/dist/apps/wc-nest-api ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Expose ports
EXPOSE 3000 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:${WEBSOCKET_PORT:-3001}/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start command (can be overridden)
CMD ["node", "dist/main.js"]
```

### File 14: Docker Compose for Local Testing

**Path**: `apps/wc-nest-api/docker-compose.websocket.yml`

```yaml
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
    command: redis-server --appendonly yes
    volumes:
      - redis-data:/data
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 10s
      timeout: 3s
      retries: 3

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: worldschools
    ports:
      - '5432:5432'
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U postgres']
      interval: 10s
      timeout: 3s
      retries: 3

  websocket:
    build:
      context: ../..
      dockerfile: apps/wc-nest-api/Dockerfile
    ports:
      - '3001:3001'
    environment:
      NODE_ENV: development
      WEBSOCKET_MODE: 'true'
      WEBSOCKET_PORT: 3001
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/worldschools
      REDIS_URL: redis://redis:6379
      JWT_SECRET: dev-secret-key
      CORS_ORIGINS: http://localhost:3000,http://localhost:4200
    depends_on:
      redis:
        condition: service_healthy
      postgres:
        condition: service_healthy
    command: node dist/main.js

volumes:
  redis-data:
  postgres-data:
```

---

## Testing Files

### File 15: WebSocket Gateway Unit Tests

**Path**: `apps/wc-nest-api/src/modules/messaging/messaging.gateway.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing'
import { MessagingGateway } from './messaging.gateway'
import { RedisPubSubService } from './services/redis-pubsub.service'
import { PresenceService } from './services/presence.service'
import { TypingService } from './services/typing.service'
import { RoomService } from './services/room.service'
import { ConfigService } from '@nestjs/config'
import { Socket } from 'socket.io'

describe('MessagingGateway', () => {
  let gateway: MessagingGateway
  let redisPubSub: RedisPubSubService
  let presenceService: PresenceService
  let typingService: TypingService
  let roomService: RoomService

  const mockSocket = {
    id: 'test-socket-id',
    data: {},
    join: jest.fn(),
    leave: jest.fn(),
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
  } as unknown as Socket

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagingGateway,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config = {
                REDIS_URL: 'redis://localhost:6379',
                CORS_ORIGINS: 'http://localhost:3000',
              }
              return config[key]
            }),
          },
        },
        {
          provide: RedisPubSubService,
          useValue: {
            setServer: jest.fn(),
            publish: jest.fn(),
          },
        },
        {
          provide: PresenceService,
          useValue: {
            setOnline: jest.fn(),
            setOffline: jest.fn(),
            heartbeat: jest.fn(),
          },
        },
        {
          provide: TypingService,
          useValue: {
            startTyping: jest.fn(),
            stopTyping: jest.fn(),
          },
        },
        {
          provide: RoomService,
          useValue: {
            joinUserRoom: jest.fn(),
            joinConversation: jest.fn(),
            leaveConversation: jest.fn(),
          },
        },
      ],
    }).compile()

    gateway = module.get<MessagingGateway>(MessagingGateway)
    redisPubSub = module.get<RedisPubSubService>(RedisPubSubService)
    presenceService = module.get<PresenceService>(PresenceService)
    typingService = module.get<TypingService>(TypingService)
    roomService = module.get<RoomService>(RoomService)
  })

  it('should be defined', () => {
    expect(gateway).toBeDefined()
  })

  describe('handleAuthenticate', () => {
    it('should authenticate user with valid token', async () => {
      const result = await gateway.handleAuthenticate(mockSocket, {
        token: 'valid-token',
      })

      expect(result.data.success).toBe(true)
      expect(mockSocket.data.userId).toBeDefined()
      expect(presenceService.setOnline).toHaveBeenCalled()
      expect(roomService.joinUserRoom).toHaveBeenCalled()
    })

    it('should reject authentication without token', async () => {
      const result = await gateway.handleAuthenticate(mockSocket, {
        token: '',
      })

      expect(result.data.success).toBe(false)
      expect(result.data.error).toBe('No token provided')
    })
  })

  describe('handleJoinConversation', () => {
    it('should join conversation room', async () => {
      mockSocket.data.userId = 'user-123'

      const result = await gateway.handleJoinConversation(mockSocket, {
        conversationId: 'conv-456',
      })

      expect(roomService.joinConversation).toHaveBeenCalledWith(
        mockSocket,
        'conv-456',
        'user-123',
      )
      expect(result.data.conversationId).toBe('conv-456')
    })

    it('should reject unauthenticated user', async () => {
      mockSocket.data.userId = null

      const result = await gateway.handleJoinConversation(mockSocket, {
        conversationId: 'conv-456',
      })

      expect(result.event).toBe('error')
      expect(result.data.message).toBe('Not authenticated')
    })
  })

  describe('handleTypingStart', () => {
    it('should handle typing start event', async () => {
      mockSocket.data.userId = 'user-123'
      mockSocket.data.user = { firstName: 'John', lastName: 'Doe' }

      await gateway.handleTypingStart(mockSocket, {
        conversationId: 'conv-456',
      })

      expect(typingService.startTyping).toHaveBeenCalledWith('conv-456', 'user-123')
      expect(redisPubSub.publish).toHaveBeenCalledWith(
        'typing:events',
        expect.objectContaining({
          event: 'typing:start',
          data: expect.objectContaining({
            conversationId: 'conv-456',
            userId: 'user-123',
          }),
        }),
      )
    })
  })

  describe('handleDisconnect', () => {
    it('should set user offline on disconnect', async () => {
      mockSocket.data.userId = 'user-123'

      await gateway.handleDisconnect(mockSocket)

      expect(presenceService.setOffline).toHaveBeenCalledWith('user-123')
      expect(redisPubSub.publish).toHaveBeenCalledWith(
        'presence:updates',
        expect.objectContaining({
          event: 'presence:update',
          data: expect.objectContaining({
            userId: 'user-123',
            status: 'OFFLINE',
          }),
        }),
      )
    })
  })
})
```

### File 16: Redis Pub/Sub Integration Tests

**Path**: `apps/wc-nest-api/src/modules/messaging/services/redis-pubsub.service.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'
import { RedisPubSubService } from './redis-pubsub.service'
import Redis from 'ioredis'

// Mock ioredis
jest.mock('ioredis')

describe('RedisPubSubService', () => {
  let service: RedisPubSubService
  let mockPublisher: jest.Mocked<Redis>
  let mockSubscriber: jest.Mocked<Redis>

  beforeEach(async () => {
    mockPublisher = {
      publish: jest.fn(),
      quit: jest.fn(),
      on: jest.fn(),
    } as any

    mockSubscriber = {
      subscribe: jest.fn(),
      quit: jest.fn(),
      on: jest.fn(),
    } as any

    ;(Redis as jest.MockedClass<typeof Redis>).mockImplementation(() => mockPublisher)

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisPubSubService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('redis://localhost:6379'),
          },
        },
      ],
    }).compile()

    service = module.get<RedisPubSubService>(RedisPubSubService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('publish', () => {
    it('should publish message to Redis channel', async () => {
      const channel = 'messages:new'
      const message = {
        event: 'message:new',
        data: { id: '123', content: 'Hello' },
        room: 'conversation:456',
      }

      await service.publish(channel, message)

      expect(mockPublisher.publish).toHaveBeenCalledWith(
        channel,
        JSON.stringify(message),
      )
    })
  })
})
```

### File 17: WebSocket Client Test Script

**Path**: `apps/wc-nest-api/scripts/test-websocket-client.ts`

```typescript
import { io, Socket } from 'socket.io-client'

const WEBSOCKET_URL = process.env.WEBSOCKET_URL || 'ws://localhost:3001'
const JWT_TOKEN = process.env.JWT_TOKEN || 'your-test-token'

class WebSocketTestClient {
  private socket: Socket | null = null

  async connect() {
    console.log(`🔌 Connecting to ${WEBSOCKET_URL}/messages...`)

    this.socket = io(`${WEBSOCKET_URL}/messages`, {
      transports: ['websocket', 'polling'],
      auth: {
        token: JWT_TOKEN,
      },
    })

    this.setupEventListeners()

    return new Promise<void>((resolve, reject) => {
      this.socket!.on('connect', () => {
        console.log('✅ Connected to WebSocket server')
        console.log(`   Socket ID: ${this.socket!.id}`)
        resolve()
      })

      this.socket!.on('connect_error', (error) => {
        console.error('❌ Connection error:', error.message)
        reject(error)
      })
    })
  }

  private setupEventListeners() {
    if (!this.socket) return

    // Authentication events
    this.socket.on('authenticated', (data) => {
      console.log('🔐 Authenticated:', data)
    })

    // Message events
    this.socket.on('message:new', (data) => {
      console.log('📨 New message:', data)
    })

    this.socket.on('message:updated', (data) => {
      console.log('✏️  Message updated:', data)
    })

    this.socket.on('message:deleted', (data) => {
      console.log('🗑️  Message deleted:', data)
    })

    // Typing events
    this.socket.on('typing:start', (data) => {
      console.log('⌨️  User started typing:', data)
    })

    this.socket.on('typing:stop', (data) => {
      console.log('⏸️  User stopped typing:', data)
    })

    // Presence events
    this.socket.on('presence:update', (data) => {
      console.log('👤 Presence update:', data)
    })

    // Conversation events
    this.socket.on('conversation:joined', (data) => {
      console.log('🚪 Joined conversation:', data)
    })

    this.socket.on('conversation:left', (data) => {
      console.log('🚪 Left conversation:', data)
    })

    // Error events
    this.socket.on('error', (data) => {
      console.error('❌ Error:', data)
    })

    // Ping/Pong
    this.socket.on('pong', (data) => {
      console.log('🏓 Pong received:', data)
    })

    // Disconnect
    this.socket.on('disconnect', (reason) => {
      console.log('🔌 Disconnected:', reason)
    })
  }

  async authenticate() {
    if (!this.socket) throw new Error('Not connected')

    console.log('\n🔐 Authenticating...')
    this.socket.emit('authenticate', { token: JWT_TOKEN })
  }

  async joinConversation(conversationId: string) {
    if (!this.socket) throw new Error('Not connected')

    console.log(`\n🚪 Joining conversation: ${conversationId}`)
    this.socket.emit('conversation:join', { conversationId })
  }

  async leaveConversation(conversationId: string) {
    if (!this.socket) throw new Error('Not connected')

    console.log(`\n🚪 Leaving conversation: ${conversationId}`)
    this.socket.emit('conversation:leave', { conversationId })
  }

  async startTyping(conversationId: string) {
    if (!this.socket) throw new Error('Not connected')

    console.log(`\n⌨️  Starting typing in: ${conversationId}`)
    this.socket.emit('typing:start', { conversationId })
  }

  async stopTyping(conversationId: string) {
    if (!this.socket) throw new Error('Not connected')

    console.log(`\n⏸️  Stopping typing in: ${conversationId}`)
    this.socket.emit('typing:stop', { conversationId })
  }

  async ping() {
    if (!this.socket) throw new Error('Not connected')

    console.log('\n🏓 Sending ping...')
    this.socket.emit('ping')
  }

  disconnect() {
    if (this.socket) {
      console.log('\n🔌 Disconnecting...')
      this.socket.disconnect()
      this.socket = null
    }
  }
}

// Main test flow
async function main() {
  const client = new WebSocketTestClient()

  try {
    // Connect
    await client.connect()

    // Wait a bit
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Authenticate
    await client.authenticate()
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Join a conversation
    const testConversationId = 'test-conversation-123'
    await client.joinConversation(testConversationId)
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Start typing
    await client.startTyping(testConversationId)
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Stop typing
    await client.stopTyping(testConversationId)
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Send ping
    await client.ping()
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Leave conversation
    await client.leaveConversation(testConversationId)
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Disconnect
    client.disconnect()

    console.log('\n✅ Test completed successfully!')
    process.exit(0)
  } catch (error) {
    console.error('\n❌ Test failed:', error)
    client.disconnect()
    process.exit(1)
  }
}

// Run if executed directly
if (require.main === module) {
  main()
}

export { WebSocketTestClient }
```

**Usage:**
```bash
# Install dependencies
npm install socket.io-client

# Run the test
WEBSOCKET_URL=wss://ca-websocket-wc-stg.xxx.azurecontainerapps.io \
JWT_TOKEN=your-jwt-token \
npx ts-node apps/wc-nest-api/scripts/test-websocket-client.ts
```

---

## Docker & Deployment

### File 18: Startup Script for WebSocket Mode

**Path**: `apps/wc-nest-api/scripts/start-websocket.sh`

```bash
#!/bin/bash

# WebSocket Server Startup Script
# This script starts the NestJS application in WebSocket-only mode

set -e

echo "🚀 Starting WebSocket Server..."
echo "================================"

# Check required environment variables
if [ -z "$REDIS_URL" ]; then
  echo "❌ Error: REDIS_URL environment variable is not set"
  exit 1
fi

if [ -z "$DATABASE_URL" ]; then
  echo "❌ Error: DATABASE_URL environment variable is not set"
  exit 1
fi

if [ -z "$JWT_SECRET" ]; then
  echo "❌ Error: JWT_SECRET environment variable is not set"
  exit 1
fi

# Set WebSocket mode
export WEBSOCKET_MODE=true
export WEBSOCKET_PORT=${WEBSOCKET_PORT:-3001}

echo "✅ Environment variables validated"
echo "   - WEBSOCKET_MODE: $WEBSOCKET_MODE"
echo "   - WEBSOCKET_PORT: $WEBSOCKET_PORT"
echo "   - NODE_ENV: ${NODE_ENV:-development}"
echo ""

# Run database migrations (optional)
if [ "$RUN_MIGRATIONS" = "true" ]; then
  echo "🔄 Running database migrations..."
  npx prisma migrate deploy
  echo "✅ Migrations completed"
  echo ""
fi

# Start the application
echo "🚀 Starting application..."
node dist/main.js
```

**Make it executable:**
```bash
chmod +x apps/wc-nest-api/scripts/start-websocket.sh
```

### File 19: Update `project.json` for WebSocket Commands

**Path**: `apps/wc-nest-api/project.json`

Add the following targets to your existing `project.json`:

```json
{
  "targets": {
    "serve-websocket": {
      "executor": "@nx/js:node",
      "options": {
        "buildTarget": "wc-nest-api:build",
        "watch": true,
        "inspect": false,
        "port": 3001,
        "env": {
          "WEBSOCKET_MODE": "true",
          "WEBSOCKET_PORT": "3001"
        }
      }
    },
    "docker-build-websocket": {
      "executor": "nx:run-commands",
      "options": {
        "command": "docker build -t acrwc.azurecr.io/wc-nest-api:latest-websocket -f apps/wc-nest-api/Dockerfile ."
      }
    },
    "docker-push-websocket": {
      "executor": "nx:run-commands",
      "options": {
        "command": "docker push acrwc.azurecr.io/wc-nest-api:latest-websocket"
      }
    },
    "test-websocket-client": {
      "executor": "nx:run-commands",
      "options": {
        "command": "npx ts-node apps/wc-nest-api/scripts/test-websocket-client.ts"
      }
    }
  }
}
```

**Usage:**
```bash
# Serve WebSocket server locally
nx serve-websocket wc-nest-api

# Build Docker image
nx docker-build-websocket wc-nest-api

# Push to Azure Container Registry
nx docker-push-websocket wc-nest-api

# Test WebSocket client
nx test-websocket-client wc-nest-api
```

### File 20: Azure CLI Deployment Script

**Path**: `apps/wc-nest-api/scripts/deploy-websocket-azure.sh`

```bash
#!/bin/bash

# Azure Container Apps WebSocket Deployment Script
# This script builds and deploys the WebSocket server to Azure Container Apps

set -e

# Configuration
RESOURCE_GROUP="rg-wc-staging-ch-north"
CONTAINER_APP_NAME="ca-websocket-wc-stg"
ACR_NAME="acrwc"
IMAGE_NAME="wc-nest-api"
IMAGE_TAG="latest-websocket"

echo "🚀 Azure WebSocket Deployment"
echo "=============================="
echo "Resource Group: $RESOURCE_GROUP"
echo "Container App: $CONTAINER_APP_NAME"
echo "Image: $ACR_NAME.azurecr.io/$IMAGE_NAME:$IMAGE_TAG"
echo ""

# Step 1: Login to Azure
echo "🔐 Logging in to Azure..."
az login --use-device-code

# Step 2: Login to ACR
echo "🔐 Logging in to Azure Container Registry..."
az acr login --name $ACR_NAME

# Step 3: Build Docker image
echo "🏗️  Building Docker image..."
docker build \
  -t $ACR_NAME.azurecr.io/$IMAGE_NAME:$IMAGE_TAG \
  -t $ACR_NAME.azurecr.io/$IMAGE_NAME:$(date +%Y%m%d-%H%M%S)-websocket \
  -f apps/wc-nest-api/Dockerfile \
  .

# Step 4: Push to ACR
echo "📤 Pushing image to ACR..."
docker push $ACR_NAME.azurecr.io/$IMAGE_NAME:$IMAGE_TAG

# Step 5: Update Container App
echo "🔄 Updating Container App..."
az containerapp update \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --image $ACR_NAME.azurecr.io/$IMAGE_NAME:$IMAGE_TAG \
  --revision-suffix $(date +%Y%m%d-%H%M%S)

# Step 6: Get Container App URL
echo "🌐 Getting Container App URL..."
FQDN=$(az containerapp show \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --query properties.configuration.ingress.fqdn \
  --output tsv)

echo ""
echo "✅ Deployment completed successfully!"
echo "======================================"
echo "WebSocket URL: wss://$FQDN/messages"
echo ""
echo "Test the deployment:"
echo "  wscat -c wss://$FQDN/messages"
echo ""
```

**Make it executable:**
```bash
chmod +x apps/wc-nest-api/scripts/deploy-websocket-azure.sh
```

---

## Quick Reference

### Common Commands

```bash
# Local Development
npm install                                    # Install dependencies
nx serve-websocket wc-nest-api                # Run WebSocket server locally
nx test wc-nest-api                           # Run unit tests
nx test-websocket-client wc-nest-api          # Test WebSocket connection

# Docker
docker-compose -f apps/wc-nest-api/docker-compose.websocket.yml up    # Start all services
docker-compose -f apps/wc-nest-api/docker-compose.websocket.yml down  # Stop all services
nx docker-build-websocket wc-nest-api         # Build Docker image
nx docker-push-websocket wc-nest-api          # Push to ACR

# Azure Deployment
./apps/wc-nest-api/scripts/deploy-websocket-azure.sh    # Full deployment
az containerapp logs show --name ca-websocket-wc-stg --resource-group rg-wc-staging-ch-north --tail 50    # View logs

# Testing
wscat -c ws://localhost:3001/messages         # Test local WebSocket
wscat -c wss://ca-websocket-wc-stg.xxx.azurecontainerapps.io/messages    # Test Azure WebSocket
```

### Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | No | `development` | Application environment |
| `WEBSOCKET_MODE` | Yes | `false` | Enable WebSocket-only mode |
| `WEBSOCKET_PORT` | No | `3001` | WebSocket server port |
| `DATABASE_URL` | Yes | - | PostgreSQL connection string |
| `REDIS_URL` | Yes | - | Redis connection string |
| `JWT_SECRET` | Yes | - | JWT signing secret |
| `JWT_EXPIRES_IN` | No | `15m` | JWT expiration time |
| `CORS_ORIGINS` | Yes | - | Comma-separated allowed origins |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | No | - | Azure Application Insights |

### WebSocket Events Reference

#### Client → Server Events

| Event | Payload | Description |
|-------|---------|-------------|
| `authenticate` | `{ token: string }` | Authenticate with JWT token |
| `conversation:join` | `{ conversationId: string }` | Join a conversation room |
| `conversation:leave` | `{ conversationId: string }` | Leave a conversation room |
| `typing:start` | `{ conversationId: string }` | Start typing indicator |
| `typing:stop` | `{ conversationId: string }` | Stop typing indicator |
| `presence:update` | `{ status: 'ONLINE' \| 'AWAY' \| 'OFFLINE' }` | Update presence status |
| `ping` | `{}` | Heartbeat ping |

#### Server → Client Events

| Event | Payload | Description |
|-------|---------|-------------|
| `authenticated` | `{ success: boolean, userId?: string, user?: object, error?: string }` | Authentication result |
| `message:new` | `{ message: object, conversationId: string }` | New message received |
| `message:updated` | `{ message: object, conversationId: string }` | Message updated |
| `message:deleted` | `{ messageId: string, conversationId: string }` | Message deleted |
| `typing:start` | `{ conversationId: string, userId: string, userName: string }` | User started typing |
| `typing:stop` | `{ conversationId: string, userId: string }` | User stopped typing |
| `presence:update` | `{ userId: string, status: string, lastSeenAt: string }` | User presence changed |
| `conversation:joined` | `{ conversationId: string }` | Successfully joined conversation |
| `conversation:left` | `{ conversationId: string }` | Successfully left conversation |
| `pong` | `{ timestamp: number }` | Heartbeat pong response |
| `error` | `{ message: string }` | Error occurred |

### Redis Keys Reference

| Key Pattern | Type | TTL | Description |
|-------------|------|-----|-------------|
| `presence:{userId}` | String | 300s | User presence status |
| `typing:{conversationId}:{userId}` | String | 5s | Typing indicator |

### Redis Pub/Sub Channels

| Channel | Events | Description |
|---------|--------|-------------|
| `messages:new` | New messages | Broadcast new messages |
| `messages:updated` | Updated messages | Broadcast message updates |
| `messages:deleted` | Deleted messages | Broadcast message deletions |
| `typing:events` | Typing indicators | Broadcast typing events |
| `presence:updates` | Presence changes | Broadcast presence updates |

---

## Example Usage

### Example 1: Browser WebSocket Client

```typescript
// Frontend: Connect to WebSocket server
import { io } from 'socket.io-client'

const socket = io('wss://ca-websocket-wc-stg.xxx.azurecontainerapps.io/messages', {
  transports: ['websocket', 'polling'],
  auth: {
    token: localStorage.getItem('accessToken'),
  },
})

// Listen for connection
socket.on('connect', () => {
  console.log('Connected to WebSocket server')

  // Authenticate
  socket.emit('authenticate', {
    token: localStorage.getItem('accessToken'),
  })
})

// Listen for authentication result
socket.on('authenticated', (data) => {
  if (data.success) {
    console.log('Authenticated as:', data.user)

    // Join a conversation
    socket.emit('conversation:join', {
      conversationId: 'conv-123',
    })
  } else {
    console.error('Authentication failed:', data.error)
  }
})

// Listen for new messages
socket.on('message:new', (data) => {
  console.log('New message:', data.message)
  // Update UI with new message
})

// Listen for typing indicators
socket.on('typing:start', (data) => {
  console.log(`${data.userName} is typing...`)
  // Show typing indicator in UI
})

socket.on('typing:stop', (data) => {
  console.log('User stopped typing')
  // Hide typing indicator in UI
})

// Send typing indicator
const handleTyping = () => {
  socket.emit('typing:start', { conversationId: 'conv-123' })

  // Auto-stop after 3 seconds
  setTimeout(() => {
    socket.emit('typing:stop', { conversationId: 'conv-123' })
  }, 3000)
}
```

### Example 2: Testing with wscat

```bash
# Connect to WebSocket server
wscat -c wss://ca-websocket-wc-stg.xxx.azurecontainerapps.io/messages

# After connection, send authentication
> {"event":"authenticate","data":{"token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."}}

# Expected response:
< {"event":"authenticated","data":{"success":true,"userId":"user-123","user":{...}}}

# Join a conversation
> {"event":"conversation:join","data":{"conversationId":"conv-456"}}

# Expected response:
< {"event":"conversation:joined","data":{"conversationId":"conv-456"}}

# Start typing
> {"event":"typing:start","data":{"conversationId":"conv-456"}}

# Stop typing
> {"event":"typing:stop","data":{"conversationId":"conv-456"}}

# Send ping
> {"event":"ping","data":{}}

# Expected response:
< {"event":"pong","data":{"timestamp":1706198400000}}
```

### Example 3: Successful Deployment Logs

```
🚀 Starting WebSocket Server...
================================
✅ Environment variables validated
   - WEBSOCKET_MODE: true
   - WEBSOCKET_PORT: 3001
   - NODE_ENV: staging

🚀 Starting application...
[Nest] 1  - 01/25/2026, 10:30:00 AM     LOG [NestFactory] Starting Nest application...
[Nest] 1  - 01/25/2026, 10:30:00 AM     LOG [InstanceLoader] AppModule dependencies initialized
[Nest] 1  - 01/25/2026, 10:30:00 AM     LOG [InstanceLoader] MessagingModule dependencies initialized
[Nest] 1  - 01/25/2026, 10:30:01 AM     LOG [RedisPubSubService] Connecting to Redis: redis-wc-messaging-stg.redis.cache.windows.net:6380
[Nest] 1  - 01/25/2026, 10:30:01 AM     LOG [RedisPubSubService] Redis publisher connected
[Nest] 1  - 01/25/2026, 10:30:01 AM     LOG [RedisPubSubService] Redis subscriber connected
[Nest] 1  - 01/25/2026, 10:30:02 AM     LOG [MessagingGateway] WebSocket Gateway initialized with Redis adapter
[Nest] 1  - 01/25/2026, 10:30:02 AM     LOG [NestApplication] Nest application successfully started
Application is running on: http://[::]:3001
Mode: WebSocket Only
```

---

## Summary

This document provides complete code implementation for the WebSocket server including:

✅ **Core Services** (4 files):
- Redis pub/sub for multi-replica coordination
- Presence tracking with TTL
- Typing indicators with auto-expiry
- Room management for conversations

✅ **WebSocket Gateway** (1 file):
- Socket.io integration with Redis adapter
- Authentication handling
- Event handlers for all WebSocket events
- CORS configuration

✅ **Authentication** (2 files):
- JWT guard for WebSocket connections
- User decorator for extracting user data

✅ **DTOs** (3 files):
- Type-safe event payloads
- Validation decorators

✅ **Configuration** (5 files):
- Environment variables
- Docker configuration
- Docker Compose for local testing
- Main.ts updates for WebSocket mode
- Project.json nx commands

✅ **Testing** (3 files):
- Unit tests for gateway
- Integration tests for Redis pub/sub
- WebSocket client test script

✅ **Deployment** (2 files):
- Startup script for WebSocket mode
- Azure CLI deployment script

✅ **Documentation**:
- Quick reference for commands
- Environment variables table
- WebSocket events reference
- Redis keys and channels
- Example usage in browser and CLI

**Next Steps:**
1. Create the files in your codebase following this guide
2. Follow the deployment steps in `WEBSOCKET_IMPLEMENTATION_PLAN.md`
3. Test locally using Docker Compose
4. Deploy to Azure Container Apps staging environment
5. Integrate with frontend applications

For detailed deployment instructions, see `WEBSOCKET_IMPLEMENTATION_PLAN.md`.

