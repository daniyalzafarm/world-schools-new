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
          return request?.cookies?.accessToken // From HTTP-only cookie
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.jwtConfig.secret,
    })
  }

  async validate(payload: JwtPayload) {
    const user = await this.authService.validateUser(payload.sub)

    if (!user) {
      throw new UnauthorizedException('Invalid token')
    }

    return user
  }
}
