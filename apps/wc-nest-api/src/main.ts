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
            imgSrc: ["'self'", 'data:', 'https:', 'http://localhost:3000'],
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

  // Enable CORS
  app.enableCors({
    origin: true, // Allow all origins in development
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

  const config = new DocumentBuilder()
    .setTitle('World Schools API')
    .setDescription('The World Schools API documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .build()

  const document = SwaggerModule.createDocument(app, config)
  SwaggerModule.setup('docs', app, document)

  await app.listen(configService.port)

  console.table({ Docs: `http://localhost:${configService.port}/docs` })
}
void bootstrap()
