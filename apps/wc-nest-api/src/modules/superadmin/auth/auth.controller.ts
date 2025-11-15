import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UnauthorizedException,
} from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { Response } from 'express'
import { AuthService } from '../../core/auth/auth.service'
import { Public } from '../../core/auth/decorators/public.decorator'
import { SuperAdminLoginDto } from './dto/login.dto'
import { ResponseUtil } from '../../../common/utils/response.util'
import { ConfigService } from '../../../config/config.service'

@ApiTags('SuperAdmin Auth')
@Controller('superadmin/auth')
export class SuperAdminAuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Super admin login',
    description:
      'Authenticate super admin user and return JWT tokens. Only users with Super Admin role can login.',
  })
  async login(
    @Body() loginDto: SuperAdminLoginDto,
    @Res({ passthrough: true }) response: Response
  ) {
    // Validate credentials using central AuthService
    const result = await this.authService.login(loginDto)

    // Verify user has Super Admin role
    const user = result.data.user
    const hasSuperAdminRole = user.roles?.some(role => role.name === 'Super Admin')

    if (!hasSuperAdminRole) {
      throw new UnauthorizedException('Access denied. Super Admin role required.')
    }

    // Set HTTP-only cookies for tokens
    const accessTokenExpiry = this.configService.getJwtExpiresIn()
    const refreshTokenExpiry = this.configService.getJwtRefreshExpiresIn()

    response.cookie('access_token', result.data.access_token, {
      httpOnly: true,
      secure: this.configService.getNodeEnv() === 'production',
      sameSite: 'strict',
      maxAge: this.parseDuration(accessTokenExpiry),
    })

    response.cookie('refresh_token', result.data.refresh_token, {
      httpOnly: true,
      secure: this.configService.getNodeEnv() === 'production',
      sameSite: 'strict',
      maxAge: this.parseDuration(refreshTokenExpiry),
    })

    return ResponseUtil.success(result.data, 'Super admin login successful')
  }

  private parseDuration(duration: string): number {
    const match = duration.match(/^(\d+)([smhd])$/)
    if (!match) return 900000 // Default 15 minutes

    const value = parseInt(match[1], 10)
    const unit = match[2]

    const multipliers = {
      s: 1000,
      m: 60000,
      h: 3600000,
      d: 86400000,
    }

    return value * multipliers[unit]
  }
}
