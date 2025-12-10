import {
  BadRequestException,
  Body,
  ConflictException,
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
import { PrismaService } from '../../../prisma/prisma.service'
import { Public } from '../../core/auth/decorators/public.decorator'
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator'
import { RegisterProviderDto } from './dto/register.dto'
import { ProviderLoginDto } from './dto/login.dto'
import { ResendVerificationCodeDto, VerifyEmailDto } from './dto/verify-email.dto'
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  RefreshTokenDto,
  ResetPasswordDto,
} from '../../core/auth/dto/auth.dto'
import { ResponseUtil } from '../../../common/utils/response.util'
import { ConfigService } from '../../../config/config.service'
import { EmailVerificationService } from './services/email-verification.service'
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
    private readonly passwordResetService: PasswordResetService
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
          firstName: registerDto.firstName,
          lastName: registerDto.lastName,
          emailVerified: false,
        },
      })

      // Create provider
      const provider = await tx.provider.create({
        data: {
          name: registerDto.providerName,
          ownerId: user.id,
          phone: registerDto.providerPhone,
          email: registerDto.providerEmail,
          address: registerDto.providerAddress,
          city: registerDto.city,
          state: registerDto.state,
          postalCode: registerDto.postalCode,
          country: registerDto.country,
          website: registerDto.website,
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
        name: result.provider.name,
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
    @Body() verifyEmailDto: VerifyEmailDto,
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
    const appTokens = this.authService.generateAppSpecificTokens(user, 'provider')

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
  async resendVerificationCode(@Body() resendDto: ResendVerificationCodeDto) {
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
  async login(@Body() loginDto: ProviderLoginDto, @Res({ passthrough: true }) response: Response) {
    // Validate credentials using central AuthService
    const result = await this.authService.login(loginDto)

    // Verify user has Provider Admin role or a provider-specific role
    const user = result.user
    const hasProviderRole = user.roles?.some(
      (role: any) => role.name === 'Provider Admin' || role.provider_id !== null
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

    // Generate app-specific tokens with 'provider' claim for token isolation
    const appTokens = this.authService.generateAppSpecificTokens(user, 'provider')

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
      (role: any) => role.name === 'Provider Admin' || role.provider_id !== null
    )

    if (!hasProviderRole) {
      throw new UnauthorizedException(
        'Access denied. Provider Admin role or provider-specific role required.'
      )
    }

    // Generate app-specific tokens with 'provider' claim for token isolation
    const appTokens = this.authService.generateAppSpecificTokens(user, 'provider')

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
  getProfile(@CurrentUser() user: any) {
    // Verify user has Provider Admin role or provider-specific role
    const hasProviderRole = user.roles?.some(
      (role: any) => role.name === 'Provider Admin' || role.provider_id !== null
    )

    if (!hasProviderRole) {
      throw new UnauthorizedException(
        'Access denied. Provider Admin role or provider-specific role required.'
      )
    }

    return ResponseUtil.success(user)
  }

  @Patch('change-password')
  @ApiOperation({
    summary: 'Change password',
    description: 'Change the password for the currently authenticated provider user',
  })
  async changePassword(@CurrentUser() user: any, @Body() changePasswordDto: ChangePasswordDto) {
    // Verify user has Provider Admin role or provider-specific role
    const hasProviderRole = user.roles?.some(
      (role: any) => role.name === 'Provider Admin' || role.provider_id !== null
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
}
