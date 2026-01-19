import {
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator'
import { Type } from 'class-transformer'

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
