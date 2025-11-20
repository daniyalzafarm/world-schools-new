import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { Request } from 'express'
import { AuthService } from '../auth.service'
import { ConfigService } from '../../../../config/config.service'
import { JwtPayload } from '../dto/auth.dto'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private authService: AuthService,
    private configService: ConfigService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(), // From Authorization header
        (request: Request) => {
          // Determine which app based on request path
          const isSuperadmin = request.path.startsWith('/superadmin')
          const isProvider = request.path.startsWith('/provider')
          const isUser = request.path.startsWith('/user')

          // Only extract token from the correct app-specific cookie
          if (isSuperadmin) {
            return request?.cookies?.wc_superadmin_access_token
          } else if (isProvider) {
            return request?.cookies?.wc_provider_access_token
          } else if (isUser) {
            return request?.cookies?.wc_user_access_token
          }

          // Fall back to generic cookie for backward compatibility
          return request?.cookies?.access_token
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.jwtConfig.secret,
      passReqToCallback: true, // Pass request to validate method
    })
  }

  async validate(request: Request, payload: JwtPayload) {
    // Determine which app the request is for
    const isSuperadmin = request.path.startsWith('/superadmin')
    const isProvider = request.path.startsWith('/provider')
    const isUser = request.path.startsWith('/user')

    // Validate app-specific claim if present
    if (payload.app) {
      if (isSuperadmin && payload.app !== 'superadmin') {
        throw new UnauthorizedException(
          'Invalid token: This token is not valid for superadmin endpoints'
        )
      }
      if (isProvider && payload.app !== 'provider') {
        throw new UnauthorizedException(
          'Invalid token: This token is not valid for provider endpoints'
        )
      }
      if (isUser && payload.app !== 'user') {
        throw new UnauthorizedException('Invalid token: This token is not valid for user endpoints')
      }
    }

    const user = await this.authService.validateUser(payload.sub)

    if (!user) {
      throw new UnauthorizedException('Invalid token')
    }

    return user
  }
}
