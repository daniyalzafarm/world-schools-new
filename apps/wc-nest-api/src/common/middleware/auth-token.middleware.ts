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
        const token = req.headers['x-access-token'] as string
        // Set app-specific cookie name based on endpoint path only
        if (isSuperadmin) {
          req.cookies['wc_superadmin_access_token'] = token
        } else if (isProvider) {
          req.cookies['wc_provider_access_token'] = token
        } else if (isUser) {
          req.cookies['wc_user_access_token'] = token
        } else {
          // Shared routes (messaging, notifications, etc.): inject into all three slots.
          // The JWT strategy will accept whichever matches the token's app claim.
          req.cookies['wc_user_access_token'] = token
          req.cookies['wc_provider_access_token'] = token
          req.cookies['wc_superadmin_access_token'] = token
        }
      }
      if (req.headers['x-refresh-token']) {
        if (!req.cookies) req.cookies = {}
        const token = req.headers['x-refresh-token'] as string
        if (isSuperadmin) {
          req.cookies['wc_superadmin_refresh_token'] = token
        } else if (isProvider) {
          req.cookies['wc_provider_refresh_token'] = token
        } else if (isUser) {
          req.cookies['wc_user_refresh_token'] = token
        } else {
          req.cookies['wc_user_refresh_token'] = token
          req.cookies['wc_provider_refresh_token'] = token
          req.cookies['wc_superadmin_refresh_token'] = token
        }
      }
    }
    next()
  }
}
