import { IsNotEmpty, IsString } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class SaveContactInfoDto {
  @ApiProperty({
    description: 'Contact first name',
    example: 'John',
  })
  @IsString()
  @IsNotEmpty()
  contactFirstName: string

  @ApiProperty({
    description: 'Contact last name',
    example: 'Doe',
  })
  @IsString()
  @IsNotEmpty()
  contactLastName: string

  @ApiProperty({
    description: 'Contact role/title',
    example: 'Camp Director',
  })
  @IsString()
  @IsNotEmpty()
  contactRole: string

  @ApiProperty({
    description: 'Contact phone number in E.164 format',
    example: '+14165551234',
  })
  @IsString()
  @IsNotEmpty()
  contactPhone: string

  @ApiProperty({
    description: 'Contact email address',
    example: 'john.doe@summeradventures.com',
  })
  @IsString()
  @IsNotEmpty()
  contactEmail: string
}
