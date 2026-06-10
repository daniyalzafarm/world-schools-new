import {
  ArrayMinSize,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator'
import { Type } from 'class-transformer'
import { LANGUAGE_CODES } from '@world-schools/wc-types'

export class CreateCampDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug must be lowercase, alphanumeric, and use hyphens to separate words',
  })
  slug: string

  @IsEnum(['day', 'residential'])
  type: 'day' | 'residential'

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description: string

  @IsEnum(['provider', 'different'])
  locationType: 'provider' | 'different'

  @IsOptional()
  @IsString()
  locationPlaceId?: string

  @IsOptional()
  @IsString()
  locationName?: string

  @IsOptional()
  @IsString()
  locationAddress?: string

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  locationLat?: number

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  locationLng?: number
}

export class AgeGroupDto {
  @IsNumber()
  @Min(4)
  @Max(18)
  @Type(() => Number)
  min: number

  @IsNumber()
  @Min(4)
  @Max(18)
  @Type(() => Number)
  max: number
}

export class UpdateCampAudienceDto {
  @IsNotEmpty()
  @ArrayMinSize(1, { message: 'At least one age group is required' })
  @ValidateNested({ each: true })
  @Type(() => AgeGroupDto)
  ageGroups: AgeGroupDto[]

  @IsNotEmpty()
  @IsString({ each: true })
  @IsIn(LANGUAGE_CODES, { each: true })
  languages: string[]

  @IsEnum(['coed', 'boys', 'girls'])
  gender: 'coed' | 'boys' | 'girls'
}

export class UpdateCampProgramsDto {
  @IsNotEmpty()
  @IsString({ each: true })
  activities: string[]
}
