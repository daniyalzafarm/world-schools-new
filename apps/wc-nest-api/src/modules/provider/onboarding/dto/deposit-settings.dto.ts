import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class SaveDepositSettingsDto {
  @ApiProperty({
    description: 'Whether deposit is required',
    example: true,
  })
  @IsBoolean()
  @IsNotEmpty()
  depositRequired: boolean

  @ApiProperty({
    description: 'Deposit type (percentage or fixed)',
    example: 'percentage',
    required: false,
    enum: ['percentage', 'fixed'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['percentage', 'fixed'])
  depositType?: string

  @ApiProperty({
    description: 'Deposit percentage (1-100)',
    example: 25,
    required: false,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  depositPercentage?: number

  @ApiProperty({
    description: 'Deposit fixed amount',
    example: 100.0,
    required: false,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  depositFixedAmount?: number
}
