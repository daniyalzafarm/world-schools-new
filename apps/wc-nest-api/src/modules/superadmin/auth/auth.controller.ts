import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { Request, Response } from 'express'
import { parseDuration } from '@world-schools/wc-utils'
import { AuthService } from '../../core/auth/auth.service'
import { Public } from '../../core/auth/decorators/public.decorator'
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator'
import { SuperAdminLoginDto } from './dto/login.dto'
import { ResponseUtil } from '../../../common/utils/response.util'
import { ConfigService } from '../../../config/config.service'
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  RefreshTokenDto,
  ResetPasswordDto,
} from '../../core/auth/dto/auth.dto'
import { PasswordResetService } from '../../core/auth/services/password-reset.service'

@ApiTags('SuperAdmin Auth')
@Controller('superadmin/auth')
export class SuperAdminAuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly passwordResetService: PasswordResetService
  ) {}

  /**
   * Helper function to check if a user has any superadmin-context role.
   * Superadmin roles are identified by having providerId = null.
   * This allows both system roles (like "Super Admin") and custom superadmin roles to authenticate.
   */
  private hasSuperAdminRole(user: any): boolean {
    return user.roles?.some((role: any) => role.providerId === null) ?? false
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Super admin login',
    description:
      'Authenticate super admin user and return JWT tokens. Only users with superadmin-context roles can login.',
  })
  async login(
    @Body() loginDto: SuperAdminLoginDto,
    @Res({ passthrough: true }) response: Response
  ) {
    // Validate credentials using central AuthService
    const authResult = await this.authService.login(loginDto)

    // Verify user has at least one superadmin-context role (providerId = null)
    const user = authResult.user
    if (!this.hasSuperAdminRole(user)) {
      // Return generic error to prevent role enumeration
      throw new BadRequestException('Invalid credentials')
    }

    // Generate app-specific tokens with 'superadmin' claim for token isolation
    const appTokens = this.authService.generateAppSpecificTokens(user, 'superadmin')

    // Set HTTP-only cookies for tokens with app-specific names
    const accessTokenExpiry = this.configService.getJwtExpiresIn()
    const refreshTokenExpiry = this.configService.getJwtRefreshExpiresIn()

    response.cookie('wc_superadmin_access_token', appTokens.accessToken, {
      httpOnly: true,
      secure: this.configService.getNodeEnv() === 'production',
      sameSite: 'strict',
      maxAge: parseDuration(accessTokenExpiry),
    })

    response.cookie('wc_superadmin_refresh_token', appTokens.refreshToken, {
      httpOnly: true,
      secure: this.configService.getNodeEnv() === 'production',
      sameSite: 'strict',
      maxAge: parseDuration(refreshTokenExpiry),
    })

    // If authUsingRequest is enabled, also send tokens in headers
    if (this.configService.jwtConfig.authUsingRequest) {
      response.setHeader('x-access-token', appTokens.accessToken)
      response.setHeader('x-refresh-token', appTokens.refreshToken)
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
    @Req() request: Request,
    @Body() refreshTokenDto: RefreshTokenDto,
    @Res({ passthrough: true }) response: Response
  ) {
    // Try to get refresh token from cookie first (app-specific name), then from body
    const refreshToken: string =
      request.cookies?.wc_superadmin_refresh_token ?? refreshTokenDto?.refreshToken

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not provided')
    }

    const result = await this.authService.refreshToken(refreshToken)

    // Verify user still has at least one superadmin-context role (providerId = null)
    const user = result.user
    if (!this.hasSuperAdminRole(user)) {
      throw new UnauthorizedException('Access denied. Superadmin role required.')
    }

    // Generate app-specific tokens with 'superadmin' claim for token isolation
    const appTokens = this.authService.generateAppSpecificTokens(user, 'superadmin')

    // Set new HTTP-only cookies with app-specific names
    const accessTokenExpiry = this.configService.getJwtExpiresIn()
    const refreshTokenExpiry = this.configService.getJwtRefreshExpiresIn()

    response.cookie('wc_superadmin_access_token', appTokens.accessToken, {
      httpOnly: true,
      secure: this.configService.getNodeEnv() === 'production',
      sameSite: 'strict',
      maxAge: parseDuration(accessTokenExpiry),
    })

    response.cookie('wc_superadmin_refresh_token', appTokens.refreshToken, {
      httpOnly: true,
      secure: this.configService.getNodeEnv() === 'production',
      sameSite: 'strict',
      maxAge: parseDuration(refreshTokenExpiry),
    })

    // If authUsingRequest is enabled, also send tokens in headers
    if (this.configService.jwtConfig.authUsingRequest) {
      response.setHeader('x-access-token', appTokens.accessToken)
      response.setHeader('x-refresh-token', appTokens.refreshToken)
    }

    return ResponseUtil.success({ user: result.user, expiresIn: appTokens.expiresIn })
  }

  @Get('profile')
  @ApiOperation({
    summary: 'Get current user profile',
    description: 'Get the profile of the currently authenticated super admin user',
  })
  getProfile(@CurrentUser() user: any) {
    // Verify user has at least one superadmin-context role (providerId = null)
    if (!this.hasSuperAdminRole(user)) {
      throw new UnauthorizedException('Access denied. Superadmin role required.')
    }

    return ResponseUtil.success(user)
  }

  @Patch('change-password')
  @ApiOperation({
    summary: 'Change password',
    description: 'Change the password for the currently authenticated super admin user',
  })
  async changePassword(@CurrentUser() user: any, @Body() changePasswordDto: ChangePasswordDto) {
    // Verify user has at least one superadmin-context role (providerId = null)
    if (!this.hasSuperAdminRole(user)) {
      throw new UnauthorizedException('Access denied. Superadmin role required.')
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
    // Clear app-specific cookies
    response.clearCookie('wc_superadmin_access_token')
    response.clearCookie('wc_superadmin_refresh_token')

    return ResponseUtil.success(null)
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request password reset',
    description:
      'Send password reset email to the user. Returns success regardless of whether email exists for security.',
  })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    await this.passwordResetService.createPasswordResetToken(forgotPasswordDto.email, 'superadmin')

    return ResponseUtil.success({
      message: 'If your email is registered, you will receive a password reset link shortly.',
    })
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset password',
    description: 'Reset password using the token received via email',
  })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    await this.passwordResetService.resetPassword(
      resetPasswordDto.token,
      resetPasswordDto.newPassword,
      'superadmin'
    )

    return ResponseUtil.success({
      message: 'Password reset successful. You can now login with your new password.',
    })
  }
}
