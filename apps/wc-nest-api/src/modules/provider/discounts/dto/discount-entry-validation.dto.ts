import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
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

/**
 * Config DTOs for each discount type
 */

export class SiblingDiscountConfigDto {
  @IsNumber()
  @Min(1, { message: 'Second child discount must be at least 1%' })
  @Max(100, { message: 'Second child discount cannot exceed 100%' })
  secondChild: number

  @IsNumber()
  @Min(1, { message: 'Third child discount must be at least 1%' })
  @Max(100, { message: 'Third child discount cannot exceed 100%' })
  thirdChild: number

  @IsNumber()
  @Min(1, { message: 'Fourth+ child discount must be at least 1%' })
  @Max(100, { message: 'Fourth+ child discount cannot exceed 100%' })
  fourthPlusChild: number
}

export class MultiWeekConfigDto {
  @IsInt({ message: 'Minimum weeks must be an integer' })
  @Min(2, { message: 'Minimum weeks must be at least 2' })
  minimumWeeks: number
}

export class GroupBookingConfigDto {
  @IsInt({ message: 'Minimum children must be an integer' })
  @Min(2, { message: 'Minimum children must be at least 2' })
  minimumChildren: number
}

export class PromoCodeConfigDto {
  @IsString()
  @IsNotEmpty({ message: 'Promo code is required' })
  @MaxLength(20, { message: 'Promo code cannot exceed 20 characters' })
  @IsAlphanumeric({ message: 'Promo code must contain only uppercase letters and numbers' })
  code: string

  @IsInt({ message: 'Usage limit must be an integer' })
  @Min(1, { message: 'Usage limit must be at least 1' })
  usageLimit: number
}

/**
 * Base validation for discount entries
 */
export class BaseDiscountEntryDto {
  @IsString()
  @IsNotEmpty({ message: 'Discount name is required' })
  @MaxLength(30, { message: 'Discount name cannot exceed 30 characters' })
  name: string

  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'Details cannot exceed 200 characters' })
  details?: string
}

/**
 * Early Bird Discount Entry
 */
export class EarlyBirdEntryDto extends BaseDiscountEntryDto {
  @IsNumber()
  @Min(1, { message: 'Discount percentage must be at least 1%' })
  @Max(100, { message: 'Discount percentage cannot exceed 100%' })
  value: number

  @IsDateString({}, { message: 'Valid until must be a valid date' })
  @IsDateInFuture({ message: 'Valid until date must be in the future' })
  validUntil: string
}

/**
 * Sibling Discount Entry
 */
export class SiblingEntryDto extends BaseDiscountEntryDto {
  @ValidateNested()
  @Type(() => SiblingDiscountConfigDto)
  @IsSiblingTiersValid({ message: 'Discount tiers must be in ascending order' })
  config: SiblingDiscountConfigDto
}

/**
 * Returning Camper Discount Entry
 */
export class ReturningCamperEntryDto extends BaseDiscountEntryDto {
  @IsNumber()
  @Min(1, { message: 'Discount percentage must be at least 1%' })
  @Max(100, { message: 'Discount percentage cannot exceed 100%' })
  value: number
}

/**
 * Multi-Week Booking Discount Entry
 */
export class MultiWeekEntryDto extends BaseDiscountEntryDto {
  @IsNumber()
  @Min(1, { message: 'Discount percentage must be at least 1%' })
  @Max(100, { message: 'Discount percentage cannot exceed 100%' })
  value: number

  @ValidateNested()
  @Type(() => MultiWeekConfigDto)
  config: MultiWeekConfigDto
}

/**
 * Group Booking Discount Entry
 */
export class GroupBookingEntryDto extends BaseDiscountEntryDto {
  @IsNumber()
  @Min(1, { message: 'Discount percentage must be at least 1%' })
  @Max(100, { message: 'Discount percentage cannot exceed 100%' })
  value: number

  @ValidateNested()
  @Type(() => GroupBookingConfigDto)
  config: GroupBookingConfigDto
}

/**
 * Promo Code Discount Entry
 */
export class PromoCodeEntryDto extends BaseDiscountEntryDto {
  @IsNumber()
  @Min(1, { message: 'Discount percentage must be at least 1%' })
  @Max(100, { message: 'Discount percentage cannot exceed 100%' })
  value: number

  @IsDateString({}, { message: 'Valid from must be a valid date' })
  validFrom: string

  @IsDateString({}, { message: 'Valid until must be a valid date' })
  @IsDateAfter({ message: 'Valid until must be after valid from date' })
  validUntil: string

  @ValidateNested()
  @Type(() => PromoCodeConfigDto)
  config: PromoCodeConfigDto
}
