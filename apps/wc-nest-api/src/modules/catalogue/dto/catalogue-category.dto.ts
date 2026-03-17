import { Type } from 'class-transformer'
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator'

import { ActivityCategoryStatus } from '../../../generated/client/enums'

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug must be lowercase alphanumeric with hyphens only',
  })
  @MaxLength(80)
  slug?: string

  @IsOptional()
  @IsString()
  @MaxLength(8)
  emoji?: string

  @IsOptional()
  @IsEnum(ActivityCategoryStatus)
  status?: ActivityCategoryStatus

  @IsOptional()
  @IsBoolean()
  surfaceParentInterests?: boolean

  @IsOptional()
  @IsBoolean()
  surfaceCampFocus?: boolean

  @IsOptional()
  @IsBoolean()
  surfaceCampInterests?: boolean

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number
}

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug must be lowercase alphanumeric with hyphens only',
  })
  @MaxLength(80)
  slug?: string

  @IsOptional()
  @IsString()
  @MaxLength(8)
  emoji?: string

  @IsOptional()
  @IsEnum(ActivityCategoryStatus)
  status?: ActivityCategoryStatus

  @IsOptional()
  @IsBoolean()
  surfaceParentInterests?: boolean

  @IsOptional()
  @IsBoolean()
  surfaceCampFocus?: boolean

  @IsOptional()
  @IsBoolean()
  surfaceCampInterests?: boolean

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number
}

export class AdminActivityDto {
  id!: string
  slug!: string
  name!: string
  emoji?: string | null
  scaleId?: string | null
  order!: number
  isActive!: boolean
}

export class AdminCategoryWithActivitiesDto {
  id!: string
  slug!: string
  name!: string
  emoji?: string | null
  status!: ActivityCategoryStatus
  surfaceParentInterests!: boolean
  surfaceCampFocus!: boolean
  surfaceCampInterests!: boolean
  order!: number

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminActivityDto)
  activities!: AdminActivityDto[]
}
