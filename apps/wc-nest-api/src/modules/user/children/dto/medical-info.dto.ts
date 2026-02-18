import { ApiProperty } from '@nestjs/swagger'
import { IsArray, IsIn, IsOptional, IsString } from 'class-validator'

export class MedicalInfoDto {
  @ApiProperty({
    description: 'Allergies (multi-select from predefined list + custom)',
    example: ['Peanuts', 'Dairy'],
    required: false,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  allergies?: string[]

  @ApiProperty({
    description: 'Dietary requirements (multi-select from predefined list + custom)',
    example: ['Vegetarian', 'Gluten-free'],
    required: false,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  dietaryRequirements?: string[]

  @ApiProperty({
    description: 'Current medications',
    example: 'Inhaler for asthma (Ventolin, 2 puffs as needed)',
    required: false,
  })
  @IsString()
  @IsOptional()
  medications?: string

  @ApiProperty({
    description: 'Medical conditions',
    example: 'Mild asthma, well-controlled with medication',
    required: false,
  })
  @IsString()
  @IsOptional()
  medicalConditions?: string

  @ApiProperty({
    description: 'Special needs or accommodations',
    example: 'Requires extra time for physical activities',
    required: false,
  })
  @IsString()
  @IsOptional()
  specialNeeds?: string

  @ApiProperty({
    description: 'Swimming ability level',
    example: 'intermediate',
    enum: ['cannot_swim', 'beginner', 'intermediate', 'advanced', 'competitive'],
    required: false,
  })
  @IsString()
  @IsIn(['cannot_swim', 'beginner', 'intermediate', 'advanced', 'competitive'])
  @IsOptional()
  swimmingAbility?: string

  @ApiProperty({
    description: "Doctor's name",
    example: 'Dr. Sarah Johnson',
    required: false,
  })
  @IsString()
  @IsOptional()
  doctorName?: string

  @ApiProperty({
    description: "Doctor's phone number",
    example: '+1-555-0123',
    required: false,
  })
  @IsString()
  @IsOptional()
  doctorPhone?: string

  @ApiProperty({
    description: 'Insurance information',
    example: 'Blue Cross Blue Shield, Policy #12345678',
    required: false,
  })
  @IsString()
  @IsOptional()
  insuranceInfo?: string
}
