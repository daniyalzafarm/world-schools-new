import {
  BadRequestException,
  Body,
  ConflictException,
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
import { RegisterProviderDto } from './dto/register.dto'
import { ProviderLoginDto } from './dto/login.dto'
import { ProviderResendVerificationCodeDto, ProviderVerifyEmailDto } from './dto/verify-email.dto'
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  RefreshTokenDto,
  ResetPasswordDto,
} from '../../core/auth/dto/auth.dto'
import { UpdateProfileDto } from '../../user/auth/dto/update-profile.dto'
import { ResponseUtil } from '../../../common/utils/response.util'
import { ProfilePhotoService } from '../../user/auth/services/profile-photo.service'
import { ConfigService } from '../../../config/config.service'
import { EmailVerificationService } from './services/email-verification.service'
import { TwoFactorAuthService } from './services/two-factor-auth.service'
import { SessionManagementService } from './services/session-management.service'
import { PasswordResetService } from '../../core/auth/services/password-reset.service'
import * as bcrypt from 'bcryptjs'

@ApiTags('Provider Auth')
@Controller('provider/auth')
export class ProviderAuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly passwordResetService: PasswordResetService,
    private readonly twoFactorAuthService: TwoFactorAuthService,
    private readonly sessionManagementService: SessionManagementService,
    private readonly profilePhotoService: ProfilePhotoService
  ) {}

  @Public()
  @Post('register')
  @ApiOperation({
    summary: 'Register new provider owner',
    description:
      'Create a new user account, provider record, assign Provider Admin role, and send email verification code',
  })
  async register(@Body() registerDto: RegisterProviderDto) {
    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: registerDto.email },
    })

    if (existingUser) {
      throw new ConflictException('User with this email already exists')
    }

    // Hash password
    const saltRounds = this.configService.jwtConfig.bcryptSaltRounds
    const passwordHash = await bcrypt.hash(registerDto.password, saltRounds)

    // Find Provider Admin role
    const providerAdminRole = await this.prisma.role.findFirst({
      where: {
        name: 'Provider Admin',
        isSystemRole: true,
      },
    })

    if (!providerAdminRole) {
      throw new Error('Provider Admin role not found in system')
    }

    // Create user, provider, and assign role in a transaction
    const result = await this.prisma.$transaction(async tx => {
      // Create user
      const user = await tx.user.create({
        data: {
          email: registerDto.email,
          passwordHash,
          passwordChangedAt: new Date(),
          firstName: registerDto.firstName,
          lastName: registerDto.lastName,
          emailVerified: false,
        },
      })

      // Create provider with pre-populated contact info
      const provider = await tx.provider.create({
        data: {
          ownerId: user.id,
          // Pre-populate contact information from signup
          contactFirstName: registerDto.firstName,
          contactLastName: registerDto.lastName,
          contactRole: registerDto.jobTitle,
          contactPhone: registerDto.phoneNumber,
          contactEmail: registerDto.email,
          // Auto-complete Step 1 (Contact & Account) and set user to start at Step 2 (Find Your Camp)
          onboardingCurrentStep: 2,
          onboardingStartedAt: new Date(),
        },
      })

      // Assign Provider Admin role
      await tx.userRole.create({
        data: {
          userId: user.id,
          roleId: providerAdminRole.id,
        },
      })

      return { user, provider }
    })

    // Send verification email
    await this.emailVerificationService.createAndSendVerificationCode(
      result.user.id,
      result.user.email
    )

    return ResponseUtil.success({
      message: 'Registration successful. Please check your email for verification code.',
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        emailVerified: false,
      },
      provider: {
        id: result.provider.id,
      },
    })
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify email with code',
    description:
      'Verify user email address using the 6-digit code sent to their email. After successful verification, automatically authenticates the user and returns JWT tokens.',
  })
  async verifyEmail(
    @Body() verifyEmailDto: ProviderVerifyEmailDto,
    @Res({ passthrough: true }) response: Response
  ) {
    // Verify the email and get the user
    const verifiedUser = await this.emailVerificationService.verifyCode(
      verifyEmailDto.email,
      verifyEmailDto.code
    )

    // Fetch the full user with roles and permissions for token generation
    const user = await this.authService.validateUser(verifiedUser.id)

    if (!user) {
      throw new BadRequestException('User not found')
    }

    // Verify user has Provider Admin role or a provider-specific role
    const hasProviderRole = user.roles?.some(
      (role: any) => role.name === 'Provider Admin' || role.providerId !== null
    )

    if (!hasProviderRole) {
      // User verified email but doesn't have provider role
      // Still return success but don't authenticate
      return ResponseUtil.success({
        message: 'Email verified successfully. You can now login.',
      })
    }

    // Generate app-specific tokens with 'provider' claim for token isolation
    const appTokens = this.authService.generateTokensFromUser(user, 'provider')

    // Set HTTP-only cookies for tokens with app-specific names
    response.cookie('wc_provider_access_token', appTokens.accessToken, {
      httpOnly: true,
      secure: this.configService.getNodeEnv() === 'production',
      sameSite: this.configService.getNodeEnv() === 'production' ? 'none' : 'lax',
      maxAge: parseDuration(this.configService.jwtConfig.expiresIn),
    })

    response.cookie('wc_provider_refresh_token', appTokens.refreshToken, {
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

    return ResponseUtil.success({
      message: 'Email verified successfully. You are now logged in.',
      user,
    })
  }

  @Public()
  @Post('resend-verification-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resend verification code',
    description: 'Resend verification code to user email',
  })
  async resendVerificationCode(@Body() resendDto: ProviderResendVerificationCodeDto) {
    await this.emailVerificationService.resendVerificationCode(resendDto.email)

    return ResponseUtil.success({
      message: 'Verification code sent successfully. Please check your email.',
    })
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Provider login',
    description:
      'Authenticate provider user and return JWT tokens. User must have Provider Admin role or provider-specific custom role and verified email.',
  })
  async login(
    @Body() loginDto: ProviderLoginDto,
    @Res({ passthrough: true }) response: Response,
    @Req() request: Request
  ) {
    // Validate credentials using central AuthService
    const result = await this.authService.login(loginDto)

    // Verify user has Provider Admin role or a provider-specific role
    const user = result.user
    const hasProviderRole = user.roles?.some(
      (role: any) => role.name === 'Provider Admin' || role.providerId !== null
    )

    if (!hasProviderRole) {
      // Return generic error to prevent role enumeration
      throw new BadRequestException('Invalid credentials')
    }

    // Check if email is verified
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { emailVerified: true },
    })

    if (!dbUser?.emailVerified) {
      // Send a new verification code to help the user verify their email
      await this.emailVerificationService.createAndSendVerificationCode(user.id, user.email)

      // Return a specific error response so frontend can redirect to verification page
      // Using ResponseUtil to return a structured error with additional metadata
      return {
        success: false,
        data: {
          message: 'Your email is not verified. We have sent a verification code to your email.',
          emailNotVerified: true,
          email: user.email,
          statusCode: HttpStatus.BAD_REQUEST,
        },
      }
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

    // Generate app-specific tokens with 'provider' claim and sessionId for token isolation
    const appTokens = this.authService.generateTokensFromUser(user, 'provider', sessionId)

    // Set HTTP-only cookies for tokens with app-specific names
    response.cookie('wc_provider_access_token', appTokens.accessToken, {
      httpOnly: true,
      secure: this.configService.getNodeEnv() === 'production',
      sameSite: this.configService.getNodeEnv() === 'production' ? 'none' : 'lax',
      maxAge: parseDuration(this.configService.jwtConfig.expiresIn),
    })

    response.cookie('wc_provider_refresh_token', appTokens.refreshToken, {
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

    return ResponseUtil.success({ user: result.user })
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
      request.cookies?.wc_provider_refresh_token ?? refreshTokenDto?.refreshToken

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not provided')
    }

    const result = await this.authService.refreshToken(refreshToken)

    // Verify user still has Provider Admin role or provider-specific role
    const user = result.user
    const hasProviderRole = user.roles?.some(
      (role: any) => role.name === 'Provider Admin' || role.providerId !== null
    )

    if (!hasProviderRole) {
      throw new UnauthorizedException(
        'Access denied. Provider Admin role or provider-specific role required.'
      )
    }

    // Generate app-specific tokens with 'provider' claim for token isolation
    const appTokens = this.authService.generateTokensFromUser(user, 'provider')

    // Set HTTP-only cookies for tokens with app-specific names
    response.cookie('wc_provider_access_token', appTokens.accessToken, {
      httpOnly: true,
      secure: this.configService.getNodeEnv() === 'production',
      sameSite: this.configService.getNodeEnv() === 'production' ? 'none' : 'lax',
      maxAge: parseDuration(this.configService.jwtConfig.expiresIn),
    })

    response.cookie('wc_provider_refresh_token', appTokens.refreshToken, {
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

    return ResponseUtil.success({ user: result.user, expiresIn: appTokens.expiresIn })
  }

  @Get('profile')
  @ApiOperation({
    summary: 'Get current user profile',
    description: 'Get the profile of the currently authenticated provider user',
  })
  async getProfile(@CurrentUser() user: any) {
    // Verify user has Provider Admin role or provider-specific role
    const hasProviderRole = user.roles?.some(
      (role: any) => role.name === 'Provider Admin' || role.providerId !== null
    )

    if (!hasProviderRole) {
      throw new UnauthorizedException(
        'Access denied. Provider Admin role or provider-specific role required.'
      )
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
              },
            },
          },
        },
        ownedProvider: {
          select: {
            id: true,
            legalCompanyName: true,
            approvalStatus: true,
            onboardingCurrentStep: true,
            createdAt: true,
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
      })),
      permissions: user.permissions || [], // Use permissions from JWT payload
      ownedProvider: dbUser.ownedProvider,
    }

    return ResponseUtil.success(fullUser)
  }

  @Patch('profile')
  @ApiOperation({
    summary: 'Update current user profile',
    description: 'Update the profile of the currently authenticated provider user',
  })
  async updateProfile(@CurrentUser() user: any, @Body() updateProfileDto: UpdateProfileDto) {
    const hasProviderRole = user.roles?.some(
      (role: any) => role.name === 'Provider Admin' || role.providerId !== null
    )

    if (!hasProviderRole) {
      throw new UnauthorizedException(
        'Access denied. Provider Admin role or provider-specific role required.'
      )
    }

    const userUpdateData: any = {}
    if (updateProfileDto.firstName !== undefined) userUpdateData.firstName = updateProfileDto.firstName
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
    description: 'Upload a profile photo for the currently authenticated provider user',
  })
  async uploadProfilePhoto(@CurrentUser() user: any, @UploadedFile() file: Express.Multer.File) {
    const hasProviderRole = user.roles?.some(
      (role: any) => role.name === 'Provider Admin' || role.providerId !== null
    )

    if (!hasProviderRole) {
      throw new UnauthorizedException(
        'Access denied. Provider Admin role or provider-specific role required.'
      )
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
    description: 'Delete the profile photo for the currently authenticated provider user',
  })
  async deleteProfilePhoto(@CurrentUser() user: any) {
    const hasProviderRole = user.roles?.some(
      (role: any) => role.name === 'Provider Admin' || role.providerId !== null
    )

    if (!hasProviderRole) {
      throw new UnauthorizedException(
        'Access denied. Provider Admin role or provider-specific role required.'
      )
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
    description: 'Change the password for the currently authenticated provider user',
  })
  async changePassword(@CurrentUser() user: any, @Body() changePasswordDto: ChangePasswordDto) {
    // Verify user has Provider Admin role or provider-specific role
    const hasProviderRole = user.roles?.some(
      (role: any) => role.name === 'Provider Admin' || role.providerId !== null
    )

    if (!hasProviderRole) {
      throw new UnauthorizedException(
        'Access denied. Provider Admin role or provider-specific role required.'
      )
    }

    await this.authService.changePassword(user.id, changePasswordDto)

    return ResponseUtil.success(null)
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Logout',
    description: 'Clear authentication cookies and logout the provider user',
  })
  logout(@Res({ passthrough: true }) response: Response) {
    // Clear app-specific cookies
    response.clearCookie('wc_provider_access_token')
    response.clearCookie('wc_provider_refresh_token')

    return ResponseUtil.success({ message: 'Logged out successfully' })
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
    await this.passwordResetService.createPasswordResetToken(forgotPasswordDto.email, 'provider')

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
      'provider'
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
    description: 'Get the current 2FA status for the authenticated provider',
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
    description: 'Enable email-based two-factor authentication for the provider',
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
    description: 'Disable two-factor authentication for the provider',
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
    description: 'Send a verification code to the provider email for 2FA login',
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
      'Verify the 2FA code sent to provider email, create session, and return JWT tokens',
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

    // Verify user has Provider Admin role or a provider-specific role
    const hasProviderRole = user.roles?.some(
      (role: any) => role.name === 'Provider Admin' || role.providerId !== null
    )

    if (!hasProviderRole) {
      throw new UnauthorizedException(
        'Access denied. Provider Admin role or provider-specific role required.'
      )
    }

    // Create session record
    const userAgent = request.headers['user-agent']
    const ipAddress = request.ip

    const sessionId = await this.sessionManagementService.createSession(
      user.id,
      userAgent,
      ipAddress
    )

    // Generate app-specific tokens with 'provider' claim and sessionId
    const appTokens = this.authService.generateTokensFromUser(user, 'provider', sessionId)

    // Set HTTP-only cookies for tokens with app-specific names
    response.cookie('wc_provider_access_token', appTokens.accessToken, {
      httpOnly: true,
      secure: this.configService.getNodeEnv() === 'production',
      sameSite: this.configService.getNodeEnv() === 'production' ? 'none' : 'lax',
      maxAge: parseDuration(this.configService.jwtConfig.expiresIn),
    })

    response.cookie('wc_provider_refresh_token', appTokens.refreshToken, {
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
    description: 'Get all active sessions for the current provider',
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
