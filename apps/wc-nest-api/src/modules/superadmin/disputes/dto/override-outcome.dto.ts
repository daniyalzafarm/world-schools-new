import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator'
import { DisputeOutcome } from '../../../../generated/client/enums'

export class OverrideOutcomeDto {
  @ApiProperty({
    enum: DisputeOutcome,
    description:
      'New outcome. Cannot be `open` — overrides exist to close stuck disputes when Stripe webhooks lag.',
  })
  @IsEnum(DisputeOutcome)
  outcome: DisputeOutcome

  @ApiPropertyOptional({
    description: 'Free-text reason for the manual override. Captured for audit.',
    maxLength: 2_000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  note?: string
}
