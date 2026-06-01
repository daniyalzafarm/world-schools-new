import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator'
import { Type } from 'class-transformer'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class CreateAddOnDto {
  @ApiProperty({
    description: 'Name of the add-on',
    example: 'Tennis Lessons',
    maxLength: 120,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string

  @ApiPropertyOptional({
    description: 'Description of what is included in this add-on',
    example: 'Private coaching with certified instructor',
  })
  @IsOptional()
  @IsString()
  description?: string

  @ApiPropertyOptional({
    description: 'Emoji icon to represent this add-on',
    example: '🎾',
    maxLength: 10,
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  icon?: string

  @ApiProperty({
    description: 'Type of add-on',
    enum: ['activity', 'service', 'equipment', 'language'],
    example: 'activity',
  })
  @IsEnum(['activity', 'service', 'equipment', 'language'])
  type: 'activity' | 'service' | 'equipment' | 'language'

  @ApiProperty({
    description:
      "Price of the add-on. Always denominated in the provider's settlement currency — currency is derived server-side from ProviderSettings.",
    example: 75,
  })
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  price: number

  @ApiProperty({
    description: 'Pricing unit',
    enum: ['per_child', 'per_hour', 'per_session', 'per_week', 'per_bag', 'one_time'],
    example: 'per_hour',
  })
  @IsEnum(['per_child', 'per_hour', 'per_session', 'per_week', 'per_bag', 'one_time'])
  pricingUnit: 'per_child' | 'per_hour' | 'per_session' | 'per_week' | 'per_bag' | 'one_time'

  @ApiPropertyOptional({
    description: 'Maximum quantity allowed',
    example: 3,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  maxQuantity?: number

  @ApiPropertyOptional({
    description: 'Unit for quantity limit (e.g., "per week")',
    example: 'per week',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  quantityUnit?: string

  @ApiPropertyOptional({
    description: 'Minimum age restriction',
    example: 6,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(4)
  @Max(18)
  minAge?: number

  @ApiPropertyOptional({
    description: 'Maximum age restriction',
    example: 17,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(4)
  @Max(18)
  maxAge?: number

  @ApiPropertyOptional({
    description: 'Sort order for display',
    example: 0,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  sortOrder?: number
}
