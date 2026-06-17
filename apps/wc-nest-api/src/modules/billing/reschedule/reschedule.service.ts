import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { PaymentAuditEventType, RescheduleProposalStatus } from '../../../generated/client/enums'
import { PrismaService } from '../../../prisma/prisma.service'
import { CAPTURE_ELIGIBLE_STATUSES } from '../shared/capture-eligible-statuses'
import {
  buildConsentChargeSchedule,
  buildConsentDepositInfo,
} from '../shared/consent-snapshot.util'
import { PaymentAuditLogService } from '../shared/payment-audit-log.service'
import { CaptureSchedulerService } from '../captures/capture-scheduler.service'
import { Prisma } from '../../../generated/client/client'

/**
 * Programme Reschedule by Provider (Payments revamp, Spec v2.5 §9.7).
 *
 * A Provider may not unilaterally move Programme dates after acceptance — a
 * change needs the affected Customer's consent (PT §5.3). Flow:
 *  - Provider PROPOSES a new start → a `pending` `RescheduleProposal`.
 *  - Customer CONSENTS → recompute the capture schedule + cancellation bands
 *    against the new start, re-capture the consent snapshot, audit
 *    `reschedule_recompute`. Amounts already captured are untouched.
 *  - Customer DECLINES (or the proposal lapses) → the original dates stand; the
 *    Provider separately honours them or cancels via the §9.5 provider-cancel.
 */
@Injectable()
export class RescheduleService {
  private readonly logger = new Logger(RescheduleService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduler: CaptureSchedulerService,
    private readonly audit: PaymentAuditLogService
  ) {}

  /** Provider proposes a new programme start for an accepted booking. */
  async propose(input: {
    providerId: string
    proposedByUserId: string
    bookingGroupId: string
    proposedStartDate: Date
    reasonText?: string | null
  }): Promise<{ proposalId: string }> {
    const booking = await this.prisma.bookingGroup.findUnique({
      where: { id: input.bookingGroupId },
      select: {
        id: true,
        providerId: true,
        status: true,
        respondedAt: true,
        rescheduledStartDate: true,
        session: { select: { startDate: true } },
      },
    })
    if (!booking) throw new NotFoundException('Booking group not found')
    if (booking.providerId !== input.providerId) {
      throw new ForbiddenException('This booking does not belong to your provider account')
    }
    if (!booking.respondedAt || !CAPTURE_ELIGIBLE_STATUSES.includes(booking.status)) {
      throw new BadRequestException('Only an accepted, active booking can be rescheduled')
    }
    if (Number.isNaN(input.proposedStartDate.getTime())) {
      throw new BadRequestException('Invalid proposed start date')
    }

    const existingPending = await this.prisma.rescheduleProposal.findFirst({
      where: { bookingGroupId: booking.id, status: RescheduleProposalStatus.pending },
      select: { id: true },
    })
    if (existingPending) {
      throw new ConflictException('A reschedule proposal is already awaiting the customer')
    }

    // Fail fast if the recompute isn't currently feasible (in-flight/failed capture).
    await this.scheduler.planReschedule(booking.id, input.proposedStartDate)

    const proposal = await this.prisma.rescheduleProposal.create({
      data: {
        bookingGroupId: booking.id,
        proposedByUserId: input.proposedByUserId,
        originalStartDate: booking.rescheduledStartDate ?? booking.session.startDate,
        proposedStartDate: input.proposedStartDate,
        reasonText: input.reasonText ?? null,
      },
      select: { id: true },
    })
    return { proposalId: proposal.id }
  }

  /** Read-only: the pending proposal + a preview of the recomputed schedule. */
  async getPending(bookingGroupId: string, parentUserId: string) {
    const booking = await this.loadOwnedBooking(bookingGroupId, parentUserId)
    const proposal = await this.prisma.rescheduleProposal.findFirst({
      where: { bookingGroupId: booking.id, status: RescheduleProposalStatus.pending },
      orderBy: { createdAt: 'desc' },
    })
    if (!proposal) return { pending: null }

    const plan = await this.scheduler.planReschedule(booking.id, proposal.proposedStartDate)
    return {
      pending: {
        proposalId: proposal.id,
        originalStartDate: proposal.originalStartDate.toISOString(),
        proposedStartDate: proposal.proposedStartDate.toISOString(),
        reasonText: proposal.reasonText,
        newSchedule: plan.events.map(e => ({
          sequence: e.sequence,
          kind: e.kind,
          amount: e.amount,
          captureDate: e.captureDate.toISOString(),
        })),
      },
    }
  }

  /**
   * Customer consents to the new dates: recompute + re-snapshot + audit, all in
   * ONE transaction (capture rows, rescheduledStartDate, consent snapshot, and the
   * proposal flip commit together); job dispatch + audit happen after commit.
   */
  async consent(input: {
    bookingGroupId: string
    parentUserId: string
    proposalId: string
    ipAddress?: string | null
    userAgent?: string | null
    policyTextShown?: string | null
    schemaVersion?: number | null
  }): Promise<{ status: 'consented' }> {
    const booking = await this.loadOwnedBooking(input.bookingGroupId, input.parentUserId)
    const proposal = await this.prisma.rescheduleProposal.findUnique({
      where: { id: input.proposalId },
    })
    if (
      proposal?.bookingGroupId !== booking.id ||
      proposal.status !== RescheduleProposalStatus.pending
    ) {
      throw new BadRequestException('No pending reschedule proposal to consent to')
    }

    const now = new Date()
    const plan = await this.scheduler.planReschedule(booking.id, proposal.proposedStartDate, now)
    const chargeSchedule = buildConsentChargeSchedule(plan.schedule, plan.graceDeadline)
    const depositInfo = buildConsentDepositInfo({
      depositAmountMajor: plan.depositForConsentMajor,
      campDepositEnabled: booking.campDepositEnabled,
    })

    await this.prisma.$transaction(async tx => {
      // (a) regenerate the not-yet-fired capture rows against the new start
      await this.scheduler.writeRescheduleRows(tx, plan)
      // (b) record the agreed new start
      await tx.bookingGroup.update({
        where: { id: booking.id },
        data: { rescheduledStartDate: proposal.proposedStartDate },
      })
      // (c) supersede the prior consent snapshot + insert the re-acknowledged one
      await tx.bookingConsentSnapshot.updateMany({
        where: { bookingGroupId: booking.id, supersededAt: null },
        data: { supersededAt: now },
      })
      await tx.bookingConsentSnapshot.create({
        data: {
          bookingGroupId: booking.id,
          policyText: input.policyTextShown ?? '',
          chargeSchedule: chargeSchedule as unknown as Prisma.InputJsonValue,
          depositInfo: depositInfo as unknown as Prisma.InputJsonValue,
          gracePeriodHours: 24,
          acknowledgedAt: now,
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent ?? null,
          schemaVersion: input.schemaVersion ?? 1,
        },
      })
      // (d) close the proposal
      await tx.rescheduleProposal.update({
        where: { id: proposal.id },
        data: {
          status: RescheduleProposalStatus.consented,
          respondedByUserId: input.parentUserId,
          respondedAt: now,
        },
      })
    })

    // Post-commit: dispatch the regenerated rows + append the audit row (10-yr).
    await this.scheduler.dispatchRescheduleRows(plan, now)
    await this.audit.appendSafe({
      actor: `user:${input.parentUserId}`,
      eventType: PaymentAuditEventType.reschedule_recompute,
      bookingGroupId: booking.id,
      reasonText: `Customer consented to provider reschedule to ${proposal.proposedStartDate.toISOString()}`,
    })
    this.logger.log(
      `booking ${booking.id} rescheduled to ${proposal.proposedStartDate.toISOString()} (consented)`
    )
    return { status: 'consented' }
  }

  /** Customer declines: the original dates stand; no financial action (§9.7). */
  async decline(input: {
    bookingGroupId: string
    parentUserId: string
    proposalId: string
  }): Promise<{ status: 'declined' }> {
    const booking = await this.loadOwnedBooking(input.bookingGroupId, input.parentUserId)
    const res = await this.prisma.rescheduleProposal.updateMany({
      where: {
        id: input.proposalId,
        bookingGroupId: booking.id,
        status: RescheduleProposalStatus.pending,
      },
      data: {
        status: RescheduleProposalStatus.declined,
        respondedByUserId: input.parentUserId,
        respondedAt: new Date(),
      },
    })
    if (res.count === 0) throw new BadRequestException('No pending reschedule proposal to decline')
    return { status: 'declined' }
  }

  private async loadOwnedBooking(bookingGroupId: string, parentUserId: string) {
    const booking = await this.prisma.bookingGroup.findUnique({
      where: { id: bookingGroupId },
      select: {
        id: true,
        parent: { select: { userId: true } },
        camp: { select: { depositEnabled: true } },
      },
    })
    if (!booking) throw new NotFoundException('Booking group not found')
    if (booking.parent.userId !== parentUserId) {
      throw new ForbiddenException('You do not own this booking')
    }
    return { id: booking.id, campDepositEnabled: booking.camp.depositEnabled }
  }
}
