import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { Request, Response } from 'express'
import { parseDuration } from '@world-schools/wc-utils'
import { AuthService } from '../../core/auth/auth.service'
import { PrismaService } from '../../../prisma/prisma.service'
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
import { UpdateProfileDto } from '../../user/auth/dto/update-profile.dto'
import { PasswordResetService } from '../../core/auth/services/password-reset.service'
import { ProfilePhotoService } from '../../user/auth/services/profile-photo.service'
import { TwoFactorAuthService } from './services/two-factor-auth.service'
import { SessionManagementService } from './services/session-management.service'

@ApiTags('SuperAdmin Auth')
@Controller('superadmin/auth')
export class SuperAdminAuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly passwordResetService: PasswordResetService,
    private readonly twoFactorAuthService: TwoFactorAuthService,
    private readonly sessionManagementService: SessionManagementService,
    private readonly profilePhotoService: ProfilePhotoService
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
    @Res({ passthrough: true }) response: Response,
    @Req() request: Request
  ) {
    // Validate credentials using central AuthService
    const authResult = await this.authService.login(loginDto)

    // Verify user has at least one superadmin-context role (providerId = null)
    const user = authResult.user
    if (!this.hasSuperAdminRole(user)) {
      // Return generic error to prevent role enumeration
      throw new BadRequestException('Invalid credentials')
    }

    // Check if 2FA is enabled
    const twoFactorStatus = await this.twoFactorAuthService.getTwoFactorStatus(user.id)

    if (twoFactorStatus.enabled) {
      // Get IP address and user agent from request
      const ipAddress = request.ip
      const userAgent = request.headers['user-agent']

      // Send verification code
      await this.twoFactorAuthService.createAndSendLoginCode(
        user.id,
        user.email,
        ipAddress,
        userAgent
      )

      // Return special response indicating 2FA is required
      return ResponseUtil.success({
        requiresTwoFactor: true,
        userId: user.id,
        email: user.email,
        message: 'Verification code sent to your email',
      })
    }

    // Create session record FIRST (before generating JWT)
    const userAgent = request.headers['user-agent']
    const ipAddress = request.ip

    const sessionId = await this.sessionManagementService.createSession(
      user.id,
      userAgent,
      ipAddress
    )

    // Generate app-specific tokens with 'superadmin' claim and sessionId for token isolation
    const appTokens = this.authService.generateTokensFromUser(user, 'superadmin', sessionId)

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
    const appTokens = this.authService.generateTokensFromUser(user, 'superadmin')

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
  async getProfile(@CurrentUser() user: any) {
    // Verify user has at least one superadmin-context role (providerId = null)
    if (!this.hasSuperAdminRole(user)) {
      throw new UnauthorizedException('Access denied. Superadmin role required.')
    }

    // Fetch full user profile with contact fields and passwordChangedAt
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        emailVerified: true,
        passwordChangedAt: true,
        createdAt: true,
        updatedAt: true,
        profilePhotoUrl: true,
        phone: true,
        phoneVerified: true,
        address: true,
        city: true,
        state: true,
        postalCode: true,
        country: true,
        roles: {
          select: {
            role: {
              select: {
                id: true,
                name: true,
                providerId: true,
                isSystemRole: true,
              },
            },
          },
        },
      },
    })

    if (!dbUser) {
      throw new NotFoundException('User not found')
    }

    // Generate SAS URL for profile photo if it exists
    let profilePhotoUrl = dbUser.profilePhotoUrl
    if (profilePhotoUrl) {
      profilePhotoUrl = await this.profilePhotoService.generatePhotoUrl(profilePhotoUrl)
    }

    // Transform roles to flat structure and build response matching frontend User type
    const fullUser = {
      id: dbUser.id,
      email: dbUser.email,
      firstName: dbUser.firstName,
      lastName: dbUser.lastName,
      emailVerified: dbUser.emailVerified,
      passwordChangedAt: dbUser.passwordChangedAt,
      createdAt: dbUser.createdAt,
      updatedAt: dbUser.updatedAt,
      profilePhotoUrl: profilePhotoUrl ?? null,
      phone: dbUser.phone ?? null,
      phoneVerified: dbUser.phoneVerified ?? false,
      address: dbUser.address ?? null,
      city: dbUser.city ?? null,
      state: dbUser.state ?? null,
      postalCode: dbUser.postalCode ?? null,
      country: dbUser.country ?? null,
      roles: dbUser.roles.map((ur: any) => ({
        id: ur.role.id,
        name: ur.role.name,
        providerId: ur.role.providerId,
        isSystemRole: ur.role.isSystemRole,
      })),
      permissions: user.permissions || [], // Use permissions from JWT payload
    }

    return ResponseUtil.success(fullUser)
  }

  @Patch('profile')
  @ApiOperation({
    summary: 'Update current user profile',
    description: 'Update the profile of the currently authenticated super admin user',
  })
  async updateProfile(@CurrentUser() user: any, @Body() updateProfileDto: UpdateProfileDto) {
    if (!this.hasSuperAdminRole(user)) {
      throw new UnauthorizedException('Access denied. Superadmin role required.')
    }

    const userUpdateData: any = {}
    if (updateProfileDto.firstName !== undefined)
      userUpdateData.firstName = updateProfileDto.firstName
    if (updateProfileDto.lastName !== undefined) userUpdateData.lastName = updateProfileDto.lastName
    if (updateProfileDto.phone !== undefined) userUpdateData.phone = updateProfileDto.phone
    if (updateProfileDto.address !== undefined) userUpdateData.address = updateProfileDto.address
    if (updateProfileDto.city !== undefined) userUpdateData.city = updateProfileDto.city
    if (updateProfileDto.state !== undefined) userUpdateData.state = updateProfileDto.state
    if (updateProfileDto.postalCode !== undefined)
      userUpdateData.postalCode = updateProfileDto.postalCode
    if (updateProfileDto.country !== undefined) userUpdateData.country = updateProfileDto.country

    if (Object.keys(userUpdateData).length > 0) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: userUpdateData,
      })
    }

    const updatedUser = await this.authService.validateUser(user.id)
    return ResponseUtil.success(updatedUser)
  }

  @Patch('profile/photo')
  @UseInterceptors(FileInterceptor('photo'))
  @ApiOperation({
    summary: 'Upload profile photo',
    description: 'Upload a profile photo for the currently authenticated super admin user',
  })
  async uploadProfilePhoto(@CurrentUser() user: any, @UploadedFile() file: Express.Multer.File) {
    if (!this.hasSuperAdminRole(user)) {
      throw new UnauthorizedException('Access denied. Superadmin role required.')
    }

    if (!file) {
      throw new BadRequestException('No file uploaded')
    }

    const uploadResult = await this.profilePhotoService.uploadPhoto(user.id, {
      buffer: file.buffer,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    })

    await this.prisma.user.update({
      where: { id: user.id },
      data: { profilePhotoUrl: uploadResult.url },
    })

    const sasUrl = await this.profilePhotoService.generatePhotoUrl(uploadResult.url)
    const updatedUser = await this.authService.validateUser(user.id)

    return ResponseUtil.success({
      ...updatedUser,
      profilePhotoUrl: sasUrl,
    })
  }

  @Delete('profile/photo')
  @ApiOperation({
    summary: 'Delete profile photo',
    description: 'Delete the profile photo for the currently authenticated super admin user',
  })
  async deleteProfilePhoto(@CurrentUser() user: any) {
    if (!this.hasSuperAdminRole(user)) {
      throw new UnauthorizedException('Access denied. Superadmin role required.')
    }

    const userProfile = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { profilePhotoUrl: true },
    })

    if (!userProfile?.profilePhotoUrl) {
      throw new NotFoundException('No profile photo found')
    }

    await this.profilePhotoService.deletePhoto(userProfile.profilePhotoUrl)

    await this.prisma.user.update({
      where: { id: user.id },
      data: { profilePhotoUrl: null },
    })

    const updatedUser = await this.authService.validateUser(user.id)
    return ResponseUtil.success(updatedUser)
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

  /**
   * Get 2FA status
   */
  @Get('two-factor/status')
  @ApiOperation({
    summary: 'Get two-factor authentication status',
    description: 'Get the current 2FA status for the authenticated superadmin',
  })
  async getTwoFactorStatus(@CurrentUser() user: any) {
    return this.twoFactorAuthService.getTwoFactorStatus(user.id)
  }

  /**
   * Enable Email 2FA
   */
  @Post('two-factor/enable')
  @ApiOperation({
    summary: 'Enable two-factor authentication',
    description: 'Enable email-based two-factor authentication for the superadmin',
  })
  async enableTwoFactor(@CurrentUser() user: any) {
    await this.twoFactorAuthService.enableEmailTwoFactor(user.id)
    return ResponseUtil.success({
      message: 'Two-factor authentication enabled successfully',
    })
  }

  /**
   * Disable Email 2FA
   */
  @Post('two-factor/disable')
  @ApiOperation({
    summary: 'Disable two-factor authentication',
    description: 'Disable two-factor authentication for the superadmin',
  })
  async disableTwoFactor(@CurrentUser() user: any) {
    await this.twoFactorAuthService.disableEmailTwoFactor(user.id)
    return ResponseUtil.success({
      message: 'Two-factor authentication disabled successfully',
    })
  }

  /**
   * Send login verification code (called during login if 2FA is enabled)
   */
  @Public()
  @Post('two-factor/send-code')
  @ApiOperation({
    summary: 'Send login verification code',
    description: 'Send a verification code to the superadmin email for 2FA login',
  })
  async sendLoginCode(@Body() body: { userId: string; email: string }, @Req() request: Request) {
    const ipAddress = request.ip
    const userAgent = request.headers['user-agent']

    await this.twoFactorAuthService.createAndSendLoginCode(
      body.userId,
      body.email,
      ipAddress,
      userAgent
    )

    return ResponseUtil.success({
      message: 'Verification code sent to your email',
    })
  }

  /**
   * Verify login code and complete 2FA login
   */
  @Public()
  @Post('two-factor/verify-code')
  @ApiOperation({
    summary: 'Verify login code and complete authentication',
    description:
      'Verify the 2FA code sent to superadmin email, create session, and return JWT tokens',
  })
  async verifyLoginCode(
    @Body() body: { userId: string; code: string },
    @Res({ passthrough: true }) response: Response,
    @Req() request: Request
  ) {
    // Verify the 2FA code
    await this.twoFactorAuthService.verifyLoginCode(body.userId, body.code)

    // Fetch the full user with roles and permissions for token generation
    const user = await this.authService.validateUser(body.userId)

    if (!user) {
      throw new BadRequestException('User not found')
    }

    // Verify user has at least one superadmin-context role (providerId = null)
    if (!this.hasSuperAdminRole(user)) {
      throw new UnauthorizedException('Access denied. Superadmin role required.')
    }

    // Create session record
    const userAgent = request.headers['user-agent']
    const ipAddress = request.ip

    const sessionId = await this.sessionManagementService.createSession(
      user.id,
      userAgent,
      ipAddress
    )

    // Generate app-specific tokens with 'superadmin' claim and sessionId
    const appTokens = this.authService.generateTokensFromUser(user, 'superadmin', sessionId)

    // Set HTTP-only cookies for tokens with app-specific names
    response.cookie('wc_superadmin_access_token', appTokens.accessToken, {
      httpOnly: true,
      secure: this.configService.getNodeEnv() === 'production',
      sameSite: this.configService.getNodeEnv() === 'production' ? 'none' : 'lax',
      maxAge: parseDuration(this.configService.jwtConfig.expiresIn),
    })

    response.cookie('wc_superadmin_refresh_token', appTokens.refreshToken, {
      httpOnly: true,
      secure: this.configService.getNodeEnv() === 'production',
      sameSite: this.configService.getNodeEnv() === 'production' ? 'none' : 'lax',
      maxAge: parseDuration(this.configService.jwtConfig.refreshExpiresIn),
    })

    // If authUsingRequest is enabled, also send tokens in headers
    if (this.configService.jwtConfig.authUsingRequest) {
      response.setHeader('x-access-token', appTokens.accessToken)
      response.setHeader('x-refresh-token', appTokens.refreshToken)
    }

    return ResponseUtil.success({ user })
  }

  /**
   * Get all active sessions
   */
  @Get('sessions')
  @ApiOperation({
    summary: 'Get all active sessions',
    description: 'Get all active sessions for the current superadmin',
  })
  async getSessions(@CurrentUser() user: any) {
    // Extract sessionId from JWT payload (user object contains decoded JWT)
    const currentSessionId = user.sessionId
    const sessions = await this.sessionManagementService.getUserSessions(user.id, currentSessionId)
    return ResponseUtil.success({ sessions })
  }

  /**
   * Revoke specific session
   */
  @Delete('sessions/:sessionId')
  @ApiOperation({
    summary: 'Revoke specific session',
    description: 'Revoke a specific session by session ID',
  })
  async revokeSession(@CurrentUser() user: any, @Param('sessionId') sessionId: string) {
    await this.sessionManagementService.revokeSession(user.id, sessionId)
    return ResponseUtil.success({
      message: 'Session revoked successfully',
    })
  }

  /**
   * Revoke all other sessions
   */
  @Post('sessions/revoke-all-others')
  @ApiOperation({
    summary: 'Revoke all other sessions',
    description: 'Revoke all sessions except the current one',
  })
  async revokeAllOtherSessions(@CurrentUser() user: any) {
    // Extract current sessionId from JWT payload
    const currentSessionId = user.sessionId

    await this.sessionManagementService.revokeAllOtherSessions(user.id, currentSessionId)
    return ResponseUtil.success({
      message: 'All other sessions revoked successfully',
    })
  }
}
