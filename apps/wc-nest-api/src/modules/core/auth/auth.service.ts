import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
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
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService
  ) {}

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
      user: this.buildUserResponse(user),
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
      user: this.buildUserResponse(user),
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
        user: this.buildUserResponse(user),
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
  private buildUserResponse(user: any) {
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

    const response: any = {
      id: user.id,
      email: user.email,
      firstName: user.firstName ?? undefined,
      lastName: user.lastName ?? undefined,
      bio: user.bio ?? null,
      profilePhotoUrl: user.profilePhotoUrl ?? null,
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

    // Include provider ID if user owns a provider
    if (user.ownedProvider) {
      response.providerId = user.ownedProvider.id
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

    return this.buildUserResponse(user)
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

  async getProviderAdminPermissions(providerId: string): Promise<string[]> {
    const role = await this.prisma.role.findFirst({
      where: { providerId, isSystemRole: true, name: 'Provider Admin' },
      include: {
        permissions: {
          include: { permission: true },
        },
      },
    })
    return role?.permissions.map((p: any) => p.permission.name) ?? []
  }
}
