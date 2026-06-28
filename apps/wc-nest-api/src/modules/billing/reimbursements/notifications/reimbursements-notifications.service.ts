import { Injectable, Logger } from '@nestjs/common'
import { EmailService } from '@world-schools/global-utils'
import { ConfigService } from '../../../../config/config.service'
import { EmailTemplateService } from '../../../common/email-templates/email-template.service'

/**
 * Reimbursements-side notifications. Lives next to the
 * reimbursement cron + service so the dependency graph is
 * `cron → notifications → email-templates`, with no edge into the refunds
 * module (which would create a circular import — RefundsModule already
 * depends on ReimbursementsModule for `createIfNeeded`).
 */
@Injectable()
export class ReimbursementsNotificationsService {
  private readonly logger = new Logger(ReimbursementsNotificationsService.name)

  constructor(
    private readonly emailService: EmailService,
    private readonly emailTemplate: EmailTemplateService,
    private readonly config: ConfigService
  ) {}

  /**
   * Reimbursement reminder. Sent by the daily reminder cron when a
   * pending reimbursement's `dueDate` has passed AND the 24h send-cooldown
   * has elapsed. Returns `true` if the email was dispatched (so the cron
   * can stamp `lastReminderSentAt`), `false` if we couldn't send (no
   * email on file, template render error, etc.) — the cron leaves the
   * cooldown un-stamped in that case so we re-try the next day.
   */
  async notifyReimbursementReminder(input: {
    reimbursementId: string
    bookingGroupNumber: string
    amountOwedMajor: string
    currency: string
    dueDate: Date
    providerOwnerFirstName: string | null
    providerOwnerEmail: string | null
    providerLegalCompanyName: string | null
  }): Promise<boolean> {
    if (!input.providerOwnerEmail) {
      this.logger.warn(
        `notifyReimbursementReminder: no provider owner email for reimbursement ${input.reimbursementId}`
      )
      return false
    }

    const now = new Date()
    const daysOverdue = Math.floor((now.getTime() - input.dueDate.getTime()) / (24 * 3600 * 1000))

    const html = this.emailTemplate.getReimbursementReminderTemplate({
      providerOwnerFirstName: input.providerOwnerFirstName ?? 'there',
      providerLegalCompanyName: input.providerLegalCompanyName ?? 'your camp',
      bookingGroupNumber: input.bookingGroupNumber,
      amountOwedFormatted: formatAmount(input.amountOwedMajor, input.currency),
      dueDateFormatted: input.dueDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      daysOverdue,
      settlementInstructionsUrl: `${this.config.providerPortalUrl}/billing/reimbursements`,
    })

    try {
      await this.emailService.sendEmail({
        to: input.providerOwnerEmail,
        subject: 'Reimbursement due — World-Camps',
        html,
      })
      return true
    } catch (err) {
      this.logger.error(
        `notifyReimbursementReminder: sendEmail failed for reimbursement ${input.reimbursementId}: ${(err as Error).message}`
      )
      return false
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
