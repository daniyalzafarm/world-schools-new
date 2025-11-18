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
    description: 'Provider (school/organization) name',
    example: 'ABC International School',
  })
  @IsString()
  @IsNotEmpty()
  providerName: string

  @ApiProperty({
    description: 'Provider phone number',
    example: '+1-555-123-4567',
    required: false,
  })
  @IsString()
  @IsOptional()
  providerPhone?: string

  @ApiProperty({
    description: 'Provider email',
    example: 'contact@abcschool.com',
    required: false,
  })
  @IsEmail()
  @IsOptional()
  providerEmail?: string

  @ApiProperty({
    description: 'Provider address',
    example: '123 School Street',
    required: false,
  })
  @IsString()
  @IsOptional()
  providerAddress?: string

  @ApiProperty({
    description: 'City',
    example: 'New York',
    required: false,
  })
  @IsString()
  @IsOptional()
  city?: string

  @ApiProperty({
    description: 'State/Province',
    example: 'NY',
    required: false,
  })
  @IsString()
  @IsOptional()
  state?: string

  @ApiProperty({
    description: 'Postal code',
    example: '10001',
    required: false,
  })
  @IsString()
  @IsOptional()
  postalCode?: string

  @ApiProperty({
    description: 'Country',
    example: 'United States',
    required: false,
  })
  @IsString()
  @IsOptional()
  country?: string

  @ApiProperty({
    description: 'Website URL',
    example: 'https://abcschool.com',
    required: false,
  })
  @IsString()
  @IsOptional()
  website?: string
}
