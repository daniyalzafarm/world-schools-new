import { ApiProperty } from '@nestjs/swagger'
import { IsArray, IsIn, IsISO31661Alpha2, IsOptional, IsString, MaxLength } from 'class-validator'
import { LANGUAGE_CODES } from '@world-schools/wc-types'

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
    description: 'Short biography or about text',
    example: 'Parent of two campers; interested in STEM programs.',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  bio?: string

  @ApiProperty({
    description: 'Phone number',
    example: '+1-555-123-4567',
    required: false,
  })
  @IsString()
  @IsOptional()
  phone?: string

  @ApiProperty({
    description: 'Address',
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
    description: 'Country (ISO 3166-1 alpha-2 code)',
    example: 'US',
    required: false,
  })
  @IsISO31661Alpha2()
  @IsOptional()
  country?: string

  @ApiProperty({
    description: 'Primary nationality (ISO 3166-1 alpha-2 country code)',
    example: 'US',
    required: false,
  })
  @IsISO31661Alpha2()
  @IsOptional()
  primaryNationality?: string

  @ApiProperty({
    description: 'Secondary nationality (ISO 3166-1 alpha-2 country code)',
    example: 'GB',
    required: false,
  })
  @IsISO31661Alpha2()
  @IsOptional()
  secondaryNationality?: string

  @ApiProperty({
    description: 'Languages spoken (ISO 639-1 codes)',
    example: ['en', 'fr', 'es'],
    required: false,
  })
  @IsArray()
  @IsString({ each: true })
  @IsIn(LANGUAGE_CODES, { each: true })
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
