import { Injectable, Logger } from '@nestjs/common'
import { PaymentAuditEventType, PlatformFeeDisposition } from '../../../generated/client/enums'
import { PrismaService } from '../../../prisma/prisma.service'

/**
 * Append-only writer for `booking_payment_audit_log` (Payments revamp, Spec
 * v2.3 §Compliance). 10-year retention (Swiss CO Art. 958f); these rows are
 * NEVER updated or deleted — corrections are new rows referencing the original,
 * and the table is excluded from the 90-day webhook-event retention cron.
 *
 * Every capture scheduling/firing/failure/cancellation, refund, Force Majeure
 * action, and manual override appends a row here. The write is best-effort at
 * the call site's discretion: callers that must not lose the audit trail await
 * it inside their transaction; fire-and-forget callers may catch.
 */
export interface PaymentAuditEntry {
  actor: string
  eventType: PaymentAuditEventType
  bookingGroupId: string
  scheduledCaptureId?: string | null
  paymentIntentId?: string | null
  amountMinorUnits?: number | bigint | null
  currency?: string | null
  priorStatus?: string | null
  newStatus?: string | null
  reasonText?: string | null
  fmEventId?: string | null
  platformFeeDisposition?: PlatformFeeDisposition | null
}

/**
 * Event types that record a discretionary human decision (admin override or a
 * Force Majeure action). For these, a `reasonText` is mandatory (Spec v2.3
 * §Compliance / plan §1: "required for admin/FM, enforced in service") so the
 * 10-year audit trail always carries the justification behind the decision.
 */
const REASON_REQUIRED_EVENT_TYPES: ReadonlySet<PaymentAuditEventType> = new Set([
  PaymentAuditEventType.admin_override,
  PaymentAuditEventType.force_majeure_action,
])

@Injectable()
export class PaymentAuditLogService {
  private readonly logger = new Logger(PaymentAuditLogService.name)

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Enforce the reason-required contract for privileged events. Throws on a
   * contract violation (a programmer error) — this is intentionally NOT
   * swallowed by `appendSafe`, which only soft-fails on infrastructure errors.
   */
  private assertReasonProvided(entry: PaymentAuditEntry): void {
    if (REASON_REQUIRED_EVENT_TYPES.has(entry.eventType) && !entry.reasonText?.trim()) {
      throw new Error(
        `PaymentAuditLog: reasonText is required for ${entry.eventType} events (booking ${entry.bookingGroupId})`
      )
    }
  }

  /** Append one audit row. Append-only — never updates or deletes. */
  async append(entry: PaymentAuditEntry): Promise<void> {
    this.assertReasonProvided(entry)
    await this.prisma.bookingPaymentAuditLog.create({
      data: {
        actor: entry.actor,
        eventType: entry.eventType,
        bookingGroupId: entry.bookingGroupId,
        scheduledCaptureId: entry.scheduledCaptureId ?? null,
        paymentIntentId: entry.paymentIntentId ?? null,
        amountMinorUnits: entry.amountMinorUnits == null ? null : BigInt(entry.amountMinorUnits),
        currency: entry.currency ?? null,
        priorStatus: entry.priorStatus ?? null,
        newStatus: entry.newStatus ?? null,
        reasonText: entry.reasonText ?? null,
        fmEventId: entry.fmEventId ?? null,
        platformFeeDisposition: entry.platformFeeDisposition ?? null,
      },
    })
  }

  /**
   * Best-effort append — for hot paths where a logging failure must not fail
   * the surrounding operation (the row is reconstructable from Stripe + state).
   */
  async appendSafe(entry: PaymentAuditEntry): Promise<void> {
    // Contract violations (missing reason for a privileged event) must surface
    // loudly even on the best-effort path — only infrastructure failures below
    // are swallowed.
    this.assertReasonProvided(entry)
    try {
      await this.append(entry)
    } catch (err) {
      this.logger.error(
        `payment audit append failed (${entry.eventType}, booking ${entry.bookingGroupId}): ${
          err instanceof Error ? err.message : String(err)
        }`
      )
    }
  }
}
