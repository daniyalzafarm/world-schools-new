import { ApiProperty } from '@nestjs/swagger'
import { IsDateString, IsOptional, IsString } from 'class-validator'

export class UpdateChildDto {
  @ApiProperty({
    description: 'Child first name',
    example: 'Emma',
    required: false,
  })
  @IsString()
  @IsOptional()
  first_name?: string

  @ApiProperty({
    description: 'Child last name',
    example: 'Smith',
    required: false,
  })
  @IsString()
  @IsOptional()
  last_name?: string

  @ApiProperty({
    description: 'Date of birth',
    example: '2015-05-15',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  date_of_birth?: string

  @ApiProperty({
    description: 'Grade level',
    example: '3rd Grade',
    required: false,
  })
  @IsString()
  @IsOptional()
  grade?: string
}
