import { Type } from 'class-transformer'
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator'
import { ActivityScaleColorKey, ActivityScaleVisualType } from '../../../generated/client/enums'

export class ScaleLevelInputDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  value!: string

  @IsOptional()
  @IsString()
  @MaxLength(160)
  label?: string
}

export class CreateScaleDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Scale ID must be lowercase alphanumeric with hyphens only',
  })
  @MaxLength(80)
  id!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string

  @IsOptional()
  @IsString()
  description?: string

  @IsEnum(ActivityScaleVisualType)
  visualType!: ActivityScaleVisualType

  @IsEnum(ActivityScaleColorKey)
  colorKey!: ActivityScaleColorKey

  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => ScaleLevelInputDto)
  levels!: ScaleLevelInputDto[]
}

export class UpdateScaleDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string

  @IsOptional()
  @IsString()
  description?: string | null

  @IsOptional()
  @IsEnum(ActivityScaleVisualType)
  visualType?: ActivityScaleVisualType

  @IsOptional()
  @IsEnum(ActivityScaleColorKey)
  colorKey?: ActivityScaleColorKey

  // When provided, replaces the full levels list.
  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => ScaleLevelInputDto)
  levels?: ScaleLevelInputDto[]
}
