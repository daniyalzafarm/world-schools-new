import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
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
import { UserLoginDto } from './dto/login.dto'
import { GoogleSignInDto } from './dto/google-signin.dto'
import { RegisterUserDto } from './dto/register.dto'
import { UpdateProfileDto } from './dto/update-profile.dto'
import { UserResendVerificationCodeDto, UserVerifyEmailDto } from './dto/verify-email.dto'
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

@ApiTags('User Auth')
@Controller('user/auth')
export class UserAuthController {
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
    summary: 'Register new parent user',
    description:
      'Create a new user account, parent profile, assign Parent role, and send email verification code',
  })
  async register(@Body() registerDto: RegisterUserDto) {
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

    // Find Parent role
    const parentRole = await this.prisma.role.findFirst({
      where: {
        name: 'Parent',
        isSystemRole: true,
      },
    })

    if (!parentRole) {
      throw new Error('Parent role not found in system')
    }

    // Create user, parent profile, and assign role in a transaction
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

      // Create parent profile
      const parent = await tx.parent.create({
        data: {
          userId: user.id,
          phone: registerDto.phone,
          address: registerDto.address,
          city: registerDto.city,
          state: registerDto.state,
          postalCode: registerDto.postalCode,
          country: registerDto.country,
        },
      })

      // Assign Parent role
      await tx.userRole.create({
        data: {
          userId: user.id,
          roleId: parentRole.id,
        },
      })

      return { user, parent }
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
      parent: {
        id: result.parent.id,
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
    @Body() verifyEmailDto: UserVerifyEmailDto,
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

    // Verify user has Parent role
    const hasParentRole = user.roles?.some((role: any) => role.name === 'Parent')

    if (!hasParentRole) {
      // User verified email but doesn't have parent role
      // Still return success but don't authenticate
      return ResponseUtil.success({
        message: 'Email verified successfully. You can now login.',
      })
    }

    // Generate app-specific tokens with 'user' claim for token isolation
    const appTokens = this.authService.generateAppSpecificTokens(user, 'user')

    // Set HTTP-only cookies for tokens with app-specific names
    response.cookie('wc_user_access_token', appTokens.accessToken, {
      httpOnly: true,
      secure: this.configService.getNodeEnv() === 'production',
      sameSite: this.configService.getNodeEnv() === 'production' ? 'none' : 'lax',
      maxAge: parseDuration(this.configService.jwtConfig.expiresIn),
    })

    response.cookie('wc_user_refresh_token', appTokens.refreshToken, {
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
  async resendVerificationCode(@Body() resendDto: UserResendVerificationCodeDto) {
    await this.emailVerificationService.resendVerificationCode(resendDto.email)

    return ResponseUtil.success({
      message: 'Verification code sent successfully. Please check your email.',
    })
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Parent login',
    description:
      'Authenticate parent user and return JWT tokens. User must have Parent role and verified email.',
  })
  async login(@Body() loginDto: UserLoginDto, @Res({ passthrough: true }) response: Response) {
    // Validate credentials using central AuthService
    const result = await this.authService.login(loginDto)

    // Verify user has Parent role
    const user = result.user
    const hasParentRole = user.roles?.some((role: any) => role.name === 'Parent')

    if (!hasParentRole) {
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

    // Generate app-specific tokens with 'user' claim for token isolation
    const appTokens = this.authService.generateAppSpecificTokens(user, 'user')

    // Set HTTP-only cookies for tokens with app-specific names
    response.cookie('wc_user_access_token', appTokens.accessToken, {
      httpOnly: true,
      secure: this.configService.getNodeEnv() === 'production',
      sameSite: this.configService.getNodeEnv() === 'production' ? 'none' : 'lax',
      maxAge: parseDuration(this.configService.jwtConfig.expiresIn),
    })

    response.cookie('wc_user_refresh_token', appTokens.refreshToken, {
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
  @Post('google-signin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Google OAuth sign-in',
    description:
      'Sign in with Google account. Creates new user and parent profile if not exists, or returns existing user.',
  })
  async googleSignIn(
    @Body() googleSignInDto: GoogleSignInDto,
    @Res({ passthrough: true }) response: Response
  ) {
    // Verify provider exists
    const provider = await this.prisma.provider.findUnique({
      where: { id: googleSignInDto.providerId },
    })

    if (!provider) {
      throw new NotFoundException('Provider not found')
    }

    // Find Parent role
    const parentRole = await this.prisma.role.findFirst({
      where: {
        name: 'Parent',
        isSystemRole: true,
      },
    })

    if (!parentRole) {
      throw new Error('Parent role not found in system')
    }

    // Check if account exists
    const account = await this.prisma.userAccount.findUnique({
      where: {
        authProvider_authProviderAccountId: {
          authProvider: 'google',
          authProviderAccountId: googleSignInDto.providerAccountId,
        },
      },
      include: {
        user: {
          include: {
            roles: {
              include: {
                role: true,
              },
            },
            parentProfile: true,
          },
        },
      },
    })

    let user: any
    let parent: any

    if (account) {
      // Existing user - return their data
      user = account.user
      parent = user.parentProfile

      // If parent profile doesn't exist, create it
      if (!parent) {
        parent = await this.prisma.parent.create({
          data: {
            userId: user.id,
            phone: googleSignInDto.phone,
            address: googleSignInDto.address,
            city: googleSignInDto.city,
            state: googleSignInDto.state,
            postalCode: googleSignInDto.postalCode,
            country: googleSignInDto.country,
          },
        })
      }
    } else {
      // New user - create user, account, parent profile, and assign role
      const result = await this.prisma.$transaction(async tx => {
        // Create user
        const newUser = await tx.user.create({
          data: {
            email: googleSignInDto.email,
            firstName: googleSignInDto.firstName,
            lastName: googleSignInDto.lastName,
            passwordHash: null, // OAuth users don't have password
          },
        })

        // Create user account
        await tx.userAccount.create({
          data: {
            userId: newUser.id,
            type: 'oauth',
            authProvider: 'google',
            authProviderAccountId: googleSignInDto.providerAccountId,
          },
        })

        // Create parent profile
        const newParent = await tx.parent.create({
          data: {
            userId: newUser.id,
            phone: googleSignInDto.phone,
            address: googleSignInDto.address,
            city: googleSignInDto.city,
            state: googleSignInDto.state,
            postalCode: googleSignInDto.postalCode,
            country: googleSignInDto.country,
          },
        })

        // Assign Parent role
        await tx.userRole.create({
          data: {
            userId: newUser.id,
            roleId: parentRole.id,
          },
        })

        return { user: newUser, parent: newParent }
      })

      user = result.user
      parent = result.parent
    }

    // Fetch the full user with roles and permissions for token generation
    const fullUser = await this.authService.validateUser(user.id)

    // Generate app-specific tokens with 'user' claim for token isolation
    const appTokens = this.authService.generateAppSpecificTokens(fullUser, 'user')

    // Set HTTP-only cookies for tokens with app-specific names
    response.cookie('wc_user_access_token', appTokens.accessToken, {
      httpOnly: true,
      secure: this.configService.getNodeEnv() === 'production',
      sameSite: this.configService.getNodeEnv() === 'production' ? 'none' : 'lax',
      maxAge: parseDuration(this.configService.jwtConfig.expiresIn),
    })

    response.cookie('wc_user_refresh_token', appTokens.refreshToken, {
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
      user: fullUser,
      parent: {
        id: parent.id,
      },
    })
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
      request.cookies?.wc_user_refresh_token ?? refreshTokenDto?.refreshToken

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not provided')
    }

    const result = await this.authService.refreshToken(refreshToken)

    // Verify user still has Parent role
    const user = result.user
    const hasParentRole = user.roles?.some((role: any) => role.name === 'Parent')

    if (!hasParentRole) {
      throw new UnauthorizedException('Access denied. Parent role required.')
    }

    // Generate app-specific tokens with 'user' claim for token isolation
    const appTokens = this.authService.generateAppSpecificTokens(user, 'user')

    // Set HTTP-only cookies for tokens with app-specific names
    response.cookie('wc_user_access_token', appTokens.accessToken, {
      httpOnly: true,
      secure: this.configService.getNodeEnv() === 'production',
      sameSite: this.configService.getNodeEnv() === 'production' ? 'none' : 'lax',
      maxAge: parseDuration(this.configService.jwtConfig.expiresIn),
    })

    response.cookie('wc_user_refresh_token', appTokens.refreshToken, {
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
    description: 'Get the profile of the currently authenticated parent user',
  })
  getProfile(@CurrentUser() user: any) {
    // Verify user has Parent role
    const hasParentRole = user.roles?.some((role: any) => role.name === 'Parent')

    if (!hasParentRole) {
      throw new UnauthorizedException('Access denied. Parent role required.')
    }

    return ResponseUtil.success(user)
  }

  @Patch('profile')
  @ApiOperation({
    summary: 'Update current user profile',
    description: 'Update the profile of the currently authenticated parent user',
  })
  async updateProfile(@CurrentUser() user: any, @Body() updateProfileDto: UpdateProfileDto) {
    // Verify user has Parent role
    const hasParentRole = user.roles?.some((role: any) => role.name === 'Parent')

    if (!hasParentRole) {
      throw new UnauthorizedException('Access denied. Parent role required.')
    }

    // Update user basic information if provided
    const userUpdateData: any = {}
    if (updateProfileDto.firstName !== undefined) {
      userUpdateData.firstName = updateProfileDto.firstName
    }
    if (updateProfileDto.lastName !== undefined) {
      userUpdateData.lastName = updateProfileDto.lastName
    }

    // Update parent profile information if provided
    const parentUpdateData: any = {}
    if (updateProfileDto.phone !== undefined) {
      parentUpdateData.phone = updateProfileDto.phone
    }
    if (updateProfileDto.address !== undefined) {
      parentUpdateData.address = updateProfileDto.address
    }
    if (updateProfileDto.city !== undefined) {
      parentUpdateData.city = updateProfileDto.city
    }
    if (updateProfileDto.state !== undefined) {
      parentUpdateData.state = updateProfileDto.state
    }
    if (updateProfileDto.postalCode !== undefined) {
      parentUpdateData.postalCode = updateProfileDto.postalCode
    }
    if (updateProfileDto.country !== undefined) {
      parentUpdateData.country = updateProfileDto.country
    }

    // Perform updates in a transaction
    await this.prisma.$transaction(async tx => {
      // Update user if there are changes
      if (Object.keys(userUpdateData).length > 0) {
        await tx.user.update({
          where: { id: user.id },
          data: userUpdateData,
        })
      }

      // Update or create parent profile if there are changes
      if (Object.keys(parentUpdateData).length > 0) {
        // Check if parent profile exists
        const existingParent = await tx.parent.findUnique({
          where: { userId: user.id },
        })

        if (existingParent) {
          // Update existing parent profile
          await tx.parent.update({
            where: { userId: user.id },
            data: parentUpdateData,
          })
        } else {
          // Create new parent profile
          await tx.parent.create({
            data: {
              userId: user.id,
              ...parentUpdateData,
            },
          })
        }
      }
    })

    // Fetch and return updated user profile
    const updatedUser = await this.authService.validateUser(user.id)

    return ResponseUtil.success(updatedUser)
  }

  @Patch('change-password')
  @ApiOperation({
    summary: 'Change password',
    description: 'Change the password for the currently authenticated parent user',
  })
  async changePassword(@CurrentUser() user: any, @Body() changePasswordDto: ChangePasswordDto) {
    // Verify user has Parent role
    const hasParentRole = user.roles?.some((role: any) => role.name === 'Parent')

    if (!hasParentRole) {
      throw new UnauthorizedException('Access denied. Parent role required.')
    }

    await this.authService.changePassword(user.id, changePasswordDto)

    return ResponseUtil.success(null)
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Logout',
    description: 'Clear authentication cookies and logout the parent user',
  })
  logout(@Res({ passthrough: true }) response: Response) {
    // Clear app-specific cookies
    response.clearCookie('wc_user_access_token')
    response.clearCookie('wc_user_refresh_token')

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
    await this.passwordResetService.createPasswordResetToken(forgotPasswordDto.email, 'user')

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
      'user'
    )

    return ResponseUtil.success({
      message: 'Password reset successful. You can now login with your new password.',
    })
  }
}
