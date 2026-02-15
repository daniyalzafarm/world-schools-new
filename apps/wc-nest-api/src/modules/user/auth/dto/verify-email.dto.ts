import { ApiProperty } from '@nestjs/swagger'
import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator'

export class UserVerifyEmailDto {
  @ApiProperty({
    description: 'Email address to verify',
    example: 'parent@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string

  @ApiProperty({
    description: '6-digit verification code',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  code: string
}

export class UserResendVerificationCodeDto {
  @ApiProperty({
    description: 'Email address to resend verification code to',
    example: 'parent@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string
}
