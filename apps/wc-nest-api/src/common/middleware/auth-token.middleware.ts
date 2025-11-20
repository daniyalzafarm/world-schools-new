import { Injectable, NestMiddleware } from '@nestjs/common'
import { NextFunction, Request, Response } from 'express'
import { ConfigService } from '../../config/config.service'

@Injectable()
export class AuthTokenMiddleware implements NestMiddleware {
  constructor(private readonly configService: ConfigService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const authUsingRequest = this.configService.jwtConfig.authUsingRequest
    if (authUsingRequest) {
      // Convert request headers to app-specific cookies for JWT strategy
      // Determine which app based on the request path
      const isSuperadmin = req.path.startsWith('/superadmin')
      const isProvider = req.path.startsWith('/provider')
      const isUser = req.path.startsWith('/user')

      if (req.headers['x-access-token']) {
        if (!req.cookies) req.cookies = {}
        // Set app-specific cookie name based on endpoint
        if (isSuperadmin) {
          req.cookies['wc_superadmin_access_token'] = req.headers['x-access-token'] as string
        } else if (isProvider) {
          req.cookies['wc_provider_access_token'] = req.headers['x-access-token'] as string
        } else if (isUser) {
          req.cookies['wc_user_access_token'] = req.headers['x-access-token'] as string
        } else {
          req.cookies['access_token'] = req.headers['x-access-token'] as string
        }
      }
      if (req.headers['x-refresh-token']) {
        if (!req.cookies) req.cookies = {}
        // Set app-specific cookie name based on endpoint
        if (isSuperadmin) {
          req.cookies['wc_superadmin_refresh_token'] = req.headers['x-refresh-token'] as string
        } else if (isProvider) {
          req.cookies['wc_provider_refresh_token'] = req.headers['x-refresh-token'] as string
        } else if (isUser) {
          req.cookies['wc_user_refresh_token'] = req.headers['x-refresh-token'] as string
        } else {
          req.cookies['refresh_token'] = req.headers['x-refresh-token'] as string
        }
      }
    }
    next()
  }
}
