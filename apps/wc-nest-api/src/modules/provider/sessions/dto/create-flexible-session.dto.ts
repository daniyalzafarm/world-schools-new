import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator'
import { Type } from 'class-transformer'

export class BlackoutDateDto {
  @IsDateString()
  start: string

  @IsDateString()
  end: string

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string
}

export class DiscountTierDto {
  @IsNumber()
  @Min(1)
  minDays: number

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxDays?: number

  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercent: number
}

export class DayOfWeekPricingDto {
  @IsNumber()
  @Min(0)
  @Max(6)
  dayOfWeek: number

  @IsNumber()
  @Min(0.01, { message: 'Price must be greater than 0' })
  price: number
}

export class AgeRangeDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  min: number

  @IsNumber()
  @Min(0)
  @Max(100)
  max: number
}

export class CreateFlexibleSessionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string

  @IsDateString()
  startDate: string

  @IsDateString()
  endDate: string

  @ValidateIf(o => o.unlimitedCapacity === false || o.unlimitedCapacity === undefined)
  @IsNumber()
  @Min(1, { message: 'Total capacity is required when unlimited capacity is not enabled' })
  capacity?: number

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BlackoutDateDto)
  blackoutDates?: BlackoutDateDto[]

  // Pricing fields
  @IsNumber()
  @Min(0.01, { message: 'Base price per day is required and must be greater than 0' })
  basePricePerDay: number

  @IsOptional()
  @IsBoolean()
  requireConsecutiveDays?: boolean

  @IsOptional()
  @IsNumber()
  @Min(1)
  minDaysLimit?: number

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxDaysLimit?: number

  @IsOptional()
  @IsArray()
  availableDaysOfWeek?: number[]

  @IsOptional()
  @IsArray()
  specificStartDays?: number[]

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DiscountTierDto)
  discountTiers?: DiscountTierDto[]

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DayOfWeekPricingDto)
  dayOfWeekPricing?: DayOfWeekPricingDto[]

  // Age and capacity fields
  @IsOptional()
  @ValidateNested()
  @Type(() => AgeRangeDto)
  ageRange?: AgeRangeDto

  @IsOptional()
  @IsBoolean()
  unlimitedCapacity?: boolean

  @IsOptional()
  @IsNumber()
  @Min(0)
  boysCapacity?: number

  @IsOptional()
  @IsNumber()
  @Min(0)
  girlsCapacity?: number

  @IsOptional()
  @IsBoolean()
  separateGenderCapacity?: boolean
}
