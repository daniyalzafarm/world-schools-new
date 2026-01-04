import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class SaveCampInfoDto {
  @ApiProperty({
    description: 'Brief description of the camp (100-300 characters)',
    example:
      'Premier summer camp offering outdoor adventures, water sports, and leadership programs for kids ages 6-16.',
    minLength: 100,
    maxLength: 300,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(100)
  @MaxLength(300)
  description: string

  @ApiProperty({
    description: 'Camp types (day, overnight, or both)',
    example: ['day', 'overnight'],
    type: [String],
  })
  @IsArray()
  @IsNotEmpty()
  campTypes: string[]

  @ApiProperty({
    description: 'Minimum camper age',
    example: 6,
    minimum: 0,
    maximum: 99,
  })
  @IsInt()
  @Min(0)
  @Max(99)
  minAge: number

  @ApiProperty({
    description: 'Maximum camper age',
    example: 16,
    minimum: 0,
    maximum: 99,
  })
  @IsInt()
  @Min(0)
  @Max(99)
  maxAge: number
}
