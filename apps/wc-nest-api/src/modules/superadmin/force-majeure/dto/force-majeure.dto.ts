import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator'

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
}
