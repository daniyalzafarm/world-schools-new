import { ApiProperty } from '@nestjs/swagger'
import { IsEmail, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator'

export class CreateProviderDto {
  @ApiProperty({
    description: 'Provider (school/organization) name',
    example: 'World Schools Academy',
  })
  @IsString()
  @IsNotEmpty()
  name: string

  @ApiProperty({
    description: 'Owner user ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsNotEmpty()
  ownerId: string

  @ApiProperty({
    description: 'Provider address',
    example: '123 Main Street',
    required: false,
  })
  @IsString()
  @IsOptional()
  address?: string

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
  postal_code?: string

  @ApiProperty({
    description: 'Country',
    example: 'United States',
    required: false,
  })
  @IsString()
  @IsOptional()
  country?: string

  @ApiProperty({
    description: 'Phone number',
    example: '+1-555-123-4567',
    required: false,
  })
  @IsString()
  @IsOptional()
  phone?: string

  @ApiProperty({
    description: 'Email address',
    example: 'contact@worldschoolsacademy.com',
    required: false,
  })
  @IsEmail()
  @IsOptional()
  email?: string

  @ApiProperty({
    description: 'Website URL',
    example: 'https://worldschoolsacademy.com',
    required: false,
  })
  @IsString()
  @IsOptional()
  website?: string
}
