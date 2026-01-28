import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

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
    description: 'Custom cancellation policy details (JSON)',
    example: { rules: [{ days: 30, refund: 100 }] },
    required: false,
  })
  @IsOptional()
  cancellationPolicyCustom?: any
}
