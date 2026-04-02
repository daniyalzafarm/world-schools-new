import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator'
import { Type } from 'class-transformer'

export class ReviewTagDto {
  @IsEnum(['happiness', 'safety', 'communication'])
  dimension: 'happiness' | 'safety' | 'communication'

  @IsString()
  tagValue: string
}

export class CreateReviewDto {
  @IsUUID()
  campId: string

  @IsUUID()
  @IsOptional()
  bookingGroupId?: string

  @IsUUID()
  @IsOptional()
  bookingId?: string

  // Visit details (for unverified reviewers)
  @IsInt()
  @Min(1)
  @Max(12)
  @IsOptional()
  visitMonth?: number

  @IsInt()
  @Min(2000)
  @IsOptional()
  visitYear?: number

  @IsInt()
  @Min(1)
  @Max(10)
  @IsOptional()
  kidCount?: number

  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  kidAges?: number[]

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  kidTags?: string[]

  // Ratings
  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  happinessRating?: number

  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  safetyRating?: number

  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  communicationRating?: number

  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  asDescribedRating?: number

  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  growthRating?: number

  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  valueRating?: number

  // Tags
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReviewTagDto)
  @IsOptional()
  tags?: ReviewTagDto[]

  // Written content
  @IsString()
  @MaxLength(800)
  @IsOptional()
  reviewText?: string

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  photos?: string[]

  @IsBoolean()
  @IsOptional()
  returnChoice?: boolean

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  outcomes?: string[]

  @IsEnum(['draft', 'pending'])
  status: 'draft' | 'pending'
}
