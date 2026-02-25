import { ApiProperty } from '@nestjs/swagger'
import { IsArray, IsOptional, IsString } from 'class-validator'

export class UpdateProfileDto {
  @ApiProperty({
    description: 'First name',
    example: 'John',
    required: false,
  })
  @IsString()
  @IsOptional()
  firstName?: string

  @ApiProperty({
    description: 'Last name',
    example: 'Doe',
    required: false,
  })
  @IsString()
  @IsOptional()
  lastName?: string

  @ApiProperty({
    description: 'Parent phone number',
    example: '+1-555-123-4567',
    required: false,
  })
  @IsString()
  @IsOptional()
  phone?: string

  @ApiProperty({
    description: 'Parent address',
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
    description: 'Primary nationality',
    example: 'American',
    required: false,
  })
  @IsString()
  @IsOptional()
  primaryNationality?: string

  @ApiProperty({
    description: 'Secondary nationality',
    example: 'British',
    required: false,
  })
  @IsString()
  @IsOptional()
  secondaryNationality?: string

  @ApiProperty({
    description: 'Languages spoken',
    example: ['English', 'French', 'Spanish'],
    required: false,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  languages?: string[]

  @ApiProperty({
    description: 'Profile photo URL',
    example: 'https://example.com/photos/user-123.jpg',
    required: false,
  })
  @IsString()
  @IsOptional()
  profilePhotoUrl?: string
}
