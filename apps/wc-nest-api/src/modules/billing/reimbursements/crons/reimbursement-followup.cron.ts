import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { PrismaService } from '../../../../prisma/prisma.service'
import { RedisService } from '../../../redis/redis.service'
import { ReimbursementsNotificationsService } from '../notifications/reimbursements-notifications.service'
import { ReimbursementsService } from '../reimbursements.service'

const LOCK_KEY = 'cron:lock:reimbursement-followup'
const LOCK_TTL_SECONDS = 600 // 10 min — comfortably longer than a worst-case batch

/**
 * Daily reminder cron for overdue reimbursements (the camp's debt to the
 * platform after a post-payout refund). Mirrors the Phase 3 balance-charge
 * cron pattern: Redis SET-NX lock, batch processing, per-row best-effort
 * email send, idempotent at the row level via `lastReminderSentAt` + the
 * 24h cooldown enforced by `findOverdueForReminder`.
 *
 * Stamping behavior: we ONLY stamp `lastReminderSentAt` after the email
 * actually dispatches (`notifyReimbursementReminder` returns true). If
 * the send fails for any reason — no provider email on file, SMTP down,
 * template render error — the row is left un-stamped so the cron tries
 * again the next day. This is the right tradeoff: a missed reminder is
 * recoverable (we'll send tomorrow); a wrongly-stamped reminder means
 * the camp never hears from us.
 */
@Injectable()
export class ReimbursementFollowupCron {
  private readonly logger = new Logger(ReimbursementFollowupCron.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly reimbursements: ReimbursementsService,
    private readonly notifications: ReimbursementsNotificationsService
  ) {}

  @Cron('0 9 * * *')
  async run(): Promise<void> {
    const redis = this.redis.getClient()
    const acquired = await redis.set(LOCK_KEY, '1', 'EX', LOCK_TTL_SECONDS, 'NX')
    if (!acquired) {
      this.logger.debug('reimbursement-followup cron already running on another instance, skipping')
      return
    }
    try {
      await this.runBatch()
    } finally {
      await redis.del(LOCK_KEY)
    }
  }

  /**
   * Visible for testing — exposed without the `@Cron` lock so specs can
   * drive the batch logic directly with mocked services.
   */
  async runBatch(): Promise<{ sent: number; skipped: number }> {
    const candidates = await this.reimbursements.findOverdueForReminder()
    if (candidates.length === 0) {
      this.logger.debug('reimbursement-followup cron: no overdue candidates')
      return { sent: 0, skipped: 0 }
    }

    let sent = 0
    let skipped = 0

    for (const row of candidates) {
      // Defense-in-depth: re-check status at iteration time. Between
      // findOverdueForReminder and now, an admin may have settled or
      // written-off this row in the dashboard. Don't email a settled debt.
      const fresh = await this.prisma.reimbursement.findUnique({
        where: { id: row.id },
        select: { status: true },
      })
      if (fresh?.status !== 'pending') {
        skipped++
        continue
      }

      const ownerEmail = row.bookingGroup.provider.owner?.email ?? null
      const ownerFirstName = row.bookingGroup.provider.owner?.firstName ?? null
      const providerName = row.bookingGroup.provider.legalCompanyName ?? null

      let dispatched: boolean
      try {
        dispatched = await this.notifications.notifyReimbursementReminder({
          reimbursementId: row.id,
          bookingGroupNumber: row.bookingGroup.bookingGroupNumber,
          amountOwedMajor: row.amountOwed.toFixed(2),
          currency: row.currency,
          dueDate: row.dueDate,
          providerOwnerFirstName: ownerFirstName,
          providerOwnerEmail: ownerEmail,
          providerLegalCompanyName: providerName,
        })
      } catch (err) {
        // Defensive — notifications service catches its own errors and
        // returns false; a thrown error here would be unexpected. Log
        // and move on.
        this.logger.error(
          `reimbursement-followup: notify failed for ${row.id}: ${(err as Error).message}`
        )
        skipped++
        continue
      }

      if (dispatched) {
        await this.reimbursements.stampReminderSent(row.id)
        sent++
      } else {
        skipped++
      }
    }

    this.logger.log(
      `reimbursement-followup cron: candidates=${candidates.length} sent=${sent} skipped=${skipped}`
    )
    return { sent, skipped }
  }
}
