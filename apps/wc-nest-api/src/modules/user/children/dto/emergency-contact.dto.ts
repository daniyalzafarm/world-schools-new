import { ApiProperty } from '@nestjs/swagger'
import { IsBoolean, IsEmail, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator'

export class EmergencyContactDto {
  @ApiProperty({
    description: 'Unique identifier for the contact',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsString()
  @IsOptional()
  id?: string

  @ApiProperty({
    description: 'Contact name',
    example: 'Jane Smith',
  })
  @IsString()
  @IsNotEmpty()
  name: string

  @ApiProperty({
    description: 'Relationship to child',
    example: 'Father',
    enum: [
      'Father',
      'Mother',
      'Stepfather',
      'Stepmother',
      'Grandparent',
      'Aunt / Uncle',
      'Godparent',
      'Adult sibling',
      'Nanny / Au pair',
      'Family friend',
      'Doctor / Pediatrician',
      'Other',
    ],
  })
  @IsString()
  @IsNotEmpty()
  @IsIn([
    'Father',
    'Mother',
    'Stepfather',
    'Stepmother',
    'Grandparent',
    'Aunt / Uncle',
    'Godparent',
    'Adult sibling',
    'Nanny / Au pair',
    'Family friend',
    'Doctor / Pediatrician',
    'Other',
  ])
  relationship: string

  @ApiProperty({
    description: 'Primary phone number',
    example: '+1-555-0123',
  })
  @IsString()
  @IsNotEmpty()
  primaryPhone: string

  @ApiProperty({
    description: 'Secondary phone number',
    example: '+1-555-0124',
    required: false,
  })
  @IsString()
  @IsOptional()
  secondaryPhone?: string

  @ApiProperty({
    description: 'Email address',
    example: 'jane.smith@example.com',
    required: false,
  })
  @IsEmail()
  @IsOptional()
  email?: string

  @ApiProperty({
    description: 'Whether this contact is authorized for pickup',
    example: true,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  authorizedForPickup?: boolean

  @ApiProperty({
    description: 'Additional notes about this contact',
    example: 'Available weekdays 9am-5pm',
    required: false,
  })
  @IsString()
  @IsOptional()
  notes?: string
}
