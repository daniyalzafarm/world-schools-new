import { Injectable, Logger } from '@nestjs/common'
import { EmailService } from '@world-schools/global-utils'
import { ConfigService } from '../../../../config/config.service'
import { PrismaService } from '../../../../prisma/prisma.service'
import { EmailTemplateService } from '../../../common/email-templates/email-template.service'
import { withStripeErrors } from '../../shared/with-stripe-errors.util'
import { StripeService } from '../../../stripe/stripe.service'

/**
 * Parent-facing emails fired from the balance-charge cron when an off-session
 * charge needs a step-up (`requires_action`) or has exhausted the retry
 * window (`payment_failed`).
 *
 * Kept separate from `PaymentIntentsService` so the service stays focused on
 * Stripe + DB orchestration and the cron can fire-and-forget notifications
 * without coupling the core charge path to email infra. All sends are
 * best-effort — a failed email logs and returns rather than throwing, so a
 * notification hiccup never blocks the cron from advancing other rows.
 */
@Injectable()
export class BillingPaymentNotificationsService {
  private readonly logger = new Logger(BillingPaymentNotificationsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly emailTemplate: EmailTemplateService,
    private readonly config: ConfigService,
    private readonly stripeService: StripeService
  ) {}

  /**
   * Send the 3DS recovery email. The link drops the parent on
   * /payment/authorize with the live PaymentIntent's `client_secret` in the
   * URL so Stripe.js can drive `handleNextAction` to complete the issuer
   * challenge. We retrieve the secret fresh from Stripe rather than caching
   * it on the Payment row — Stripe rotates it on certain transitions and a
   * stale secret fails the confirm.
   */
  async notifyOffSessionRequiresAction(paymentId: string): Promise<void> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        bookingGroup: {
          include: {
            camp: { select: { name: true } },
            parent: { include: { user: { select: { email: true, firstName: true } } } },
          },
        },
      },
    })
    if (!payment?.stripePaymentIntentId) {
      this.logger.warn(`notifyOffSessionRequiresAction: missing payment or intent for ${paymentId}`)
      return
    }
    const parentEmail = payment.bookingGroup.parent.user?.email
    if (!parentEmail) {
      this.logger.warn(
        `notifyOffSessionRequiresAction: no email on parent for payment ${paymentId}`
      )
      return
    }

    let clientSecret: string | null = null
    try {
      // Direct Charges: the intent lives on the connected account. The
      // `stripeAccount` request option is the 3rd arg to `retrieve` (params is
      // the 2nd; we pass `undefined` since we don't need expand/etc.).
      const intent = await withStripeErrors(() =>
        this.stripeService.client.paymentIntents.retrieve(
          payment.stripePaymentIntentId!,
          undefined,
          { stripeAccount: payment.stripeAccountId }
        )
      )
      clientSecret = intent.client_secret
    } catch (err) {
      this.logger.error(
        `notifyOffSessionRequiresAction: failed to retrieve intent ${payment.stripePaymentIntentId} for payment ${paymentId}: ${(err as Error).message}`
      )
      return
    }
    if (!clientSecret) {
      this.logger.warn(
        `notifyOffSessionRequiresAction: intent ${payment.stripePaymentIntentId} has no client_secret`
      )
      return
    }

    // Direct Charges: include `stripe_account` so the recovery page can
    // initialize Stripe.js scoped to the right connected account (required
    // for `retrievePaymentIntent` / `handleNextAction` to find the intent —
    // the platform-scoped Stripe.js instance can't see connected-account
    // intents).
    const recoveryUrl = `${this.config.bookingPortalUrl}/payment/authorize?payment_intent_client_secret=${encodeURIComponent(
      clientSecret
    )}&stripe_account=${encodeURIComponent(payment.stripeAccountId)}`
    const html = this.emailTemplate.getOffSession3dsRecoveryTemplate({
      parentFirstName: payment.bookingGroup.parent.user?.firstName ?? 'there',
      campName: payment.bookingGroup.camp.name,
      bookingGroupNumber: payment.bookingGroup.bookingGroupNumber,
      amountFormatted: formatAmount(payment.amount.toNumber(), payment.currency),
      recoveryUrl,
    })

    try {
      await this.emailService.sendEmail({
        to: parentEmail,
        subject: 'Verify your card to complete your World-Camps booking',
        html,
      })
    } catch (err) {
      this.logger.error(
        `notifyOffSessionRequiresAction: sendEmail failed for payment ${paymentId}: ${(err as Error).message}`
      )
    }
  }

  /**
   * Send the final-failure email after the 48h / 2-attempt retry window has
   * been exhausted. The cron has already flipped the BookingGroup to
   * `payment_failed`; this email is the parent-facing heads-up.
   */
  async notifyPaymentFailedFinal(paymentId: string): Promise<void> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        bookingGroup: {
          include: {
            camp: { select: { name: true } },
            parent: { include: { user: { select: { email: true, firstName: true } } } },
          },
        },
      },
    })
    if (!payment) {
      this.logger.warn(`notifyPaymentFailedFinal: payment ${paymentId} not found`)
      return
    }
    const parentEmail = payment.bookingGroup.parent.user?.email
    if (!parentEmail) {
      this.logger.warn(`notifyPaymentFailedFinal: no email on parent for payment ${paymentId}`)
      return
    }

    const bookingsUrl = `${this.config.bookingPortalUrl}/bookings`
    const html = this.emailTemplate.getPaymentFailedFinalTemplate({
      parentFirstName: payment.bookingGroup.parent.user?.firstName ?? 'there',
      campName: payment.bookingGroup.camp.name,
      bookingGroupNumber: payment.bookingGroup.bookingGroupNumber,
      amountFormatted: formatAmount(payment.amount.toNumber(), payment.currency),
      bookingsUrl,
    })

    try {
      await this.emailService.sendEmail({
        to: parentEmail,
        subject: "We couldn't process your World-Camps balance payment",
        html,
      })
    } catch (err) {
      this.logger.error(
        `notifyPaymentFailedFinal: sendEmail failed for payment ${paymentId}: ${(err as Error).message}`
      )
    }
  }
}

function formatAmount(majorUnits: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(majorUnits)
  } catch {
    return `${majorUnits.toFixed(2)} ${currency.toUpperCase()}`
  }
}
