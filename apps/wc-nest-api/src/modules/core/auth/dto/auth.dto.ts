import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'
import { IsStrongPassword } from '../../../../common/validators/is-strong-password.validator'

export class LoginDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(6)
  password: string
}

export class RegisterDto {
  @ApiProperty({ example: 'John' })
  @IsString()
  firstName: string

  @ApiProperty({ example: 'Doe' })
  @IsString()
  lastName: string

  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string

  @ApiProperty({ example: 'SecurePassword123!' })
  @IsString()
  @IsStrongPassword()
  password: string
}

export class RefreshTokenDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  @IsString()
  @IsOptional()
  refreshToken: string
}

export class ChangePasswordDto {
  @ApiProperty({ example: 'oldPassword123' })
  @IsString()
  oldPassword: string

  @ApiProperty({ example: 'NewSecurePassword123!' })
  @IsString()
  @IsStrongPassword()
  newPassword: string
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string
}

export class ResetPasswordDto {
  @ApiProperty({ example: 'reset-token-here' })
  @IsString()
  token: string

  @ApiProperty({ example: 'NewSecurePassword123!' })
  @IsString()
  @IsStrongPassword()
  newPassword: string
}

export class AuthResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken: string

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  refreshToken: string

  @ApiProperty({ example: 3600 })
  expiresIn: number

  @ApiProperty()
  user: {
    id: string
    email: string
    first_name?: string
    last_name?: string
    roles: Array<{
      id: string
      name: string
    }>
    permissions: string[]
  }
}

export class JwtPayload {
  sub: string // user id
  email: string
  app?: 'superadmin' | 'provider' | 'user' // app-specific claim for token isolation
  sessionId?: string // session ID for session management
  iat?: number
  exp?: number
}
