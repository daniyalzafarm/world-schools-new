import { IsIn, IsISO8601, IsOptional, IsString, Length } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'

export type DashboardRangePreset = '7d' | '30d' | '90d' | '1y' | 'custom'

export const DASHBOARD_RANGE_PRESETS: DashboardRangePreset[] = ['7d', '30d', '90d', '1y', 'custom']

export class AnalyticsRangeDto {
  @ApiPropertyOptional({ enum: DASHBOARD_RANGE_PRESETS, default: '30d' })
  @IsOptional()
  @IsIn(DASHBOARD_RANGE_PRESETS)
  range?: DashboardRangePreset

  @ApiPropertyOptional({ description: 'ISO date string when range=custom' })
  @IsOptional()
  @IsISO8601()
  from?: string

  @ApiPropertyOptional({ description: 'ISO date string when range=custom' })
  @IsOptional()
  @IsISO8601()
  to?: string

  @ApiPropertyOptional({
    description: 'Lowercase ISO 4217 currency code to scope aggregates (e.g. "eur")',
  })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string
}
