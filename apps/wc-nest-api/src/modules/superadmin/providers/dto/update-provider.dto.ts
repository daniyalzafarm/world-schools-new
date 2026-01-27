import { ApiProperty } from '@nestjs/swagger'
import { IsEmail, IsOptional, IsString } from 'class-validator'

export class UpdateProviderDto {
  @ApiProperty({
    description: 'Phone number',
    example: '+1-555-123-4567',
    required: false,
  })
  @IsString()
  @IsOptional()
  phone?: string

  @ApiProperty({
    description: 'Email address',
    example: 'contact@worldschoolsacademy.com',
    required: false,
  })
  @IsEmail()
  @IsOptional()
  email?: string

  @ApiProperty({
    description: 'Website URL',
    example: 'https://worldschoolsacademy.com',
    required: false,
  })
  @IsString()
  @IsOptional()
  website?: string
}
