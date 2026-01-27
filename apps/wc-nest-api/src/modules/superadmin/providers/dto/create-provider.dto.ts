import { ApiProperty } from '@nestjs/swagger'
import { IsEmail, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator'

export class CreateProviderDto {
  @ApiProperty({
    description: 'Owner user ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsNotEmpty()
  ownerId: string

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
