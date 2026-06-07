import { Module } from '@nestjs/common'
import { ResponseInterceptor } from './interceptors/response.interceptor'
import { HttpExceptionFilter } from './filters/http-exception.filter'
import { ConfigModule } from '../config/config.module'
import { AuthTokenMiddleware } from './middleware/auth-token.middleware'
import { FrontDoorMiddleware } from './middleware/front-door.middleware'

@Module({
  imports: [ConfigModule],
  providers: [ResponseInterceptor, HttpExceptionFilter, AuthTokenMiddleware, FrontDoorMiddleware],
  exports: [ResponseInterceptor, HttpExceptionFilter, AuthTokenMiddleware, FrontDoorMiddleware],
})
export class CommonModule {}
