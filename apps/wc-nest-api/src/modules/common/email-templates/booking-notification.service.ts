import { Injectable, Logger } from '@nestjs/common'
import { EmailService } from '@world-schools/global-utils'
import { formatCurrency } from '@world-schools/wc-utils'
import { EmailTemplateService } from './email-template.service'
import { ConfigService } from '../../../config/config.service'

/**
 * Sends parent-facing booking lifecycle emails (accepted / declined).
 * Mirrors the pattern in {@link ApplicationNotificationService} — wraps the
 * shared `EmailService` and renders templates from `EmailTemplateService`.
 *
 * Both methods are best-effort: failures are logged but never thrown back
 * to the caller, because the source of truth (in-app notification, DB
 * state) has already been written by the time we dispatch the email.
 */
@Injectable()
export class BookingNotificationService {
  private readonly logger = new Logger(BookingNotificationService.name)

  constructor(
    private readonly emailService: EmailService,
    private readonly emailTemplateService: EmailTemplateService,
    private readonly configService: ConfigService
  ) {}

  /**
   * Sent when a provider accepts a booking and the parent's card has been
   * charged. Quote the exact captured amount so support tickets don't ask
   * "how much was I charged?".
   */
  async sendBookingAcceptedEmail(params: {
    parentEmail: string
    parentFirstName: string
    bookingGroupId: string
    campName: string
    sessionRange: string
    chargedAmount: number
    currency: string
  }): Promise<void> {
    try {
      const chargedAmountFormatted = formatCurrency(params.chargedAmount, params.currency)
      const bookingUrl = `${this.configService.bookingPortalUrl}/bookings/${params.bookingGroupId}`

      const html = this.emailTemplateService.getBookingAcceptedTemplate({
        parentFirstName: params.parentFirstName,
        campName: params.campName,
        sessionRange: params.sessionRange,
        chargedAmountFormatted,
        bookingUrl,
      })

      const sent = await this.emailService.sendEmail({
        to: params.parentEmail,
        subject: `Your booking at ${params.campName} is confirmed`,
        html,
        messageId: `booking-accepted-${params.bookingGroupId}-${Date.now()}`,
      })

      if (sent) {
        this.logger.log(
          `Booking accepted email sent to ${params.parentEmail} for ${params.bookingGroupId}`
        )
      } else {
        this.logger.error(
          `Failed to send booking accepted email to ${params.parentEmail} for ${params.bookingGroupId}`
        )
      }
    } catch (error) {
      this.logger.error(`Error sending booking accepted email for ${params.bookingGroupId}:`, error)
    }
  }

  /**
   * Sent when a provider declines a booking. Emphasises "no charge has been
   * made" because Stripe has voided the auth — parents should not see any
   * pending hold beyond the issuer's normal drop-off window.
   */
  async sendBookingDeclinedEmail(params: {
    parentEmail: string
    parentFirstName: string
    bookingGroupId: string
    campName: string
    sessionRange: string
    reasonLabel?: string
  }): Promise<void> {
    try {
      const html = this.emailTemplateService.getBookingDeclinedTemplate({
        parentFirstName: params.parentFirstName,
        campName: params.campName,
        sessionRange: params.sessionRange,
        reasonLabel: params.reasonLabel,
      })

      const sent = await this.emailService.sendEmail({
        to: params.parentEmail,
        subject: `Your booking request for ${params.campName} was declined`,
        html,
        messageId: `booking-declined-${params.bookingGroupId}-${Date.now()}`,
      })

      if (sent) {
        this.logger.log(
          `Booking declined email sent to ${params.parentEmail} for ${params.bookingGroupId}`
        )
      } else {
        this.logger.error(
          `Failed to send booking declined email to ${params.parentEmail} for ${params.bookingGroupId}`
        )
      }
    } catch (error) {
      this.logger.error(`Error sending booking declined email for ${params.bookingGroupId}:`, error)
    }
  }
}
