import {
  Controller,
  Post,
  Body,
  UnauthorizedException,
  HttpCode,
  HttpStatus,
  Res,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { AuthService } from '../../core/auth/auth.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { Public } from '../../core/auth/decorators/public.decorator';
import { UserLoginDto } from './dto/login.dto';
import { GoogleSignInDto } from './dto/google-signin.dto';
import { ResponseUtil } from '../../../common/utils/response.util';
import { ConfigService } from '../../../config/config.service';

@ApiTags('User Auth')
@Controller('user/auth')
export class UserAuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Parent login',
    description:
      'Authenticate parent user and return JWT tokens. User must have Parent role.',
  })
  async login(
    @Body() loginDto: UserLoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    // Validate credentials using central AuthService
    const result = await this.authService.login(loginDto);

    // Verify user has Parent role
    const user = result.data.user;
    const hasParentRole = user.roles?.some((role) => role.name === 'Parent');

    if (!hasParentRole) {
      throw new UnauthorizedException(
        'Access denied. Parent role required.',
      );
    }

    // Set HTTP-only cookies for tokens
    const accessTokenExpiry = this.configService.getJwtExpiresIn();
    const refreshTokenExpiry = this.configService.getJwtRefreshExpiresIn();

    response.cookie('access_token', result.data.access_token, {
      httpOnly: true,
      secure: this.configService.getNodeEnv() === 'production',
      sameSite: 'strict',
      maxAge: this.parseDuration(accessTokenExpiry),
    });

    response.cookie('refresh_token', result.data.refresh_token, {
      httpOnly: true,
      secure: this.configService.getNodeEnv() === 'production',
      sameSite: 'strict',
      maxAge: this.parseDuration(refreshTokenExpiry),
    });

    return ResponseUtil.success(result.data, 'Parent login successful');
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
    @Res({ passthrough: true }) response: Response,
  ) {
    // Verify provider exists
    const provider = await this.prisma.provider.findUnique({
      where: { id: googleSignInDto.providerId },
    });

    if (!provider) {
      throw new NotFoundException('Provider not found');
    }

    // Find Parent role
    const parentRole = await this.prisma.role.findFirst({
      where: {
        name: 'Parent',
        isSystemRole: true,
      },
    });

    if (!parentRole) {
      throw new Error('Parent role not found in system');
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
    });

    let user: any;
    let parent: any;

    if (account) {
      // Existing user - return their data
      user = account.user;
      parent = user.parentProfile;

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
        });
      }
    } else {
      // New user - create user, account, parent profile, and assign role
      const result = await this.prisma.$transaction(async (tx) => {
        // Create user
        const newUser = await tx.user.create({
          data: {
            email: googleSignInDto.email,
            firstName: googleSignInDto.firstName,
            lastName: googleSignInDto.lastName,
            passwordHash: null, // OAuth users don't have password
          },
        });

        // Create user account
        await tx.userAccount.create({
          data: {
            userId: newUser.id,
            type: 'oauth',
            authProvider: 'google',
            authProviderAccountId: googleSignInDto.providerAccountId,
          },
        });

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
        });

        // Assign Parent role
        await tx.userRole.create({
          data: {
            userId: newUser.id,
            roleId: parentRole.id,
          },
        });

        return { user: newUser, parent: newParent };
      });

      user = result.user;
      parent = result.parent;
    }

    // Generate JWT tokens using AuthService
    const tokens = await this.authService.generateTokens({
      sub: user.id,
      email: user.email,
    });

    // Set HTTP-only cookies for tokens
    const accessTokenExpiry = this.configService.getJwtExpiresIn();
    const refreshTokenExpiry = this.configService.getJwtRefreshExpiresIn();

    response.cookie('access_token', tokens.access_token, {
      httpOnly: true,
      secure: this.configService.getNodeEnv() === 'production',
      sameSite: 'strict',
      maxAge: this.parseDuration(accessTokenExpiry),
    });

    response.cookie('refresh_token', tokens.refresh_token, {
      httpOnly: true,
      secure: this.configService.getNodeEnv() === 'production',
      sameSite: 'strict',
      maxAge: this.parseDuration(refreshTokenExpiry),
    });

    // Build response
    const authResponse = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: [{ name: 'Parent' }],
      },
      parent: {
        id: parent.id,
      },
    };

    return ResponseUtil.success(
      authResponse,
      'Google sign-in successful',
    );
  }

  private parseDuration(duration: string): number {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) return 900000; // Default 15 minutes

    const value = parseInt(match[1], 10);
    const unit = match[2];

    const multipliers = {
      s: 1000,
      m: 60000,
      h: 3600000,
      d: 86400000,
    };

    return value * multipliers[unit];
  }
}

