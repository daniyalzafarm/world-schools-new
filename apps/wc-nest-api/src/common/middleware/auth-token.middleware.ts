import { Injectable, NestMiddleware } from '@nestjs/common'
import { NextFunction, Request, Response } from 'express'
import { ConfigService } from '../../config/config.service'

@Injectable()
export class AuthTokenMiddleware implements NestMiddleware {
  constructor(private readonly configService: ConfigService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const authUsingRequest = this.configService.jwtConfig.authUsingRequest
    if (authUsingRequest) {
      // Convert request headers to cookies for JWT strategy
      if (req.headers['x-access-token']) {
        if (!req.cookies) req.cookies = {}
        req.cookies['access_token'] = req.headers['x-access-token'] as string
      }
      if (req.headers['x-refresh-token']) {
        if (!req.cookies) req.cookies = {}
        req.cookies['refresh_token'] = req.headers['x-refresh-token'] as string
      }
    }
    next()
  }
}
