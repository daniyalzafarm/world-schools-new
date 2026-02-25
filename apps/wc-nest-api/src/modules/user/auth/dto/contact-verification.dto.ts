import { ApiProperty } from '@nestjs/swagger'
import { IsEmail, IsNotEmpty, IsString } from 'class-validator'

export class RequestEmailChangeDto {
  @ApiProperty({
    description: 'New email address',
    example: 'newemail@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  newEmail: string
}

export class VerifyEmailChangeDto {
  @ApiProperty({
    description: 'Email verification token',
    example: 'abc123xyz',
  })
  @IsString()
  @IsNotEmpty()
  token: string
}

export class RequestPhoneChangeDto {
  @ApiProperty({
    description: 'Phone number in E.164 format',
    example: '+41791234567',
  })
  @IsString()
  @IsNotEmpty()
  phoneNumber: string
}

export class VerifyPhoneChangeDto {
  @ApiProperty({
    description: 'SMS verification code',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty()
  code: string
}
