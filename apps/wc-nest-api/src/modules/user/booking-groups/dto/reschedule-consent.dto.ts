import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator'

/** Customer consents to a provider's proposed reschedule (Spec v2.5 §9.7). */
export class RescheduleConsentDto {
  @ApiProperty({ description: 'The pending proposal being consented to.' })
  @IsString()
  proposalId!: string

  @ApiPropertyOptional({ description: 'The exact reschedule policy text shown at re-consent.' })
  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  policyTextShown?: string

  @ApiPropertyOptional({ description: 'Consent-snapshot schema version.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  schemaVersion?: number
}

/** Customer declines a provider's proposed reschedule (original dates stand). */
export class RescheduleDeclineDto {
  @ApiProperty({ description: 'The pending proposal being declined.' })
  @IsString()
  proposalId!: string
}
