import { ApiProperty } from '@nestjs/swagger'
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator'

/**
 * Body for `POST /user/booking-groups/:id/submit` (Payments revamp, Spec v2.3).
 *
 * Carries the customer's checkout consent acknowledgement. This is a contractual
 * requirement (SCA mandate evidence + dispute defence, Spec v2.3 §Compliance):
 * the exact policy text shown, the charge schedule, a timestamp, and the IP /
 * user-agent (captured server-side from the request) are persisted as a
 * `booking_consent_snapshot` row at submit. Submit is REJECTED unless
 * `consentAcknowledged === true`.
 *
 * Optional on the resume path (re-submitting an already-`request` booking),
 * where consent was captured on the first submit.
 */
export class SubmitBookingGroupDto {
  @ApiProperty({
    description:
      'Customer acknowledgement of the payment schedule + cancellation policy. Required (must be true) on the initial draft→request submit; enforced in the service so the idempotent resume path does not need to re-send it.',
    required: false,
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  consentAcknowledged?: boolean

  @ApiProperty({
    description:
      'Exact cancellation-policy + charge-schedule text shown at checkout (dispute evidence).',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  policyTextShown?: string

  @ApiProperty({
    description: 'Schema version of the consent/policy presentation format.',
    required: false,
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  schemaVersion?: number
}
