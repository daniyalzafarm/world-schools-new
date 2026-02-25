import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator'
import { Type } from 'class-transformer'

// Enums matching Prisma schema
export enum SessionDayType {
  FULL_DAY = 'full_day',
  HALF_DAY = 'half_day',
}

export enum PricingType {
  SINGLE = 'single',
  AGE_GROUP = 'age_group',
}

export enum AvailabilityType {
  SINGLE = 'single',
  AGE_GROUP = 'age_group',
}

export enum SessionStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
}

// Nested DTOs for JSON fields
export class AgeGroupPriceDto {
  @IsString()
  @IsNotEmpty()
  ageGroupId: string

  @IsNumber()
  @Min(0)
  price: number
}

export class AgeGroupSpotDto {
  @IsString()
  @IsNotEmpty()
  ageGroupId: string

  @IsNumber()
  @Min(1)
  spots: number
}

export class SessionSpecificDiscountDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  name: string

  @IsEnum(['percent', 'fixed'])
  type: 'percent' | 'fixed'

  @IsNumber()
  @Min(0.01)
  value: number

  @IsOptional()
  @IsDateString()
  validUntil?: string | null

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ageGroups?: string[]
}

export class CreateFixedSessionDto {
  // Basic Fields
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name: string

  @IsDateString()
  startDate: string

  @IsDateString()
  endDate: string

  // Session Type (only for day camps)
  @IsOptional()
  @IsEnum(SessionDayType)
  sessionDayType?: SessionDayType

  @IsOptional()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'arrivalTime must be in HH:MM format',
  })
  @ValidateIf(o => o.sessionDayType === SessionDayType.HALF_DAY)
  arrivalTime?: string

  @IsOptional()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'departureTime must be in HH:MM format',
  })
  @ValidateIf(o => o.sessionDayType === SessionDayType.HALF_DAY)
  departureTime?: string

  // Pricing
  @IsEnum(PricingType)
  pricingType: PricingType

  @IsOptional()
  @IsNumber()
  @Min(0)
  @ValidateIf(o => o.pricingType === PricingType.SINGLE)
  price?: number

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AgeGroupPriceDto)
  @ValidateIf(o => o.pricingType === PricingType.AGE_GROUP)
  ageGroupPrices?: AgeGroupPriceDto[]

  // Availability
  @IsEnum(AvailabilityType)
  availabilityType: AvailabilityType

  @IsOptional()
  @IsNumber()
  @Min(1)
  @ValidateIf(o => o.availabilityType === AvailabilityType.SINGLE)
  totalSpots?: number

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AgeGroupSpotDto)
  @ValidateIf(o => o.availabilityType === AvailabilityType.AGE_GROUP)
  ageGroupSpots?: AgeGroupSpotDto[]

  // Status
  @IsEnum(SessionStatus)
  status: SessionStatus

  // Discounts (optional - for applying global discounts during creation)
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  globalAppliedDiscountIds?: string[]

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  globalRemovedDiscountIds?: string[]

  // Session-specific discounts (optional - for adding manual discounts during creation)
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SessionSpecificDiscountDto)
  sessionSpecificDiscounts?: SessionSpecificDiscountDto[]
}
