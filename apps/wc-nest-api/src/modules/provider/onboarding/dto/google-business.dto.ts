import {
  IsIn,
  IsInt,
  IsISO31661Alpha2,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'
import { SUPPORTED_CONNECT_CURRENCIES } from '../../../stripe/stripe.constants'

const SUPPORTED_CURRENCY_CODES = Array.from(SUPPORTED_CONNECT_CURRENCIES).map(c => c.toUpperCase())

export class SearchGoogleBusinessDto {
  @ApiProperty({
    description: 'Search query for Google Places API',
    example: 'Summer Camp Toronto',
  })
  @IsString()
  @IsNotEmpty()
  query: string

  @ApiProperty({
    description: 'Latitude for location bias',
    example: 43.6532,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number

  @ApiProperty({
    description: 'Longitude for location bias',
    example: -79.3832,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number
}

export class SaveGoogleBusinessProfileDto {
  @ApiProperty({
    description: 'Google Place ID',
    example: 'ChIJN1t_tDeuEmsRUsoyG83frY4',
  })
  @IsString()
  @IsNotEmpty()
  placeId: string

  @ApiProperty({
    description: 'Legal company name',
    example: 'Summer Adventures Inc.',
  })
  @IsString()
  @IsNotEmpty()
  legalCompanyName: string

  @ApiProperty({
    description: 'Legal street address',
    example: '123 Main Street',
  })
  @IsString()
  @IsNotEmpty()
  legalStreetAddress: string

  @ApiProperty({
    description: 'Legal apartment/suite number',
    example: 'Suite 200',
    required: false,
  })
  @IsOptional()
  @IsString()
  legalAptSuite?: string

  @ApiProperty({
    description: 'Legal city',
    example: 'Toronto',
  })
  @IsString()
  @IsNotEmpty()
  legalCity: string

  @ApiProperty({
    description: 'Legal state/province',
    example: 'Ontario',
  })
  @IsString()
  @IsNotEmpty()
  legalStateProvince: string

  @ApiProperty({
    description: 'Legal postal code',
    example: 'M5H 2N2',
  })
  @IsString()
  @IsNotEmpty()
  legalPostalCode: string

  // Lenient by design: this DTO is populated from the Google Business Profile
  // API, which returns a display name (e.g. "Canada"), not an ISO2 code. The
  // value is normalized to a code when the provider later edits it in the UI.
  @ApiProperty({
    description: 'Legal country (display name from Google, or ISO2 code)',
    example: 'Canada',
  })
  @IsString()
  @IsNotEmpty()
  legalCountry: string

  @ApiProperty({
    description: 'Year founded',
    example: 2010,
    minimum: 1900,
    maximum: 2100,
  })
  @IsInt()
  @Min(1900)
  @Max(2100)
  yearFounded: number

  @ApiProperty({
    description: 'Provider phone number',
    example: '+14165551234',
    required: false,
  })
  @IsOptional()
  @IsString()
  providerPhone?: string

  @ApiProperty({
    description: 'Provider email address',
    example: 'info@summeradventures.com',
    required: false,
  })
  @IsOptional()
  @IsString()
  providerEmail?: string

  @ApiProperty({
    description: 'Provider website URL',
    example: 'https://summeradventures.com',
    required: false,
  })
  @IsOptional()
  @IsString()
  website?: string

  @ApiProperty({
    description: 'Currency code (ISO 4217). Restricted to launch-scope currencies.',
    enum: SUPPORTED_CURRENCY_CODES,
    example: 'USD',
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(SUPPORTED_CURRENCY_CODES, {
    message: `currency must be one of: ${SUPPORTED_CURRENCY_CODES.join(', ')}`,
  })
  currency: string

  @ApiProperty({
    description: 'Timezone (IANA timezone)',
    example: 'America/New_York',
  })
  @IsString()
  @IsNotEmpty()
  timezone: string
}

export class UpdateCompanyDetailsDto {
  @ApiProperty({ description: 'Legal company name', example: 'Summer Adventures Inc.' })
  @IsString()
  @IsNotEmpty()
  legalCompanyName: string

  @ApiProperty({ description: 'Legal street address', example: '123 Main Street' })
  @IsString()
  @IsNotEmpty()
  legalStreetAddress: string

  @ApiProperty({ description: 'Legal apartment/suite number', required: false })
  @IsOptional()
  @IsString()
  legalAptSuite?: string

  @ApiProperty({ description: 'Legal city', example: 'Toronto' })
  @IsString()
  @IsNotEmpty()
  legalCity: string

  @ApiProperty({ description: 'Legal state/province', example: 'Ontario' })
  @IsString()
  @IsNotEmpty()
  legalStateProvince: string

  @ApiProperty({ description: 'Legal postal code', example: 'M5H 2N2' })
  @IsString()
  @IsNotEmpty()
  legalPostalCode: string

  @ApiProperty({ description: 'Legal country (ISO 3166-1 alpha-2 code)', example: 'CA' })
  @IsISO31661Alpha2()
  legalCountry: string

  @ApiProperty({ description: 'Year founded', example: 2010, minimum: 1800, maximum: 2100 })
  @IsInt()
  @Min(1800)
  @Max(2100)
  yearFounded: number

  @ApiProperty({ description: 'Provider phone number', required: false })
  @IsOptional()
  @IsString()
  providerPhone?: string

  @ApiProperty({ description: 'Provider email address', required: false })
  @IsOptional()
  @IsString()
  providerEmail?: string

  @ApiProperty({ description: 'Provider website URL', required: false })
  @IsOptional()
  @IsString()
  website?: string

  @ApiProperty({
    description: 'Currency code (ISO 4217). Restricted to launch-scope currencies.',
    enum: SUPPORTED_CURRENCY_CODES,
    example: 'USD',
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(SUPPORTED_CURRENCY_CODES, {
    message: `currency must be one of: ${SUPPORTED_CURRENCY_CODES.join(', ')}`,
  })
  currency: string

  @ApiProperty({ description: 'Timezone (IANA timezone)', example: 'America/New_York' })
  @IsString()
  @IsNotEmpty()
  timezone: string
}

export class GoogleBusinessSearchResultDto {
  @ApiProperty({ description: 'Google Place ID' })
  placeId: string

  @ApiProperty({ description: 'Business name' })
  businessName: string

  @ApiProperty({ description: 'Formatted address' })
  formattedAddress: string

  @ApiProperty({ description: 'Latitude', required: false })
  lat?: number

  @ApiProperty({ description: 'Longitude', required: false })
  lng?: number

  @ApiProperty({ description: 'Rating (0-5)', required: false })
  rating?: number

  @ApiProperty({ description: 'Number of reviews', required: false })
  reviewsCount?: number

  @ApiProperty({ description: 'Phone number', required: false })
  phone?: string

  @ApiProperty({ description: 'Website URL', required: false })
  website?: string

  @ApiProperty({ description: 'Photo URLs', type: [String], required: false })
  photos?: string[]

  @ApiProperty({ description: 'Business types', type: [String], required: false })
  types?: string[]
}
