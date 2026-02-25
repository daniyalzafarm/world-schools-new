import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator'
import { Type } from 'class-transformer'
import {
  IsAlphanumeric,
  IsDateAfter,
  IsDateInFuture,
  IsSiblingTiersValid,
} from '../validators/discount.validators'

export enum DiscountCategory {
  EARLY_BIRD = 'early_bird',
  SIBLING = 'sibling',
  RETURNING_CAMPER = 'returning_camper',
  MULTI_WEEK = 'multi_week',
  GROUP_BOOKING = 'group_booking',
  PROMO_CODE = 'promo_code',
}

export enum CalculationType {
  PERCENT = 'percent',
  FIXED = 'fixed',
}

// DTO for individual discount entry
export class DiscountEntryDto {
  @IsString()
  id: string // Unique entry ID

  @IsString()
  @MaxLength(30)
  name: string

  @IsOptional()
  @IsNumber()
  @Min(0)
  value?: number

  @IsOptional()
  @IsEnum(CalculationType)
  calculationType?: CalculationType

  @IsOptional()
  @IsDateString()
  validFrom?: string

  @IsOptional()
  @IsDateString()
  validUntil?: string

  @IsOptional()
  @IsString()
  @MaxLength(255)
  details?: string

  @IsOptional()
  @IsObject()
  config?: Record<string, any> // Category-specific configuration
}

// DTO for updating the entire GlobalDiscount (category level)
export class UpdateGlobalDiscountDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DiscountEntryDto)
  entries?: DiscountEntryDto[]

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean
}

// DTO for adding a new entry to a discount category
export class AddDiscountEntryDto {
  @IsString()
  @IsNotEmpty({ message: 'Discount name is required' })
  @MaxLength(30, { message: 'Discount name cannot exceed 30 characters' })
  name: string

  @IsOptional()
  @IsNumber({}, { message: 'Discount value must be a number' })
  @Min(1, { message: 'Discount value must be at least 1' })
  @Max(100, { message: 'Discount value cannot exceed 100' })
  value?: number

  @IsOptional()
  @IsEnum(CalculationType)
  calculationType?: CalculationType

  @IsOptional()
  @IsDateString({}, { message: 'Valid from must be a valid date' })
  validFrom?: string

  @IsOptional()
  @IsDateString({}, { message: 'Valid until must be a valid date' })
  @IsDateAfter({ message: 'Valid until must be after valid from date' })
  validUntil?: string

  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'Details cannot exceed 200 characters' })
  details?: string

  @IsOptional()
  @IsObject()
  config?: Record<string, any>
}

// DTO for updating an existing entry
export class UpdateDiscountEntryDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Discount name cannot be empty' })
  @MaxLength(30, { message: 'Discount name cannot exceed 30 characters' })
  name?: string

  @IsOptional()
  @IsNumber({}, { message: 'Discount value must be a number' })
  @Min(1, { message: 'Discount value must be at least 1' })
  @Max(100, { message: 'Discount value cannot exceed 100' })
  value?: number

  @IsOptional()
  @IsEnum(CalculationType)
  calculationType?: CalculationType

  @IsOptional()
  @IsDateString({}, { message: 'Valid from must be a valid date' })
  validFrom?: string

  @IsOptional()
  @IsDateString({}, { message: 'Valid until must be a valid date' })
  @IsDateAfter({ message: 'Valid until must be after valid from date' })
  validUntil?: string

  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'Details cannot exceed 200 characters' })
  details?: string

  @IsOptional()
  @IsObject()
  config?: Record<string, any>
}

// DTO for creating a new global discount (lazy creation)
// Creates discount with empty entries array - entries added via separate API
export class CreateGlobalDiscountDto {
  @IsEnum(DiscountCategory)
  category: DiscountCategory

  @IsNumber()
  @Min(1)
  sortOrder: number
}
