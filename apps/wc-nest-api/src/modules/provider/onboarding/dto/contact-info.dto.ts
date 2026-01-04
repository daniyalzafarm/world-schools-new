import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class SaveContactInfoDto {
  @ApiProperty({
    description: 'Contact first name',
    example: 'John',
  })
  @IsString()
  @IsNotEmpty()
  contactFirstName: string

  @ApiProperty({
    description: 'Contact last name',
    example: 'Doe',
  })
  @IsString()
  @IsNotEmpty()
  contactLastName: string

  @ApiProperty({
    description: 'Contact role/title',
    example: 'Camp Director',
  })
  @IsString()
  @IsNotEmpty()
  contactRole: string

  @ApiProperty({
    description: 'Contact phone number',
    example: '+14165551234',
  })
  @IsString()
  @IsNotEmpty()
  contactPhone: string

  @ApiProperty({
    description: 'Contact phone country code',
    example: '+1',
  })
  @IsString()
  @IsNotEmpty()
  contactPhoneCountryCode: string

  @ApiProperty({
    description: 'Contact email address',
    example: 'john.doe@summeradventures.com',
  })
  @IsString()
  @IsNotEmpty()
  contactEmail: string

  @ApiProperty({
    description: 'Provider/Organization name',
    example: 'Summer Adventures Camp',
  })
  @IsString()
  @IsNotEmpty()
  providerName: string

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

  @ApiProperty({
    description: 'Legal country',
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
}
