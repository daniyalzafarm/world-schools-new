import {
  Body,
  ConflictException,
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
import { PrismaService } from '../../../prisma/prisma.service'
import { Public } from '../../core/auth/decorators/public.decorator'
import { RegisterProviderDto } from './dto/register.dto'
import { ProviderLoginDto } from './dto/login.dto'
import { ResponseUtil } from '../../../common/utils/response.util'
import { ConfigService } from '../../../config/config.service'
import * as bcrypt from 'bcryptjs'

@ApiTags('Provider Auth')
@Controller('provider/auth')
export class ProviderAuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService
  ) {}

  @Public()
  @Post('register')
  @ApiOperation({
    summary: 'Register new provider owner',
    description: 'Create a new user account, provider record, and assign Provider Admin role',
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

    return ResponseUtil.success({
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
      },
      provider: {
        id: result.provider.id,
        name: result.provider.name,
      },
    })
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Provider login',
    description:
      'Authenticate provider user and return JWT tokens. User must have Provider Admin role or provider-specific custom role.',
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
      throw new UnauthorizedException(
        'Access denied. Provider Admin role or provider-specific role required.'
      )
    }

    // Set HTTP-only cookies for tokens
    const accessTokenExpiry = this.configService.getJwtExpiresIn()
    const refreshTokenExpiry = this.configService.getJwtRefreshExpiresIn()

    response.cookie('access_token', result.accessToken, {
      httpOnly: true,
      secure: this.configService.getNodeEnv() === 'production',
      sameSite: 'strict',
      maxAge: this.parseDuration(accessTokenExpiry),
    })

    response.cookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: this.configService.getNodeEnv() === 'production',
      sameSite: 'strict',
      maxAge: this.parseDuration(refreshTokenExpiry),
    })

    return ResponseUtil.success(result)
  }

  private parseDuration(duration: string): number {
    const match = duration.match(/^(\d+)([smhd])$/)
    if (!match) return 900000 // Default 15 minutes

    const value = parseInt(match[1], 10)
    const unit = match[2] as 's' | 'm' | 'h' | 'd'

    const multipliers: Record<'s' | 'm' | 'h' | 'd', number> = {
      s: 1000,
      m: 60000,
      h: 3600000,
      d: 86400000,
    }

    return value * multipliers[unit]
  }
}
