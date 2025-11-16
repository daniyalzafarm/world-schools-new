import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common'
import { Response } from 'express'
import { AuthService } from './auth.service'
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RefreshTokenDto,
  RegisterDto,
  ResetPasswordDto,
} from './dto/auth.dto'
import { Public } from './decorators/public.decorator'
import { CurrentUser } from './decorators/current-user.decorator'
import { JwtAuthGuard } from './guards/jwt-auth.guard'
import { ConfigService } from '../../../config/config.service'
import { parseDuration } from '../../../common/helpers'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService
  ) {}

  @Public()
  @Post('register')
  async register(@Body() registerDto: RegisterDto, @Res({ passthrough: true }) response: Response) {
    const authResult = await this.authService.register(registerDto)

    // Set HTTP-only cookies
    response.cookie('access_token', authResult.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: parseDuration(this.configService.jwtConfig.expiresIn),
    })

    response.cookie('refresh_token', authResult.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: parseDuration(this.configService.jwtConfig.refreshExpiresIn),
    })

    // If authUsingRequest is enabled, also send tokens in headers
    if (this.configService.jwtConfig.authUsingRequest) {
      response.setHeader('x-access-token', authResult.accessToken)
      response.setHeader('x-refresh-token', authResult.refreshToken)
    }

    return {
      message: 'Registration successful',
      user: authResult.user,
    }
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto, @Res({ passthrough: true }) response: Response) {
    const authResult = await this.authService.login(loginDto)

    // Set HTTP-only cookies
    response.cookie('access_token', authResult.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: parseDuration(this.configService.jwtConfig.expiresIn),
    })

    response.cookie('refresh_token', authResult.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: parseDuration(this.configService.jwtConfig.refreshExpiresIn),
    })

    // If authUsingRequest is enabled, also send tokens in headers
    if (this.configService.jwtConfig.authUsingRequest) {
      response.setHeader('x-access-token', authResult.accessToken)
      response.setHeader('x-refresh-token', authResult.refreshToken)
    }

    return {
      message: 'Login successful',
      user: authResult.user,
    }
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshToken(
    @Body() refreshTokenDto: RefreshTokenDto,
    @Res({ passthrough: true }) response: Response
  ) {
    // Try to get refresh token from cookie first, then from body
    const refreshToken: string =
      (response as any).req?.cookies?.refresh_token ?? refreshTokenDto?.refreshToken

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not provided')
    }

    const authResult = await this.authService.refreshToken(refreshToken)

    // Set new HTTP-only cookies
    response.cookie('access_token', authResult.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: parseDuration(this.configService.jwtConfig.expiresIn),
    })

    response.cookie('refresh_token', authResult.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: parseDuration(this.configService.jwtConfig.refreshExpiresIn),
    })

    // If authUsingRequest is enabled, also send tokens in headers
    if (this.configService.jwtConfig.authUsingRequest) {
      response.setHeader('x-access-token', authResult.accessToken)
      response.setHeader('x-refresh-token', authResult.refreshToken)
    }

    return {
      message: 'Token refreshed successfully',
      user: authResult.user,
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@CurrentUser() user: any) {
    return user
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser('id') userId: string,
    @Body() changePasswordDto: ChangePasswordDto
  ): Promise<{ message: string }> {
    await this.authService.changePassword(userId, changePasswordDto)
    return { message: 'Password changed successfully' }
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto): Promise<{ message: string }> {
    return this.authService.forgotPassword(forgotPasswordDto)
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto): Promise<{ message: string }> {
    return await this.authService.resetPassword(resetPasswordDto)
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) response: Response): { message: string } {
    // Clear HTTP-only cookies
    response.clearCookie('access_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    })

    response.clearCookie('refresh_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    })

    // If authUsingRequest is enabled, clear tokens from headers
    if (this.configService.jwtConfig.authUsingRequest) {
      response.setHeader('x-access-token', '')
      response.setHeader('x-refresh-token', '')
    }

    return { message: 'Logged out successfully' }
  }
}
