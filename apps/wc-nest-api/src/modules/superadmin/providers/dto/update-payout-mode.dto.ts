import { ApiProperty } from '@nestjs/swagger'
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator'
import { PayoutMode } from '../../../../generated/client/enums'

/**
 * Phase 8 — superadmin sets a provider's payout mode.
 *
 * Modes:
 *   - `default_after_start`: ONE payout on first business day after camp
 *     start. Funds (deposit + balance) held until then. No extra fields.
 *   - `offset_days`: ONE payout `offsetDays` before camp start, regardless of
 *     cancellation policy. `offsetDays` is REQUIRED.
 *   - `policy_staged`: MULTIPLE payouts driven by the deposit + cancellation
 *     policy. Deposit releases at the 48h grace boundary; each policy tier
 *     breakpoint releases the increment that becomes non-refundable. No
 *     extra fields needed (the schedule is derived from the provider's
 *     existing deposit + cancellation-policy settings).
 *
 * `agreementNote` is REQUIRED for any non-default mode — preserves the
 * Phase-5 audit discipline (off-platform agreement reference).
 */
export class UpdatePayoutModeDto {
  @ApiProperty({
    enum: PayoutMode,
    description: 'Which payout schedule applies to all NEW bookings under this provider.',
  })
  @IsEnum(PayoutMode)
  payoutMode: PayoutMode

  @ApiProperty({
    description:
      'Days BEFORE session start at which funds release. Required when `payoutMode = offset_days`.',
    minimum: 1,
    maximum: 365,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  offsetDays?: number

  @ApiProperty({
    description:
      'Reference to the written agreement (contract id, email subject). Required when payoutMode != default_after_start.',
    maxLength: 2000,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  agreementNote?: string
}
