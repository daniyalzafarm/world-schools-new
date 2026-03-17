import { ApiProperty } from '@nestjs/swagger'
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator'
import { Type } from 'class-transformer'

/** Relational camp focus: single primary activity (catalogue category + activity). */
export class PutCampFocusDto {
  @ApiProperty({ description: 'Category slug from catalogue', example: 'sports' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  categoryId!: string

  @ApiProperty({ description: 'Activity slug within category', example: 'football' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  activityId!: string
}

/** Clear focus: send null or omit to remove. */
export class PutCampFocusBodyDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => PutCampFocusDto)
  focus?: PutCampFocusDto | null
}

export class CampInterestItemDto {
  @ApiProperty({ description: 'Category slug', example: 'sports' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  categoryId!: string

  @ApiProperty({
    description: 'Specific activity slugs within this category',
    example: ['football', 'swimming'],
    required: false,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  specificActivityIds?: string[]
}

export class PutCampInterestsDto {
  @ApiProperty({ type: [CampInterestItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CampInterestItemDto)
  items!: CampInterestItemDto[]
}

export class CampEligibilityItemDto {
  @ApiProperty({ description: 'Activity slug (must have a scale)', example: 'swimming' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  activityId!: string

  @ApiProperty({
    enum: ['INFO', 'GATE'],
    description: 'INFO = display only; GATE = minimum level enforced',
  })
  @IsEnum(['INFO', 'GATE'])
  mode!: 'INFO' | 'GATE'

  @ApiProperty({
    description: 'Minimum scale level value; required when mode is GATE',
    example: 'Intermediate',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  minimumLevelValue?: string | null
}

export class PutCampEligibilityDto {
  @ApiProperty({ type: [CampEligibilityItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CampEligibilityItemDto)
  items!: CampEligibilityItemDto[]
}
