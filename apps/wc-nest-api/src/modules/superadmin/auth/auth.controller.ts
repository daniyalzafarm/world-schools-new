import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Res,
  UnauthorizedException,
} from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { Response } from 'express'
import { parseDuration } from '@world-schools/wc-utils'
import { AuthService } from '../../core/auth/auth.service'
import { Public } from '../../core/auth/decorators/public.decorator'
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator'
import { SuperAdminLoginDto } from './dto/login.dto'
import { ResponseUtil } from '../../../common/utils/response.util'
import { ConfigService } from '../../../config/config.service'
import { ChangePasswordDto, RefreshTokenDto } from '../../core/auth/dto/auth.dto'

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
    const authResult = await this.authService.login(loginDto)

    // Verify user has Super Admin role
    const user = authResult.user
    const hasSuperAdminRole = user.roles?.some(role => role.name === 'Super Admin')

    if (!hasSuperAdminRole) {
      throw new BadRequestException('Access denied. Super Admin role required.')
    }

    // Set HTTP-only cookies for tokens
    const accessTokenExpiry = this.configService.getJwtExpiresIn()
    const refreshTokenExpiry = this.configService.getJwtRefreshExpiresIn()

    response.cookie('access_token', authResult.accessToken, {
      httpOnly: true,
      secure: this.configService.getNodeEnv() === 'production',
      sameSite: 'strict',
      maxAge: parseDuration(accessTokenExpiry),
    })

    response.cookie('refresh_token', authResult.refreshToken, {
      httpOnly: true,
      secure: this.configService.getNodeEnv() === 'production',
      sameSite: 'strict',
      maxAge: parseDuration(refreshTokenExpiry),
    })

    // If authUsingRequest is enabled, also send tokens in headers
    if (this.configService.jwtConfig.authUsingRequest) {
      response.setHeader('x-access-token', authResult.accessToken)
      response.setHeader('x-refresh-token', authResult.refreshToken)
    }

    return ResponseUtil.success({ user: authResult.user })
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh access token',
    description: 'Get new access and refresh tokens using a valid refresh token',
  })
  async refreshToken(
    @Body() refreshTokenDto: RefreshTokenDto,
    @Res({ passthrough: true }) response: Response
  ) {
    // Try to get refresh token from cookie first, then from body
    const refreshToken: string =
      (response as any).req?.cookies?.refresh_token ?? refreshTokenDto?.refreshToken

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not provided')
    }

    const result = await this.authService.refreshToken(refreshToken)

    // Verify user still has Super Admin role
    const user = result.user
    const hasSuperAdminRole = user.roles?.some(role => role.name === 'Super Admin')

    if (!hasSuperAdminRole) {
      throw new UnauthorizedException('Access denied. Super Admin role required.')
    }

    // Set new HTTP-only cookies
    const accessTokenExpiry = this.configService.getJwtExpiresIn()
    const refreshTokenExpiry = this.configService.getJwtRefreshExpiresIn()

    response.cookie('access_token', result.accessToken, {
      httpOnly: true,
      secure: this.configService.getNodeEnv() === 'production',
      sameSite: 'strict',
      maxAge: parseDuration(accessTokenExpiry),
    })

    response.cookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: this.configService.getNodeEnv() === 'production',
      sameSite: 'strict',
      maxAge: parseDuration(refreshTokenExpiry),
    })

    // If authUsingRequest is enabled, also send tokens in headers
    if (this.configService.jwtConfig.authUsingRequest) {
      response.setHeader('x-access-token', result.accessToken)
      response.setHeader('x-refresh-token', result.refreshToken)
    }

    return ResponseUtil.success({ user: result.user, expiresIn: result.expiresIn })
  }

  @Get('profile')
  @ApiOperation({
    summary: 'Get current user profile',
    description: 'Get the profile of the currently authenticated super admin user',
  })
  getProfile(@CurrentUser() user: any) {
    // Verify user has Super Admin role
    const hasSuperAdminRole = user.roles?.some((role: any) => role.name === 'Super Admin')

    if (!hasSuperAdminRole) {
      throw new UnauthorizedException('Access denied. Super Admin role required.')
    }

    return ResponseUtil.success(user)
  }

  @Patch('change-password')
  @ApiOperation({
    summary: 'Change password',
    description: 'Change the password for the currently authenticated super admin user',
  })
  async changePassword(@CurrentUser() user: any, @Body() changePasswordDto: ChangePasswordDto) {
    // Verify user has Super Admin role
    const hasSuperAdminRole = user.roles?.some((role: any) => role.name === 'Super Admin')

    if (!hasSuperAdminRole) {
      throw new UnauthorizedException('Access denied. Super Admin role required.')
    }

    await this.authService.changePassword(user.id, changePasswordDto)

    return ResponseUtil.success(null)
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Logout',
    description: 'Clear authentication cookies and logout the super admin user',
  })
  logout(@Res({ passthrough: true }) response: Response) {
    // Clear cookies
    response.clearCookie('access_token')
    response.clearCookie('refresh_token')

    return ResponseUtil.success(null)
  }
}
