import { NestFactory } from '@nestjs/core'
import { AppModule } from './app/app.module'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { ConfigService } from './config/config.service'
import { HttpExceptionFilter, ResponseInterceptor } from './common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { ValidationPipe } from '@nestjs/common'
import { join } from 'path'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import crypto from 'crypto'
import type { NextFunction, Request, Response } from 'express'
import { AuthTokenMiddleware } from './common/middleware/auth-token.middleware'

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule)
  const configService = app.get(ConfigService)

  // Prevent header-based auth from running in production — it is development-only
  if (configService.jwtConfig.authUsingRequest && configService.isProduction) {
    throw new Error(
      'AUTH_USING_REQUEST must not be enabled in production. ' +
        'Use cookie-based auth with proper domain configuration instead.'
    )
  }

  // Configure trust proxy for accurate IP address capture
  const trustProxyConfig = configService.trustProxyConfig
  app.set('trust proxy', trustProxyConfig)

  // Enable CORS before all other middleware so that the Access-Control-* headers
  // (including Access-Control-Expose-Headers) are added to EVERY response, including
  // 4xx responses emitted by middleware below (e.g. the CSRF 403). Without this,
  // cross-origin JS cannot read custom headers like X-CSRF-Token from error responses.
  app.enableCors({
    origin: configService.corsOrigins, // Use environment-based origin whitelist
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'x-access-token',
      'x-refresh-token',
      'x-csrf-token',
    ],
    credentials: true,
    exposedHeaders: ['x-access-token', 'x-refresh-token', 'x-csrf-token'],
  })

  // Enable cookie parsing
  app.use(cookieParser())

  // Register AuthTokenMiddleware globally (after cookieParser)
  const authTokenMiddleware = app.get(AuthTokenMiddleware)
  app.use(authTokenMiddleware.use.bind(authTokenMiddleware))

  // CSRF protection using the stateless double-submit cookie pattern.
  // - A random token is set in a non-httpOnly cookie on every safe (GET/HEAD/OPTIONS) request.
  // - Mutating requests must echo that cookie value back in the X-CSRF-Token header.
  // - Skipped entirely in AUTH_USING_REQUEST mode (localStorage-based token auth is not
  //   CSRF-vulnerable because cookies are not sent automatically by the browser).
  if (!configService.jwtConfig.authUsingRequest) {
    const CSRF_COOKIE = 'csrf-token'
    const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])
    const isProduction = configService.isProduction

    app.use((req: Request, res: Response, next: NextFunction) => {
      // Socket.io transport requests (/socket.io/...) are not CSRF-vulnerable:
      // WebSocket upgrades are protected by the Origin header, and the Socket.io
      // gateway authenticates via its own JWT handshake. Skip CSRF for these paths
      // so that the HTTP long-polling fallback transport is not broken.
      if (req.path.startsWith('/socket.io')) {
        return next()
      }

      if (SAFE_METHODS.has(req.method)) {
        // Refresh the CSRF cookie if absent (first visit or after cookie expiry)
        let token = req.cookies[CSRF_COOKIE]
        if (!token) {
          token = crypto.randomBytes(32).toString('hex')
          res.cookie(CSRF_COOKIE, token, {
            httpOnly: false, // Must be readable by JS so the client can echo it as a header
            secure: isProduction,
            sameSite: isProduction ? 'none' : 'lax',
            path: '/',
            maxAge: 24 * 60 * 60 * 1000, // 24 h — prevents 403 on first POST after browser reopen
          })
        }
        // Expose the token via response header so cross-origin JS can read it.
        // document.cookie only sees cookies for the current page origin, so the
        // cookie set on the API domain is invisible to frontend JS on a different domain.
        res.setHeader('X-CSRF-Token', token)
        return next()
      }

      // For mutating requests validate that header == cookie (double-submit)
      const cookieToken = req.cookies[CSRF_COOKIE]
      const headerToken = req.headers['x-csrf-token'] as string | undefined

      if (!cookieToken || !headerToken || cookieToken !== headerToken) {
        // Echo the cookie token back as a header on the 403 so the frontend can
        // recover without an extra round-trip: the error interceptor reads it,
        // stores it in memory, and retries the request automatically.
        // CORS headers are already present (registered first), so cross-origin
        // JS is allowed to read this header.
        if (cookieToken) {
          res.setHeader('X-CSRF-Token', cookieToken)
        }
        res.status(403).json({
          success: false,
          message: 'Invalid or missing CSRF token',
          statusCode: 403,
        })
        return
      }

      next()
    })
  }

  // Apply security headers with Helmet (if enabled)
  if (configService.isHelmetEnabled) {
    app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
            fontSrc: ["'self'", 'https://fonts.gstatic.com'],
            // Only allow localhost in development
            imgSrc: configService.isProduction
              ? ["'self'", 'data:', 'https:']
              : ["'self'", 'data:', 'https:', 'http://localhost:3000'],
            scriptSrc: ["'self'"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: [],
          },
        },
        crossOriginEmbedderPolicy: false,
        crossOriginResourcePolicy: { policy: 'cross-origin' },
      })
    )
  }

  // Enable validation with transformation
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    })
  )

  // Apply global response interceptor and exception filter
  app.useGlobalInterceptors(new ResponseInterceptor())
  app.useGlobalFilters(new HttpExceptionFilter())

  // Configure Swagger/OpenAPI documentation
  const config = new DocumentBuilder()
    .setTitle('World Schools API')
    .setDescription(
      `
# World Schools API Documentation

Complete API documentation for the World Schools platform, including:

## Features
- **Authentication & Authorization**: JWT-based authentication with role and permission-based access control
- **Real-time Messaging**: Comprehensive messaging system with conversations, messages, attachments, and search
- **Provider Management**: Camp management, bookings, and provider operations
- **User Management**: User profiles, roles, and permissions
- **Superadmin**: Administrative operations and system management

## Authentication
All endpoints (except those marked as public) require JWT authentication via Bearer token.

**How to authenticate:**
1. Click the "Authorize" button (🔓) at the top right
2. Enter your JWT token in the format: \`Bearer <your-token>\`
3. Click "Authorize"

Alternatively, include the token in the Authorization header:
\`\`\`
Authorization: Bearer <your-token>
\`\`\`

## Rate Limiting
Message sending endpoints are rate-limited to prevent spam:
- **Limit**: 60 messages per minute per user
- **Response**: HTTP 429 (Too Many Requests) when exceeded

## Response Format
All API responses follow a consistent format:

**Success Response:**
\`\`\`json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... }
}
\`\`\`

**Error Response:**
\`\`\`json
{
  "success": false,
  "message": "Error description",
  "error": "ErrorType",
  "statusCode": 400
}
\`\`\`

## Support
For API support, contact the development team.
      `
    )
    .setVersion('1.0.0')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      name: 'Authorization',
      description: 'Enter your JWT token (without "Bearer" prefix)',
      in: 'header',
    })
    .addTag('Authentication', 'User authentication and authorization endpoints')
    .addTag(
      'Conversations',
      'Conversation management - create, list, update, and manage conversations'
    )
    .addTag(
      'Messages',
      'Message operations - send, edit, delete, reactions, bookmarks, pins, and more'
    )
    .addTag('Attachments', 'File upload and management for message attachments')
    .addTag('Search', 'Full-text search for messages and conversations')
    .addTag('Provider', 'Provider-specific operations and camp management')
    .addTag('Superadmin', 'Administrative operations and system management')
    .addTag('Users', 'User management and profile operations')
    .build()

  const document = SwaggerModule.createDocument(app, config, {
    operationIdFactory: (controllerKey: string, methodKey: string) => methodKey,
  })

  SwaggerModule.setup('docs', app, document, {
    customSiteTitle: 'World Schools API Documentation',
    customfavIcon: 'https://worldschools.com/favicon.ico',
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info { margin: 50px 0 }
      .swagger-ui .info .title { font-size: 36px }
    `,
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
      docExpansion: 'none',
      defaultModelsExpandDepth: 3,
      defaultModelExpandDepth: 3,
    },
  })

  await app.listen(configService.port)

  console.table({ Docs: `http://localhost:${configService.port}/docs` })
}
void bootstrap()
