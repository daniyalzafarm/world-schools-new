import { IsArray, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator'
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
}
