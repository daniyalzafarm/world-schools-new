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
          // All endpoints are now app-specific (e.g., /user/*, /provider/*, /superadmin/*)
          const isSuperadmin = request.path.startsWith('/superadmin')
          const isProvider = request.path.startsWith('/provider')
          const isUser = request.path.startsWith('/user')

          // For app-specific endpoints, only extract token from the correct app-specific cookie
          if (isSuperadmin) {
            return request?.cookies?.wc_superadmin_access_token
          } else if (isProvider) {
            return request?.cookies?.wc_provider_access_token
          } else if (isUser) {
            return request?.cookies?.wc_user_access_token
          }

          // No cookie for non-app-prefixed paths; rely on Authorization: Bearer if used
          return false
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
    // All endpoints are now app-specific, so we always validate the app claim
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

    // For impersonated sessions, override the user's permissions with the Provider Admin
    // system role permissions for the given provider. This ensures the superadmin always has
    // full provider app access regardless of the provider owner's current role configuration.
    if (payload.impersonatedBy && payload.impersonationProviderId) {
      const adminPermissions = await this.authService.getProviderAdminPermissions(
        payload.impersonationProviderId
      )
      return {
        ...user,
        permissions: adminPermissions.length > 0 ? adminPermissions : (user.permissions ?? []),
        sessionId: payload.sessionId,
        impersonatedBy: payload.impersonatedBy,
      }
    }

    return { ...user, sessionId: payload.sessionId }
  }
}
