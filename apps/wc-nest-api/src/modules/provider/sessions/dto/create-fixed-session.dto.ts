import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator'

export class CreateFixedSessionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string

  @IsDateString()
  sessionStartDate: string

  @IsDateString()
  sessionEndDate: string

  @IsNumber()
  @Min(0)
  price: number

  @IsOptional()
  @IsNumber()
  @Min(1)
  capacity?: number
}
