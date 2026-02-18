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
import { AuthTokenMiddleware } from './common/middleware/auth-token.middleware'

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule)
  const configService = app.get(ConfigService)

  // Configure trust proxy for accurate IP address capture
  const trustProxyConfig = configService.trustProxyConfig
  app.set('trust proxy', trustProxyConfig)

  // Enable cookie parsing
  app.use(cookieParser())

  // Register AuthTokenMiddleware globally (after cookieParser)
  const authTokenMiddleware = app.get(AuthTokenMiddleware)
  app.use(authTokenMiddleware.use.bind(authTokenMiddleware))

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

  // Enable CORS with environment-based origin whitelist
  app.enableCors({
    origin: configService.corsOrigins, // Use environment-based origin whitelist
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'x-access-token',
      'x-refresh-token',
    ],
    credentials: true,
    exposedHeaders: ['x-access-token', 'x-refresh-token'],
  })

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
