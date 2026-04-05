import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator'
import { Type } from 'class-transformer'
import { ReviewTagDto } from './create-review.dto'

export class UpdateReviewDto {
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

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReviewTagDto)
  @IsOptional()
  tags?: ReviewTagDto[]

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
  @IsOptional()
  status?: 'draft' | 'pending'
}
