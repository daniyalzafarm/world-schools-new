import { ApiProperty } from '@nestjs/swagger'
import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator'

export class CreateChildDto {
  @ApiProperty({
    description: 'Child first name',
    example: 'Emma',
  })
  @IsString()
  @IsNotEmpty()
  firstName: string

  @ApiProperty({
    description: 'Child last name',
    example: 'Smith',
  })
  @IsString()
  @IsNotEmpty()
  lastName: string

  @ApiProperty({
    description: 'Date of birth',
    example: '2015-05-15',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  dateOfBirth?: string

  @ApiProperty({
    description: 'Grade level',
    example: '3rd Grade',
    required: false,
  })
  @IsString()
  @IsOptional()
  grade?: string
}
