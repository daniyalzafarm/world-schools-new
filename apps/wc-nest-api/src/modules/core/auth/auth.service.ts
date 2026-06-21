import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { AzureStorageService } from '@world-schools/wc-utils/backend'
import { PrismaService } from '../../../prisma/prisma.service'
import { ConfigService } from '../../../config/config.service'
import * as bcrypt from 'bcryptjs'
import {
  AuthResponseDto,
  ChangePasswordDto,
  ForgotPasswordDto,
  JwtPayload,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
} from './dto/auth.dto'

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)
  private azureStorage: AzureStorageService | null = null

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService
  ) {}

  private getAzureStorage(): AzureStorageService | null {
    if (!this.azureStorage) {
      const config = this.configService.azureStorageConfig
      if (!config.accountName || !config.accountKey || !config.containerName) {
        return null
      }
      this.azureStorage = new AzureStorageService(config)
    }
    return this.azureStorage
  }

  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    const { email, password, firstName, lastName } = registerDto

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      throw new ConflictException('User with this email already exists')
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(
      password,
      this.configService.jwtConfig.bcryptSaltRounds
    )

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash: hashedPassword,
        firstName,
        lastName,
      },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
        parentProfile: true,
        ownedProvider: {
          select: {
            id: true,
          },
        },
      },
    })

    // Generate tokens
    const tokens = this.generateTokensFromUser(user)

    return {
      ...tokens,
      user: await this.buildUserResponse(user),
    }
  }

  /**
   * Stamp `Provider.lastLoginAt = now` for every provider the user is
   * associated with (as owner or via a provider-scoped role). Powers the
   * SuperAdmin Inactive operational state (BUG-107) which keys on
   * `lastLoginAt < now - 90d`.
   *
   * Fire-and-forget by design — failures are logged but never surfaced to
   * the auth caller, because the underlying login has already succeeded
   * and we don't want a transient Prisma blip to lock a user out.
   */
  async recordProviderLastLogin(userId: string): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          ownedProvider: { select: { id: true } },
          roles: { select: { role: { select: { providerId: true } } } },
        },
      })
      if (!user) return

      const providerIds = new Set<string>()
      if (user.ownedProvider?.id) providerIds.add(user.ownedProvider.id)
      for (const ur of user.roles) {
        if (ur.role.providerId) providerIds.add(ur.role.providerId)
      }
      if (providerIds.size === 0) return

      await this.prisma.provider.updateMany({
        where: { id: { in: Array.from(providerIds) } },
        data: { lastLoginAt: new Date() },
      })
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      this.logger.warn(`Failed to record provider lastLoginAt for user ${userId}: ${msg}`)
    }
  }

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const { email, password } = loginDto

    // Find user with roles and permissions
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
        parentProfile: true,
        ownedProvider: {
          select: {
            id: true,
          },
        },
      },
    })

    if (!user) {
      // Use BadRequestException instead of UnauthorizedException for invalid credentials
      // This prevents the API client from triggering automatic token refresh
      throw new BadRequestException('Invalid credentials')
    }

    // Check if user has a password set
    if (!user.passwordHash) {
      throw new BadRequestException('Invalid credentials')
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash)
    if (!isPasswordValid) {
      throw new BadRequestException('Invalid credentials')
    }

    // Generate tokens
    const tokens = this.generateTokensFromUser(user)

    return {
      ...tokens,
      user: await this.buildUserResponse(user),
    }
  }

  async refreshToken(refreshToken: string): Promise<
    AuthResponseDto & {
      impersonatedBy?: { id: string; email: string; name: string }
      impersonationProviderId?: string
    }
  > {
    try {
      const payload: JwtPayload = this.jwtService.verify(refreshToken, {
        secret: this.configService.jwtConfig.refreshSecret,
      })

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: {
          roles: {
            include: {
              role: {
                include: {
                  permissions: {
                    include: {
                      permission: true,
                    },
                  },
                },
              },
            },
          },
          parentProfile: true,
          ownedProvider: {
            select: {
              id: true,
            },
          },
        },
      })

      if (!user) {
        throw new UnauthorizedException('Invalid refresh token')
      }

      // Preserve impersonation claims so the refreshed tokens don't silently demote the
      // session to a regular provider session when a superadmin is impersonating.
      const tokens = this.generateTokensFromUser(
        user,
        undefined,
        undefined,
        payload.impersonatedBy,
        payload.impersonationProviderId
      )

      return {
        ...tokens,
        user: await this.buildUserResponse(user),
        ...(payload.impersonatedBy && { impersonatedBy: payload.impersonatedBy }),
        ...(payload.impersonationProviderId && {
          impersonationProviderId: payload.impersonationProviderId,
        }),
      }
    } catch {
      throw new UnauthorizedException('Invalid refresh token')
    }
  }

  async changePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto
  ): Promise<{ passwordChangedAt: Date }> {
    const { oldPassword, newPassword } = changePasswordDto

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      throw new NotFoundException('User not found')
    }

    // Check if user has a password set
    if (!user.passwordHash) {
      throw new BadRequestException('User does not have a password set')
    }

    // Verify old password
    const isOldPasswordValid = await bcrypt.compare(oldPassword, user.passwordHash)
    if (!isOldPasswordValid) {
      throw new BadRequestException('Invalid old password')
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(
      newPassword,
      this.configService.jwtConfig.bcryptSaltRounds
    )

    // Update password AND passwordChangedAt
    const passwordChangedAt = new Date()
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: hashedNewPassword,
        passwordChangedAt,
      },
    })

    return { passwordChangedAt }
  }

  /**
   * Set an INITIAL password for a passwordless (e.g. Google OAuth) user.
   * Unlike changePassword there is no old password to verify because none exists —
   * the caller is already authenticated and their email is provider-verified. Gated
   * to `passwordHash === null` so it can never overwrite an existing password (that
   * still requires changePassword with the old one).
   */
  async setPassword(userId: string, newPassword: string): Promise<{ passwordChangedAt: Date }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      throw new NotFoundException('User not found')
    }

    if (user.passwordHash) {
      throw new BadRequestException('Password already set. Use change password instead.')
    }

    const passwordHash = await bcrypt.hash(
      newPassword,
      this.configService.jwtConfig.bcryptSaltRounds
    )

    const passwordChangedAt = new Date()
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        passwordChangedAt,
      },
    })

    return { passwordChangedAt }
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto): Promise<{ message: string }> {
    const { email } = forgotPasswordDto

    const user = await this.prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      // Don't reveal if user exists or not
      return { message: 'If the email exists, a reset link has been sent' }
    }

    // Generate reset token (valid for 1 hour)
    const _resetToken = this.jwtService.sign(
      { sub: user.id, type: 'password-reset' },
      {
        secret: this.configService.jwtConfig.secret,
        expiresIn: '1h',
      }
    )

    // TODO: Send email with reset token

    return { message: 'If the email exists, a reset link has been sent' }
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<{ message: string }> {
    const { token, newPassword } = resetPasswordDto

    try {
      const payload = this.jwtService.verify(token, {
        secret: this.configService.jwtConfig.secret,
      })

      if (payload.type !== 'password-reset') {
        throw new UnauthorizedException('Invalid reset token')
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      })

      if (!user) {
        throw new UnauthorizedException('Invalid reset token')
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(
        newPassword,
        this.configService.jwtConfig.bcryptSaltRounds
      )

      // Update password
      await this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: hashedPassword },
      })

      return { message: 'Password reset successful' }
    } catch {
      throw new UnauthorizedException('Invalid or expired reset token')
    }
  }

  /**
   * Build user response object with permissions
   */
  private async buildUserResponse(user: any) {
    const roles =
      user.roles?.map((ur: any) => ({
        id: ur.role.id,
        name: ur.role.name,
        providerId: ur.role.providerId ?? null,
        isSystemRole: ur.role.isSystemRole ?? false,
      })) ?? []

    const permissions =
      user.roles?.flatMap(
        (ur: any) => ur.role.permissions?.map((rp: any) => rp.permission.id) ?? []
      ) ?? []

    let profilePhotoUrl: string | null = user.profilePhotoUrl ?? null
    if (profilePhotoUrl) {
      const azureStorage = this.getAzureStorage()
      if (azureStorage) {
        try {
          profilePhotoUrl = await azureStorage.generateSasUrl(profilePhotoUrl, 24)
        } catch (error) {
          this.logger.warn(`Failed to generate SAS URL for profile photo: ${error}`)
        }
      }
    }

    const response: any = {
      id: user.id,
      email: user.email,
      firstName: user.firstName ?? undefined,
      lastName: user.lastName ?? undefined,
      bio: user.bio ?? null,
      profilePhotoUrl,
      phone: user.phone ?? null,
      phoneVerified: user.phoneVerified ?? false,
      address: user.address ?? null,
      city: user.city ?? null,
      state: user.state ?? null,
      postalCode: user.postalCode ?? null,
      country: user.country ?? null,
      roles,
      permissions,
    }

    // Include provider ID. Owners get it from their owned provider; members (sub-users) get it
    // from their provider-scoped role, so role-based provider users resolve the same providerId
    // as the owner and can use the provider portal.
    if (user.ownedProvider) {
      response.providerId = user.ownedProvider.id
    } else {
      const providerRole = roles.find((r: any) => r.providerId)
      if (providerRole) {
        response.providerId = providerRole.providerId
      }
    }

    // Include parent profile (nationality, languages only - Parent-specific)
    if (user.parentProfile) {
      response.parent = {
        id: user.parentProfile.id,
        primaryNationality: user.parentProfile.primaryNationality ?? null,
        secondaryNationality: user.parentProfile.secondaryNationality ?? null,
        languages: user.parentProfile.languages ?? [],
      }
    }

    return response
  }

  async validateUser(userId: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
        parentProfile: true,
        ownedProvider: {
          select: {
            id: true,
          },
        },
      },
    })

    if (!user) {
      throw new NotFoundException('User not found')
    }

    return await this.buildUserResponse(user)
  }

  generateTokens(payload: JwtPayload): {
    access_token: string
    refresh_token: string
    expiresIn: number
  } {
    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.jwtConfig.secret,
      expiresIn: this.configService.jwtConfig.expiresIn as any,
    })

    const refreshToken = this.jwtService.sign(
      { sub: payload.sub, app: payload.app },
      {
        secret: this.configService.jwtConfig.refreshSecret,
        expiresIn: this.configService.jwtConfig.refreshExpiresIn as any,
      }
    )

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expiresIn: 15 * 60, // 15 minutes in seconds
    }
  }

  generateTokensFromUser(
    user: any,
    app?: 'superadmin' | 'provider' | 'user',
    sessionId?: string,
    impersonatedBy?: { id: string; email: string; name: string },
    impersonationProviderId?: string
  ): {
    accessToken: string
    refreshToken: string
    expiresIn: number
  } {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      app,
      sessionId,
      ...(impersonatedBy && { impersonatedBy }),
      ...(impersonationProviderId && { impersonationProviderId }),
    }

    const tokens = this.generateTokens(payload)

    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresIn: tokens.expiresIn,
    }
  }

  /**
   * Full provider-admin permission set — the permission ids held by the seeded 'Provider Admin'
   * system role (kept in sync with the entire provider context). Used to grant an impersonating
   * superadmin complete provider-app access regardless of the impersonated owner's own role
   * configuration. Provider scoping comes from the impersonated user being the provider owner.
   */
  async getProviderAdminPermissions(): Promise<string[]> {
    const role = await this.prisma.role.findFirst({
      where: { name: 'Provider Admin', isSystemRole: true, providerId: null },
      include: {
        permissions: { select: { permissionId: true } },
      },
    })
    return role?.permissions.map(rp => rp.permissionId) ?? []
  }
}
