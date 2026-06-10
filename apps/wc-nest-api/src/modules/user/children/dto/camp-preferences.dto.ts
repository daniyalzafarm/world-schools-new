import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsArray, IsIn, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator'
import { LANGUAGE_CODES } from '@world-schools/wc-types'

class LocationPreferencesDto {
  @ApiProperty({
    description: 'Maximum distance from home (in km)',
    example: 50,
    required: false,
  })
  @IsNumber()
  @IsOptional()
  maxDistance?: number

  @ApiProperty({
    description: 'Preferred areas or regions',
    example: ['Downtown', 'Suburbs'],
    required: false,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  preferredAreas?: string[]
}

class BudgetRangeDto {
  @ApiProperty({
    description: 'Minimum budget',
    example: 500,
    required: false,
  })
  @IsNumber()
  @IsOptional()
  min?: number

  @ApiProperty({
    description: 'Maximum budget',
    example: 2000,
    required: false,
  })
  @IsNumber()
  @IsOptional()
  max?: number

  @ApiProperty({
    description: 'Currency code',
    example: 'USD',
    default: 'USD',
  })
  @IsString()
  @IsOptional()
  currency?: string
}

export class CampPreferencesDto {
  @ApiProperty({
    description: 'Child interests (Sports, Arts, Adventure, STEM, Nature, Languages)',
    example: ['Football', 'Swimming', 'Painting', 'Coding'],
    required: false,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  interests?: string[]

  @ApiProperty({
    description: 'Preferred camp types',
    example: ['Day camp', 'Overnight'],
    required: false,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  preferredCampTypes?: string[]

  @ApiProperty({
    description: 'Preferred camp size',
    example: 'medium',
    enum: ['any', 'small', 'medium', 'large'],
    required: false,
  })
  @IsString()
  @IsIn(['any', 'small', 'medium', 'large'])
  @IsOptional()
  campSize?: string

  @ApiProperty({
    description: 'Environment and atmosphere preferences',
    example: ['International mix', 'Inclusive', 'Eco-friendly'],
    required: false,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  environmentPreferences?: string[]

  @ApiProperty({
    description: 'Values preferences (what parents value most)',
    example: ['Safety first', 'Quality staff', 'Great facilities'],
    required: false,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  valuesPreferences?: string[]

  @ApiProperty({
    description: 'Location preferences',
    required: false,
  })
  @ValidateNested()
  @Type(() => LocationPreferencesDto)
  @IsOptional()
  locationPreferences?: LocationPreferencesDto

  @ApiProperty({
    description: 'Budget range',
    required: false,
  })
  @ValidateNested()
  @Type(() => BudgetRangeDto)
  @IsOptional()
  budgetRange?: BudgetRangeDto

  @ApiProperty({
    description: 'Preferred camp duration',
    example: ['1-3 days', '4-7 days'],
    required: false,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  preferredDuration?: string[]

  @ApiProperty({
    description: 'Languages spoken by the child (ISO 639-1 codes)',
    example: ['en', 'es'],
    required: false,
  })
  @IsArray()
  @IsString({ each: true })
  @IsIn(LANGUAGE_CODES, { each: true })
  @IsOptional()
  languagesSpoken?: string[]

  @ApiProperty({
    description: 'Previous camp experience',
    example: 'Attended summer camp for 2 years, loves outdoor activities',
    required: false,
  })
  @IsString()
  @IsOptional()
  previousCampExperience?: string
}
