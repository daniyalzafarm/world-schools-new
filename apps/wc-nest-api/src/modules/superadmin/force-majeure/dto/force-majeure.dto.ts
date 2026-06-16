import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsBoolean, IsDateString, IsOptional, IsString, MaxLength } from 'class-validator'

export class ForceMajeurePreviewDto {
  @ApiProperty({ description: 'Programme start-date window, inclusive lower bound (ISO).' })
  @IsDateString()
  dateFrom!: string

  @ApiProperty({ description: 'Programme start-date window, inclusive upper bound (ISO).' })
  @IsDateString()
  dateTo!: string

  @ApiPropertyOptional({ description: 'Limit to a single provider.' })
  @IsOptional()
  @IsString()
  providerId?: string

  @ApiPropertyOptional({ description: 'Free-text region label (audit only).' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  region?: string
}

export class ForceMajeureExecuteDto extends ForceMajeurePreviewDto {
  @ApiProperty({ description: 'What happened — recorded on the force-majeure event (audit).' })
  @IsString()
  @MaxLength(5000)
  description!: string

  @ApiPropertyOptional({
    description:
      'When true, also refund the platform fee on every captured payment (admin discretion). ' +
      'Defaults to false — FM retains the platform fee per Spec v2.3.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  refundPlatformFee?: boolean
}
