import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
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
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { FileInterceptor } from '@nestjs/platform-express'
import { JwtService } from '@nestjs/jwt'
import { Request, Response } from 'express'
import { parseDuration } from '@world-schools/wc-utils'
import { Prisma } from '../../../generated/client/client'
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
  RequestEmailChangeDto,
  RequestPhoneChangeDto,
  VerifyEmailChangeDto,
  VerifyPhoneChangeDto,
} from './dto/contact-verification.dto'
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  RefreshTokenDto,
  ResetPasswordDto,
  SetPasswordDto,
} from '../../core/auth/dto/auth.dto'
import { ResponseUtil } from '../../../common/utils/response.util'
import { ConfigService } from '../../../config/config.service'
import { EmailVerificationService } from '../../core/auth/services/email-verification.service'
import { PasswordResetService } from '../../core/auth/services/password-reset.service'
import { TwoFactorAuthService } from '../../core/auth/services/two-factor-auth.service'
import { SessionManagementService } from '../../core/auth/services/session-management.service'
import { ProfilePhotoService } from './services/profile-photo.service'
import { GoogleTokenVerifierService } from './services/google-token-verifier.service'
import { ProfileCompletionService } from '../../common/profile-completion/profile-completion.service'
import * as bcrypt from 'bcryptjs'

@ApiTags('User Auth')
@Controller('user/auth')
export class UserAuthController {
  private readonly logger = new Logger(UserAuthController.name)

  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly passwordResetService: PasswordResetService,
    private readonly twoFactorAuthService: TwoFactorAuthService,
    private readonly sessionManagementService: SessionManagementService,
    private readonly profilePhotoService: ProfilePhotoService,
    private readonly googleTokenVerifier: GoogleTokenVerifierService,
    private readonly profileCompletion: ProfileCompletionService
  ) {}

  /**
   * Phase 7.5 — refresh `Parent.profileCompletion` from the current
   * User + Parent state. Called from every endpoint on this controller
   * that mutates a profile-completion-scored field. Cheap: a single
   * SELECT + conditional UPDATE inside `ProfileCompletionService`.
   */
  private async recomputeParentCompletionByUserId(userId: string): Promise<void> {
    const parent = await this.prisma.parent.findUnique({
      where: { userId },
      select: { id: true },
    })
    if (parent) await this.profileCompletion.enqueueRecomputeForParent(parent.id)
  }

  /**
   * Centralized helper method for creating authenticated sessions
   * Combines session creation, token generation, and cookie/header setting
   * Ensures consistency across all authentication flows
   */
  private async createAuthenticatedSession(
    user: any,
    request: Request,
    response: Response,
    app: 'user' | 'provider' | 'superadmin'
  ) {
    // Create session record
    const userAgent = request.headers['user-agent']
    const ipAddress = request.ip

    const sessionId = await this.sessionManagementService.createSession(
      user.id,
      userAgent,
      ipAddress
    )

    // Generate app-specific tokens with sessionId
    const tokens = this.authService.generateTokensFromUser(user, app, sessionId)

    // Set HTTP-only cookies for tokens with app-specific names.
    // path:'/' is required so that WebSocket upgrade requests to /socket.io/ also receive the
    // cookie. Cross-app token misuse is prevented by the JWT app-claim validation in JwtStrategy,
    // not by cookie path scoping.
    const cookiePrefix =
      app === 'user' ? 'wc_user' : app === 'provider' ? 'wc_provider' : 'wc_superadmin'

    response.cookie(`${cookiePrefix}_access_token`, tokens.accessToken, {
      httpOnly: true,
      secure: this.configService.getNodeEnv() === 'production',
      sameSite: this.configService.getNodeEnv() === 'production' ? 'none' : 'lax',
      maxAge: parseDuration(this.configService.jwtConfig.expiresIn),
      path: '/',
    })

    response.cookie(`${cookiePrefix}_refresh_token`, tokens.refreshToken, {
      httpOnly: true,
      secure: this.configService.getNodeEnv() === 'production',
      sameSite: this.configService.getNodeEnv() === 'production' ? 'none' : 'lax',
      maxAge: parseDuration(this.configService.jwtConfig.refreshExpiresIn),
      path: '/',
    })

    // If authUsingRequest is enabled, also send tokens in headers
    if (this.configService.jwtConfig.authUsingRequest) {
      response.setHeader('x-access-token', tokens.accessToken)
      response.setHeader('x-refresh-token', tokens.refreshToken)
    }

    return { user, tokens, sessionId }
  }

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

    // Create user (with contact fields), parent profile (nationality/languages only), and assign role in a transaction
    const result = await this.prisma.$transaction(async tx => {
      // Create user with contact fields on User model
      const user = await tx.user.create({
        data: {
          email: registerDto.email,
          passwordHash,
          passwordChangedAt: new Date(),
          firstName: registerDto.firstName,
          lastName: registerDto.lastName,
          emailVerified: false,
          phone: registerDto.phone,
          address: registerDto.address,
          city: registerDto.city,
          state: registerDto.state,
          postalCode: registerDto.postalCode,
          country: registerDto.country,
        },
      })

      // Create parent profile (nationality/languages only - contact fields are on User)
      const parent = await tx.parent.create({
        data: {
          userId: user.id,
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
      result.user.email,
      this.configService.bookingPortalUrl,
      'parent'
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
    @Res({ passthrough: true }) response: Response,
    @Req() request: Request
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

    // Use centralized helper to create session and generate tokens with sessionId
    await this.createAuthenticatedSession(user, request, response, 'user')

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
    await this.emailVerificationService.resendVerificationCode(
      resendDto.email,
      this.configService.bookingPortalUrl,
      'parent'
    )

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
  async login(
    @Body() loginDto: UserLoginDto,
    @Res({ passthrough: true }) response: Response,
    @Req() request: Request
  ) {
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
      await this.emailVerificationService.createAndSendVerificationCode(
        user.id,
        user.email,
        this.configService.bookingPortalUrl,
        'parent'
      )

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

    // Generate app-specific tokens with 'user' claim and sessionId for token isolation
    const appTokens = this.authService.generateTokensFromUser(user, 'user', sessionId)

    // Set HTTP-only cookies for tokens with app-specific names
    response.cookie('wc_user_access_token', appTokens.accessToken, {
      httpOnly: true,
      secure: this.configService.getNodeEnv() === 'production',
      sameSite: this.configService.getNodeEnv() === 'production' ? 'none' : 'lax',
      maxAge: parseDuration(this.configService.jwtConfig.expiresIn),
      path: '/',
    })

    response.cookie('wc_user_refresh_token', appTokens.refreshToken, {
      httpOnly: true,
      secure: this.configService.getNodeEnv() === 'production',
      sameSite: this.configService.getNodeEnv() === 'production' ? 'none' : 'lax',
      maxAge: parseDuration(this.configService.jwtConfig.refreshExpiresIn),
      path: '/',
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
      'Verify a Google ID-token credential server-side, then sign in the matching parent — ' +
      'logging in a returning Google user, auto-linking to an existing account by verified email, ' +
      'or creating a new Parent account — and issue the standard user session.',
  })
  async googleSignIn(
    @Body() googleSignInDto: GoogleSignInDto,
    @Res({ passthrough: true }) response: Response,
    @Req() request: Request
  ) {
    // 1. Verify the Google credential server-side. verifyIdToken validates the
    //    signature, audience (our client ID), issuer and expiry; we only assert
    //    the application-level claims below.
    const payload = await this.googleTokenVerifier.verify(googleSignInDto.credential)

    // 2. Security gate: only trust a Google-VERIFIED email. This MUST run before
    //    the email-match link branch below — otherwise an attacker could register
    //    a Google account claiming a victim's (unverified) email and link into it.
    if (!payload.email_verified) {
      throw new UnauthorizedException('Google email not verified')
    }
    if (!payload.email || !payload.sub) {
      throw new UnauthorizedException('Google account is missing an email')
    }

    const email = payload.email.toLowerCase()
    const providerAccountId = payload.sub
    const firstName = payload.given_name ?? null
    const lastName = payload.family_name ?? null
    const picture = payload.picture

    // 3. Resolve the user: find-by-google-account → link-by-verified-email → create.
    //    The DB unique constraints (User.email and the UserAccount composite) are
    //    the real serialization point under concurrent first-time logins, so we
    //    tolerate a lost create race by catching P2002 and re-resolving once.
    let userId: string
    try {
      userId = await this.resolveGoogleUser(email, providerAccountId, firstName, lastName)
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        userId = await this.resolveGoogleUser(email, providerAccountId, firstName, lastName)
      } else {
        throw error
      }
    }

    // 4. Best-effort: import the Google avatar for users that have no photo yet.
    //    Must never block or fail sign-in (see helper).
    await this.importGooglePhotoBestEffort(userId, picture)

    // 5. Issue the standard user session (same cookies/JWT as email login).
    const fullUser = await this.authService.validateUser(userId)
    await this.createAuthenticatedSession(fullUser, request, response, 'user')

    return ResponseUtil.success({ user: fullUser })
  }

  /**
   * Find-or-link-or-create the parent User for a verified Google identity.
   * Returns the resolved user id. Throws Prisma P2002 if it loses a concurrent
   * create/link race — the caller re-invokes once, by which point the winning
   * request's row is visible and resolution falls through to a plain login.
   */
  private async resolveGoogleUser(
    email: string,
    providerAccountId: string,
    firstName: string | null,
    lastName: string | null
  ): Promise<string> {
    // a. Returning Google user — matched by provider account id.
    const account = await this.prisma.userAccount.findUnique({
      where: {
        authProvider_authProviderAccountId: {
          authProvider: 'google',
          authProviderAccountId: providerAccountId,
        },
      },
      select: { userId: true },
    })
    if (account) {
      return account.userId
    }

    const parentRole = await this.prisma.role.findFirst({
      where: { name: 'Parent', isSystemRole: true },
      select: { id: true },
    })
    if (!parentRole) {
      throw new Error('Parent role not found in system')
    }

    // b. Existing account with the same Google-verified email — auto-link.
    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        emailVerified: true,
        roles: { select: { role: { select: { name: true } } } },
        parentProfile: { select: { id: true } },
      },
    })

    if (existing) {
      const hasParentRole = existing.roles.some(ur => ur.role.name === 'Parent')
      await this.prisma.$transaction(async tx => {
        await tx.userAccount.create({
          data: {
            userId: existing.id,
            type: 'oauth',
            authProvider: 'google',
            authProviderAccountId: providerAccountId,
          },
        })
        // The email is Google-verified, so confirm it on our side if it wasn't.
        if (!existing.emailVerified) {
          await tx.user.update({
            where: { id: existing.id },
            data: { emailVerified: true, emailVerifiedAt: new Date() },
          })
        }
        if (!hasParentRole) {
          await tx.userRole.create({ data: { userId: existing.id, roleId: parentRole.id } })
        }
        if (!existing.parentProfile) {
          await tx.parent.create({ data: { userId: existing.id } })
        }
      })
      return existing.id
    }

    // c. Brand-new user — Google has verified the email, so create it pre-verified.
    const created = await this.prisma.$transaction(async tx => {
      const newUser = await tx.user.create({
        data: {
          email,
          firstName,
          lastName,
          passwordHash: null, // OAuth users have no password
          emailVerified: true,
          emailVerifiedAt: new Date(),
        },
        select: { id: true },
      })
      await tx.userAccount.create({
        data: {
          userId: newUser.id,
          type: 'oauth',
          authProvider: 'google',
          authProviderAccountId: providerAccountId,
        },
      })
      await tx.parent.create({ data: { userId: newUser.id } })
      await tx.userRole.create({ data: { userId: newUser.id, roleId: parentRole.id } })
      return newUser
    })
    return created.id
  }

  /**
   * Best-effort import of a Google profile picture into our own Azure storage so
   * it serves through the standard SAS pipeline. Only runs for users without a
   * photo (new accounts, or linked accounts with none) — never overwrites a
   * user's existing/edited photo. A slow or failed fetch must never block or fail
   * sign-in, so all errors are swallowed with a warning.
   */
  private async importGooglePhotoBestEffort(
    userId: string,
    pictureUrl: string | undefined
  ): Promise<void> {
    if (!pictureUrl) return

    try {
      const current = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { profilePhotoUrl: true },
      })
      if (current?.profilePhotoUrl) return

      // Request a larger render than Google's default ~96px thumbnail.
      const url = pictureUrl.replace(/=s\d+-c$/, '=s256-c')

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)
      try {
        const res = await fetch(url, { signal: controller.signal })
        if (!res.ok) return

        const mimetype = (res.headers.get('content-type') ?? 'image/jpeg')
          .split(';')[0]
          .trim()
          .toLowerCase()
        const ext =
          { 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[
            mimetype
          ] ?? 'jpg'
        const buffer = Buffer.from(await res.arrayBuffer())

        const uploadResult = await this.profilePhotoService.uploadPhoto(userId, {
          buffer,
          originalname: `profile-photo.${ext}`,
          mimetype,
          size: buffer.length,
        })

        await this.prisma.user.update({
          where: { id: userId },
          data: { profilePhotoUrl: uploadResult.url },
        })
      } finally {
        clearTimeout(timeout)
      }
    } catch (error) {
      this.logger.warn(
        `Failed to import Google profile photo for user ${userId}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`
      )
    }
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

    // Decode refresh token to extract sessionId
    let sessionId: string | undefined
    try {
      const decoded = this.jwtService.verify(refreshToken, {
        secret: this.configService.jwtConfig.refreshSecret,
      })
      sessionId = decoded.sessionId
    } catch {
      throw new UnauthorizedException('Invalid refresh token')
    }

    const result = await this.authService.refreshToken(refreshToken)

    // Verify user still has Parent role
    const user = result.user
    const hasParentRole = user.roles?.some((role: any) => role.name === 'Parent')

    if (!hasParentRole) {
      throw new UnauthorizedException('Access denied. Parent role required.')
    }

    // Generate app-specific tokens with 'user' claim and PRESERVE sessionId
    const appTokens = this.authService.generateTokensFromUser(user, 'user', sessionId)

    // Set HTTP-only cookies for tokens with app-specific names
    response.cookie('wc_user_access_token', appTokens.accessToken, {
      httpOnly: true,
      secure: this.configService.getNodeEnv() === 'production',
      sameSite: this.configService.getNodeEnv() === 'production' ? 'none' : 'lax',
      maxAge: parseDuration(this.configService.jwtConfig.expiresIn),
      path: '/',
    })

    response.cookie('wc_user_refresh_token', appTokens.refreshToken, {
      httpOnly: true,
      secure: this.configService.getNodeEnv() === 'production',
      sameSite: this.configService.getNodeEnv() === 'production' ? 'none' : 'lax',
      maxAge: parseDuration(this.configService.jwtConfig.refreshExpiresIn),
      path: '/',
    })

    // If authUsingRequest is enabled, also send tokens in headers
    if (this.configService.jwtConfig.authUsingRequest) {
      response.setHeader('x-access-token', appTokens.accessToken)
      response.setHeader('x-refresh-token', appTokens.refreshToken)
    }

    return ResponseUtil.success({
      user: result.user,
      expiresIn: appTokens.expiresIn,
      accessToken: appTokens.accessToken,
    })
  }

  @Get('profile')
  @ApiOperation({
    summary: 'Get current user profile',
    description: 'Get the profile of the currently authenticated parent user',
  })
  async getProfile(@CurrentUser() user: any) {
    // Verify user has Parent role
    const hasParentRole = user.roles?.some((role: any) => role.name === 'Parent')

    if (!hasParentRole) {
      throw new UnauthorizedException('Access denied. Parent role required.')
    }

    // Fetch full user profile with passwordChangedAt
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        bio: true,
        emailVerified: true,
        passwordChangedAt: true,
        passwordHash: true, // used only to derive `hasPassword` below — never returned
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
              },
            },
          },
        },
        parentProfile: {
          select: {
            id: true,
            primaryNationality: true,
            secondaryNationality: true,
            languages: true,
            profileCompletion: true,
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
    // Contact fields (phone, address, etc.) are now on User; parent only has nationality/languages
    const fullUser = {
      id: dbUser.id,
      email: dbUser.email,
      firstName: dbUser.firstName,
      lastName: dbUser.lastName,
      bio: dbUser.bio ?? null,
      emailVerified: dbUser.emailVerified,
      passwordChangedAt: dbUser.passwordChangedAt,
      hasPassword: !!dbUser.passwordHash, // false for OAuth-only users (no password set)
      createdAt: dbUser.createdAt,
      updatedAt: dbUser.updatedAt,
      profilePhotoUrl: profilePhotoUrl, // Use SAS URL for secure access
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
      })),
      permissions: user.permissions || [], // Use permissions from JWT payload
      parent: dbUser.parentProfile, // Only nationality and languages for Parent users
    }

    return ResponseUtil.success(fullUser)
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

    // Update user basic information and contact fields (now on User model)
    const userUpdateData: any = {}
    if (updateProfileDto.firstName !== undefined) {
      userUpdateData.firstName = updateProfileDto.firstName
    }
    if (updateProfileDto.lastName !== undefined) {
      userUpdateData.lastName = updateProfileDto.lastName
    }
    if (updateProfileDto.bio !== undefined) {
      const trimmed = updateProfileDto.bio.trim()
      userUpdateData.bio = trimmed.length > 0 ? trimmed : null
    }
    if (updateProfileDto.phone !== undefined) {
      userUpdateData.phone = updateProfileDto.phone
    }
    if (updateProfileDto.address !== undefined) {
      userUpdateData.address = updateProfileDto.address
    }
    if (updateProfileDto.city !== undefined) {
      userUpdateData.city = updateProfileDto.city
    }
    if (updateProfileDto.state !== undefined) {
      userUpdateData.state = updateProfileDto.state
    }
    if (updateProfileDto.postalCode !== undefined) {
      userUpdateData.postalCode = updateProfileDto.postalCode
    }
    if (updateProfileDto.country !== undefined) {
      userUpdateData.country = updateProfileDto.country
    }

    // Update parent profile (nationality, languages only - Parent-specific)
    const parentUpdateData: any = {}
    if (updateProfileDto.primaryNationality !== undefined) {
      parentUpdateData.primaryNationality = updateProfileDto.primaryNationality
    }
    if (updateProfileDto.secondaryNationality !== undefined) {
      parentUpdateData.secondaryNationality = updateProfileDto.secondaryNationality
    }
    if (updateProfileDto.languages !== undefined) {
      parentUpdateData.languages = updateProfileDto.languages
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

      // Update or create parent profile if there are changes (nationality/languages only)
      if (Object.keys(parentUpdateData).length > 0) {
        const existingParent = await tx.parent.findUnique({
          where: { userId: user.id },
        })

        if (existingParent) {
          await tx.parent.update({
            where: { userId: user.id },
            data: parentUpdateData,
          })
        } else {
          await tx.parent.create({
            data: {
              userId: user.id,
              ...parentUpdateData,
            },
          })
        }
      }
    })

    // Phase 7.5 (audit bug #4): recompute profile-completion so the
    // `Parent_Profile_Incomplete` reminder is gated against fresh state.
    await this.recomputeParentCompletionByUserId(user.id)

    // Fetch and return updated user profile
    const updatedUser = await this.authService.validateUser(user.id)

    return ResponseUtil.success(updatedUser)
  }

  @Patch('profile/photo')
  @UseInterceptors(FileInterceptor('photo'))
  @ApiOperation({
    summary: 'Upload profile photo',
    description: 'Upload a profile photo for the currently authenticated user',
  })
  async uploadProfilePhoto(@CurrentUser() user: any, @UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded')
    }

    // Upload photo to Azure Storage
    const uploadResult = await this.profilePhotoService.uploadPhoto(user.id, {
      buffer: file.buffer,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    })

    // Update user profile with new photo URL
    await this.prisma.user.update({
      where: { id: user.id },
      data: { profilePhotoUrl: uploadResult.url },
    })

    // Phase 7.5 (audit bug #4): photo upload moves the parent's score by
    // 10 points — recompute so the incomplete-profile cron stays honest.
    await this.recomputeParentCompletionByUserId(user.id)

    // Generate SAS URL for immediate display
    const sasUrl = await this.profilePhotoService.generatePhotoUrl(uploadResult.url)

    // Fetch and return updated user profile
    const updatedUser = await this.authService.validateUser(user.id)

    return ResponseUtil.success({
      ...updatedUser,
      profilePhotoUrl: sasUrl, // Return SAS URL for immediate display
    })
  }

  @Delete('profile/photo')
  @ApiOperation({
    summary: 'Delete profile photo',
    description: 'Delete the profile photo for the currently authenticated user',
  })
  async deleteProfilePhoto(@CurrentUser() user: any) {
    // Get current photo URL
    const userProfile = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { profilePhotoUrl: true },
    })

    if (!userProfile?.profilePhotoUrl) {
      throw new NotFoundException('No profile photo found')
    }

    // Delete photo from Azure Storage
    await this.profilePhotoService.deletePhoto(userProfile.profilePhotoUrl)

    // Update user profile to remove photo URL
    await this.prisma.user.update({
      where: { id: user.id },
      data: { profilePhotoUrl: null },
    })

    // Phase 7.5 (audit bug #4): photo delete drops the parent's score —
    // recompute so the incomplete-profile cron picks it up next cycle.
    await this.recomputeParentCompletionByUserId(user.id)

    // Fetch and return updated user profile
    const updatedUser = await this.authService.validateUser(user.id)

    return ResponseUtil.success(updatedUser)
  }

  @Post('email/change-request')
  @ApiOperation({
    summary: 'Request email change',
    description: 'Initiate email change process by sending verification email to new address',
  })
  @HttpCode(HttpStatus.OK)
  async requestEmailChange(
    @CurrentUser() user: any,
    @Body() dto: RequestEmailChangeDto
  ): Promise<any> {
    // Verify user has Parent role
    const hasParentRole = user.roles?.some((role: any) => role.name === 'Parent')
    if (!hasParentRole) {
      throw new UnauthorizedException('Access denied. Parent role required.')
    }

    // Check if new email is different from current
    if (dto.newEmail.toLowerCase() === user.email.toLowerCase()) {
      throw new BadRequestException('New email must be different from current email')
    }

    // Check if email is already in use
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.newEmail.toLowerCase() },
    })

    if (existingUser) {
      throw new ConflictException('Email address is already in use')
    }

    // TODO: Implement email verification service to send verification email
    // For now, return success message
    return ResponseUtil.success({
      message: 'Verification email sent. Please check your inbox and click the verification link.',
    })
  }

  @Post('email/verify')
  @ApiOperation({
    summary: 'Verify email change',
    description: 'Verify email change using token from verification email',
  })
  @HttpCode(HttpStatus.OK)
  verifyEmailChange(@Body() _dto: VerifyEmailChangeDto): any {
    // TODO: Implement email verification logic
    // For now, return success message
    return ResponseUtil.success({
      message: 'Email verified successfully',
    })
  }

  @Post('phone/change-request')
  @ApiOperation({
    summary: 'Request phone change',
    description: 'Initiate phone change process by sending SMS verification code',
  })
  @HttpCode(HttpStatus.OK)
  async requestPhoneChange(
    @CurrentUser() user: any,
    @Body() dto: RequestPhoneChangeDto
  ): Promise<any> {
    // Verify user has Parent role
    const hasParentRole = user.roles?.some((role: any) => role.name === 'Parent')
    if (!hasParentRole) {
      throw new UnauthorizedException('Access denied. Parent role required.')
    }

    // Update phone number on User (unverified)
    // Phone number is already in E.164 format (e.g., "+41791234567")
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        phone: dto.phoneNumber,
        phoneVerified: false,
      },
    })

    // Phase 7.5 (audit bug #4): adding/changing phone tips the basic-
    // contact 40-pt slice — recompute so the incomplete-profile cron
    // stops nagging once all three of firstName/lastName/phone are set.
    await this.recomputeParentCompletionByUserId(user.id)

    // TODO: Implement SMS service to send verification code
    // For now, return success message
    return ResponseUtil.success({
      message: 'Verification code sent via SMS. Please check your phone.',
    })
  }

  @Post('phone/verify')
  @ApiOperation({
    summary: 'Verify phone change',
    description: 'Verify phone change using SMS verification code',
  })
  @HttpCode(HttpStatus.OK)
  async verifyPhoneChange(
    @CurrentUser() user: any,
    @Body() _dto: VerifyPhoneChangeDto
  ): Promise<any> {
    // Verify user has Parent role
    const hasParentRole = user.roles?.some((role: any) => role.name === 'Parent')
    if (!hasParentRole) {
      throw new UnauthorizedException('Access denied. Parent role required.')
    }

    // TODO: Implement SMS verification code validation
    // For now, mark phone as verified on User
    await this.prisma.user.update({
      where: { id: user.id },
      data: { phoneVerified: true },
    })

    return ResponseUtil.success({
      message: 'Phone number verified successfully',
    })
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

    const result = await this.authService.changePassword(user.id, changePasswordDto)

    return ResponseUtil.success(result)
  }

  @Post('set-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Set initial password',
    description:
      'Set an initial password for a passwordless (e.g. Google OAuth) parent user. No current ' +
      'password is required because none exists; rejected if a password is already set.',
  })
  async setPassword(@CurrentUser() user: any, @Body() setPasswordDto: SetPasswordDto) {
    // Verify user has Parent role
    const hasParentRole = user.roles?.some((role: any) => role.name === 'Parent')

    if (!hasParentRole) {
      throw new UnauthorizedException('Access denied. Parent role required.')
    }

    const result = await this.authService.setPassword(user.id, setPasswordDto.newPassword)

    return ResponseUtil.success(result)
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Logout',
    description: 'Clear authentication cookies and logout the parent user',
  })
  logout(@Res({ passthrough: true }) response: Response) {
    // Clear app-specific cookies (path must match what was set on login)
    response.clearCookie('wc_user_access_token', { path: '/' })
    response.clearCookie('wc_user_refresh_token', { path: '/' })

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

  /**
   * Get 2FA status
   */
  @Get('two-factor/status')
  @ApiOperation({
    summary: 'Get two-factor authentication status',
    description: 'Get the current 2FA status for the authenticated user',
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
    description: 'Enable email-based two-factor authentication for the user',
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
    description: 'Disable two-factor authentication for the user',
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
    description: 'Send a verification code to the user email for 2FA login',
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
    description: 'Verify the 2FA code sent to user email, create session, and return JWT tokens',
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

    // Verify user has Parent role
    const hasParentRole = user.roles?.some((role: any) => role.name === 'Parent')

    if (!hasParentRole) {
      throw new UnauthorizedException('Access denied. Parent role required.')
    }

    // Create session record
    const userAgent = request.headers['user-agent']
    const ipAddress = request.ip

    const sessionId = await this.sessionManagementService.createSession(
      user.id,
      userAgent,
      ipAddress
    )

    // Generate app-specific tokens with 'user' claim and sessionId
    const appTokens = this.authService.generateTokensFromUser(user, 'user', sessionId)

    // Set HTTP-only cookies for tokens with app-specific names
    response.cookie('wc_user_access_token', appTokens.accessToken, {
      httpOnly: true,
      secure: this.configService.getNodeEnv() === 'production',
      sameSite: this.configService.getNodeEnv() === 'production' ? 'none' : 'lax',
      maxAge: parseDuration(this.configService.jwtConfig.expiresIn),
      path: '/',
    })

    response.cookie('wc_user_refresh_token', appTokens.refreshToken, {
      httpOnly: true,
      secure: this.configService.getNodeEnv() === 'production',
      sameSite: this.configService.getNodeEnv() === 'production' ? 'none' : 'lax',
      maxAge: parseDuration(this.configService.jwtConfig.refreshExpiresIn),
      path: '/',
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
    description: 'Get all active sessions for the current user',
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
