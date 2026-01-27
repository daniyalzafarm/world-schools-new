import { ApiProperty } from '@nestjs/swagger'
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator'
import { IsStrongPassword } from '../../../../common/validators/is-strong-password.validator'

export class RegisterProviderDto {
  @ApiProperty({
    description: 'Email address',
    example: 'owner@schoolname.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string

  @ApiProperty({
    description:
      'Password - must be at least 8 characters and contain uppercase, lowercase, number, and special character',
    example: 'SecurePassword123!',
    minLength: 8,
  })
  @IsString()
  @IsNotEmpty()
  @IsStrongPassword()
  password: string

  @ApiProperty({
    description: 'First name',
    example: 'John',
  })
  @IsString()
  @IsNotEmpty()
  firstName: string

  @ApiProperty({
    description: 'Last name',
    example: 'Doe',
  })
  @IsString()
  @IsNotEmpty()
  lastName: string

  @ApiProperty({
    description: 'Job title',
    example: 'Camp Director',
  })
  @IsString()
  @IsNotEmpty()
  jobTitle: string

  @ApiProperty({
    description: 'Phone number in E.164 format',
    example: '+14165551234',
  })
  @IsString()
  @IsNotEmpty()
  phoneNumber: string
}
