import { IsEnum, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator'
import { BookingDeclineReason } from '@world-schools/wc-types'

/**
 * Decline payload — Provider Terms v1.5 §5.1(h)(iii) requires a reason from
 * the controlled list on every provider-initiated decline. When the reason
 * is `other`, the provider must supply a free-text justification (subject to
 * platform moderation before being surfaced to parents).
 */
export class DeclineBookingGroupDto {
  @IsEnum(BookingDeclineReason)
  declineReason!: BookingDeclineReason

  @ValidateIf(o => o.declineReason === BookingDeclineReason.Other)
  @IsString()
  @MinLength(10, {
    message: 'Please provide a justification of at least 10 characters for an "Other" decline.',
  })
  @MaxLength(1000)
  declineReasonOther?: string

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  providerNote?: string
}
