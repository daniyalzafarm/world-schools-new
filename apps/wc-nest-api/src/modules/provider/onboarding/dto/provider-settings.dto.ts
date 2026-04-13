import { Type } from 'class-transformer'
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

class SpecialCircumstanceDto {
  @ApiProperty({
    description: 'Type of special circumstance',
    enum: ['medical', 'force_majeure', 'weather'],
  })
  @IsString()
  @IsIn(['medical', 'force_majeure', 'weather'])
  type: string

  @ApiProperty({
    description: 'Percentage of balance to refund when this circumstance applies',
    enum: [50, 75, 90, 100],
  })
  @IsInt()
  @IsIn([50, 75, 90, 100])
  refundPercentage: number
}

export class SaveProviderSettingsDto {
  @ApiProperty({
    description: 'Cancellation policy type',
    example: 'moderate',
    enum: ['flexible', 'moderate', 'strict', 'custom'],
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['flexible', 'moderate', 'strict', 'custom'])
  cancellationPolicy: string

  @ApiProperty({
    description: 'Custom cancellation policy tiers (required when cancellationPolicy is "custom")',
    example: { tiers: [{ daysBeforeStart: 90, refundPercentage: 100 }] },
    required: false,
  })
  @IsOptional()
  cancellationPolicyCustom?: any

  @ApiProperty({
    description: 'Special circumstance exceptions that override the standard policy',
    type: [SpecialCircumstanceDto],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SpecialCircumstanceDto)
  cancellationPolicySpecialCircumstances?: SpecialCircumstanceDto[] | null

  @ApiProperty({
    description: 'Whether the provider agreed to the payment terms and cancellation policy',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  termsAgreed?: boolean
}
