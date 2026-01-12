import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator'
import { Type } from 'class-transformer'

export class CreateCampDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string

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
  @Type(() => AgeGroupDto)
  ageGroups: AgeGroupDto[]

  @IsNotEmpty()
  @IsString({ each: true })
  languages: string[]

  @IsEnum(['coed', 'boys', 'girls'])
  gender: 'coed' | 'boys' | 'girls'
}

export class UpdateCampProgramsDto {
  @IsNotEmpty()
  @IsString({ each: true })
  activities: string[]
}
