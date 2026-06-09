import { ApiProperty } from '@nestjs/swagger'
import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, Length } from 'class-validator'
import { ChildGender } from '../../../../generated/client/client'

export class CreateChildDto {
  @ApiProperty({ description: 'First name', example: 'Emma' })
  @IsString()
  @IsNotEmpty()
  @Length(2, 50)
  firstName: string

  @ApiProperty({ description: 'Last name', example: 'Smith', required: false })
  @IsString()
  @IsOptional()
  @Length(2, 50)
  lastName?: string

  @ApiProperty({ description: 'Date of birth', example: '2015-05-15' })
  @IsDateString()
  @IsNotEmpty()
  dateOfBirth: string

  @ApiProperty({
    description: 'Gender',
    example: 'girl',
    enum: ChildGender,
  })
  @IsNotEmpty()
  @IsEnum(ChildGender)
  gender: ChildGender

  // All other fields are optional and added later via update
}
