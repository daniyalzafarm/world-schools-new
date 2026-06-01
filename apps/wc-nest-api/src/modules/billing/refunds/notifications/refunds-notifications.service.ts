import { Injectable, Logger } from '@nestjs/common'
import { EmailService } from '@world-schools/global-utils'
import { ConfigService } from '../../../../config/config.service'
import { PrismaService } from '../../../../prisma/prisma.service'
import { EmailTemplateService } from '../../../common/email-templates/email-template.service'
import type { ParentCancelMode } from '../refunds.service'

/**
 * Phase 4 — refund/cancellation-side notifications.
 *
 * Why a separate service: the refund pipeline lives in `RefundsService`
 * (Stripe + DB orchestration). Email rendering + send pull in the email
 * template service, the Stripe SDK retrieve flow, and the parent's email
 * lookup — coupling that to `RefundsService` would make the core refund
 * flow harder to test and change. Keeping notifications fire-and-forget
 * here mirrors the Phase 3 `BillingPaymentNotificationsService` pattern
 * we landed for off-session charges.
 *
 * All sends are best-effort. A failed email logs and returns rather than
 * throwing — the refund itself has already succeeded and we don't want a
 * notification hiccup to leave the parent without their money.
 */
@Injectable()
export class RefundsNotificationsService {
  private readonly logger = new Logger(RefundsNotificationsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly emailTemplate: EmailTemplateService,
    private readonly config: ConfigService
  ) {}

  /**
   * Sent immediately after a parent successfully cancels. Body differs by
   * `mode` so the parent sees a truthful summary of what happened.
   *
   * `nonRefundedAmountMajor` is only relevant for `policy` mode — it's the
   * amount that stayed on the camp/platform side under the cancellation
   * policy (deposit + the policy-tier-non-refunded fraction of the balance).
   */
  async notifyParentCancelled(input: {
    bookingGroupId: string
    mode: ParentCancelMode
    refundedAmountMajor: string | null
    nonRefundedAmountMajor?: string | null
    currency: string
  }): Promise<void> {
    if (input.mode === 'not_cancelable') {
      // Defensive — caller should never reach this path. No email, no log noise.
      return
    }
    const group = await this.prisma.bookingGroup.findUnique({
      where: { id: input.bookingGroupId },
      include: {
        camp: { select: { name: true } },
        parent: { include: { user: { select: { firstName: true, email: true } } } },
      },
    })
    if (!group) {
      this.logger.warn(`notifyParentCancelled: BookingGroup ${input.bookingGroupId} not found`)
      return
    }
    const parentEmail = group.parent.user?.email
    if (!parentEmail) {
      this.logger.warn(
        `notifyParentCancelled: no email for parent on booking ${input.bookingGroupId}`
      )
      return
    }

    const html = this.emailTemplate.getBookingCancelledConfirmationTemplate({
      parentFirstName: group.parent.user?.firstName ?? 'there',
      campName: group.camp.name,
      bookingGroupNumber: group.bookingGroupNumber,
      mode: input.mode,
      refundFormatted: input.refundedAmountMajor
        ? formatAmount(input.refundedAmountMajor, input.currency)
        : null,
      nonRefundedFormatted: input.nonRefundedAmountMajor
        ? formatAmount(input.nonRefundedAmountMajor, input.currency)
        : null,
      bookingsUrl: `${this.config.bookingPortalUrl}/bookings`,
    })

    try {
      await this.emailService.sendEmail({
        to: parentEmail,
        subject: 'Your World-Camps booking has been cancelled',
        html,
      })
    } catch (err) {
      this.logger.error(
        `notifyParentCancelled: sendEmail failed for booking ${input.bookingGroupId}: ${(err as Error).message}`
      )
    }
  }
}

function formatAmount(majorUnits: string, currency: string): string {
  const num = Number(majorUnits)
  const ccy = currency.toUpperCase()
  if (!Number.isFinite(num)) return `${majorUnits} ${ccy}`
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: ccy }).format(num)
  } catch {
    return `${num.toFixed(2)} ${ccy}`
  }
}
