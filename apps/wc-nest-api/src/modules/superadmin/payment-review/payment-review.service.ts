import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { PaymentAuditEventType } from '../../../generated/client/enums'
import { PrismaService } from '../../../prisma/prisma.service'
import { PaymentIntentsService } from '../../billing/intents/payment-intents.service'
import { RefundsService } from '../../billing/refunds/refunds.service'
import { PaymentAuditLogService } from '../../billing/shared/payment-audit-log.service'

export type ResolvePaymentReviewAction = 'cancel' | 'mark_resolved'

/**
 * Payment-review queue (Payments revamp, Spec v2.3 §7). A booking whose
 * scheduled capture exhausted its retries is routed to `payment_review` — NEVER
 * auto-cancelled. An admin triages from here:
 *   - `cancel`: cancel the booking and refund whatever was captured (camp-cancel
 *     mechanics); the shared sink stops future captures.
 *   - `mark_resolved`: the admin collected offline / waived — stamp the review
 *     resolved without a money action. The booking stays in `payment_review`
 *     status (no captures fire, and a non-null `paymentReviewStatus` keeps the
 *     reconciliation cron from re-escalating it).
 */
@Injectable()
export class PaymentReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly refunds: RefundsService,
    private readonly paymentIntents: PaymentIntentsService,
    private readonly audit: PaymentAuditLogService
  ) {}

  async list(filter: { limit?: number; offset?: number }) {
    const limit = Math.min(Math.max(filter.limit ?? 50, 1), 100)
    const offset = Math.max(filter.offset ?? 0, 0)
    const where = {
      paymentReviewStatus: { not: null },
      paymentReviewResolvedAt: null,
    }
    const [rows, total] = await Promise.all([
      this.prisma.bookingGroup.findMany({
        where,
        select: {
          id: true,
          bookingGroupNumber: true,
          status: true,
          totalAmount: true,
          paidAmount: true,
          paymentReviewStatus: true,
          paymentReviewFlaggedAt: true,
          camp: { select: { id: true, name: true } },
          provider: {
            select: { id: true, legalCompanyName: true, settings: { select: { currency: true } } },
          },
          parent: {
            select: {
              user: { select: { firstName: true, lastName: true, email: true } },
            },
          },
        },
        orderBy: { paymentReviewFlaggedAt: 'asc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.bookingGroup.count({ where }),
    ])
    return { rows, total, limit, offset }
  }

  async resolve(
    bookingGroupId: string,
    adminUserId: string,
    input: { action: ResolvePaymentReviewAction; notes?: string }
  ) {
    const bg = await this.prisma.bookingGroup.findUnique({
      where: { id: bookingGroupId },
      select: { id: true, paymentReviewStatus: true, paymentReviewResolvedAt: true },
    })
    if (!bg) throw new NotFoundException(`BookingGroup ${bookingGroupId} not found`)
    if (bg.paymentReviewStatus == null || bg.paymentReviewResolvedAt != null) {
      throw new BadRequestException('Booking is not in an open payment review')
    }

    if (input.action === 'cancel') {
      // Full refund of captured funds + cancel; the shared sink stops future
      // captures. cancelByCamp flips the booking to `cancelled`.
      await this.refunds.cancelByCamp({
        bookingGroupId,
        adminUserId,
        voidAuthFn: id =>
          this.paymentIntents
            .cancelForBookingGroup(id, 'requested_by_customer')
            .then(() => undefined),
      })
    }

    // Stamp the review resolved (idempotency-guarded on the still-open flag).
    await this.prisma.bookingGroup.updateMany({
      where: { id: bookingGroupId, paymentReviewResolvedAt: null },
      data: {
        paymentReviewResolvedAt: new Date(),
        paymentReviewResolvedByAdminId: adminUserId,
      },
    })

    await this.audit.appendSafe({
      actor: adminUserId,
      eventType: PaymentAuditEventType.admin_override,
      bookingGroupId,
      reasonText: `payment_review resolved (${input.action})${input.notes ? `: ${input.notes}` : ''}`,
    })

    return this.prisma.bookingGroup.findUnique({
      where: { id: bookingGroupId },
      select: {
        id: true,
        status: true,
        paymentReviewStatus: true,
        paymentReviewResolvedAt: true,
        paymentReviewResolvedByAdminId: true,
      },
    })
  }
}
