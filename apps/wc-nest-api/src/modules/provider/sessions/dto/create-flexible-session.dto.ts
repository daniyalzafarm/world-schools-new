import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
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

export class DurationDto {
  @IsNumber()
  @Min(1)
  @Max(52)
  weeks: number

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(6)
  days?: number

  @IsNumber()
  @Min(0)
  price: number
}

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

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => DurationDto)
  durations: DurationDto[]

  @IsOptional()
  @IsNumber()
  @Min(1)
  capacity?: number

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BlackoutDateDto)
  blackoutDates?: BlackoutDateDto[]
}
