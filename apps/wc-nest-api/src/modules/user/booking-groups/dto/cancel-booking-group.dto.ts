import { ApiProperty } from '@nestjs/swagger'
import { IsIn, IsOptional, IsString } from 'class-validator'

const CIRCUMSTANCE_VALUES = ['medical', 'force_majeure', 'weather'] as const

/**
 * Body for `POST /user/booking-groups/:id/cancel` and the matching refund-
 * preview query. The `circumstance` field is optional; when set, the parent
 * is claiming a provider-configured special-circumstance refund (medical /
 * force_majeure / weather). The override only applies if the provider
 * pre-configured a refund % for that circumstance and that % beats the
 * standard policy tier. Deposit remains non-refundable in all cases.
 *
 * Per design HTML: provider sets the % up front during onboarding, so the
 * parent's claim is automatic — no provider/admin approval gate. Risk of
 * abuse is bounded by the provider-chosen ceiling and the audit log.
 */
export class CancelBookingGroupDto {
  @ApiProperty({
    description: 'Special circumstance claim (optional)',
    enum: CIRCUMSTANCE_VALUES,
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsIn(CIRCUMSTANCE_VALUES)
  circumstance?: 'medical' | 'force_majeure' | 'weather'
}
