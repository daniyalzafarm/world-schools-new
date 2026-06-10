import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator'
import { BookingDeclineReason, DECLINE_REASON_NOTE_MAX_LENGTH } from '@world-schools/wc-types'

/**
 * Decline payload — Provider Terms v1.7 §5.1(h)(iii) requires a reason from
 * the controlled list on every provider-initiated decline. Several reasons
 * carry a contextual free-text note in `declineReasonOther`; it is required for
 * some reasons (`operational_inability`, `safeguarding_concerns`, `other`) and
 * optional for others. The required/min-length rule is enforced in the service
 * via `DECLINE_REASONS_REQUIRING_NOTE`; here we only bound the length.
 */
export class DeclineBookingGroupDto {
  @IsEnum(BookingDeclineReason)
  declineReason!: BookingDeclineReason

  @IsOptional()
  @IsString()
  @MaxLength(DECLINE_REASON_NOTE_MAX_LENGTH)
  declineReasonOther?: string

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  providerNote?: string
}
