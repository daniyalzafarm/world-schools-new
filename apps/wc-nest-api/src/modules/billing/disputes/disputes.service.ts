import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { NotificationType } from '@world-schools/wc-types'
import Stripe from 'stripe'
import { Prisma } from '../../../generated/client/client'
import { DisputeOutcome } from '../../../generated/client/enums'
import { PrismaService } from '../../../prisma/prisma.service'
import { notify } from '../../notifications/dispatcher/notify'
import { StripeService } from '../../stripe/stripe.service'
import { billingAudit } from '../shared/audit-log.util'

type StripeDispute = Awaited<ReturnType<InstanceType<typeof Stripe>['disputes']['retrieve']>>
// `disputes.update` takes `(id, params, options)` where params is the second
// arg. Stripe's typings mark it as optional in some versions; we narrow to
// the non-undefined shape and pluck the evidence sub-shape.
type StripeDisputeUpdateParams = NonNullable<
  Parameters<InstanceType<typeof Stripe>['disputes']['update']>[1]
>
type StripeEvidence = NonNullable<StripeDisputeUpdateParams['evidence']>

const TERMINAL_STATUSES = new Set(['won', 'lost', 'warning_closed', 'charge_refunded'])

/**
 * Stripe dispute evidence text fields the superadmin UI exposes today.
 * The Stripe API supports more (~25 fields) but most are reason-specific —
 * we ship the common-denominator set first and broaden later if a flow needs
 * something more specific. File evidence uploads through `stripe.files.create`
 * with `purpose=dispute_evidence` and the resulting file id is attached to a
 * matching evidence key (e.g. `receipt`, `customer_signature`).
 */
export type DisputeEvidenceField =
  | 'customer_name'
  | 'customer_email_address'
  | 'customer_purchase_ip'
  | 'product_description'
  | 'customer_communication'
  | 'shipping_address'
  | 'shipping_documentation'
  | 'service_date'
  | 'service_documentation'
  | 'refund_policy'
  | 'refund_policy_disclosure'
  | 'cancellation_policy'
  | 'cancellation_policy_disclosure'
  | 'access_activity_log'
  | 'uncategorized_text'

const TEXT_EVIDENCE_FIELDS: ReadonlySet<DisputeEvidenceField> = new Set<DisputeEvidenceField>([
  'customer_name',
  'customer_email_address',
  'customer_purchase_ip',
  'product_description',
  'customer_communication',
  'shipping_address',
  'service_date',
  'refund_policy',
  'refund_policy_disclosure',
  'cancellation_policy',
  'cancellation_policy_disclosure',
  'access_activity_log',
  'uncategorized_text',
])

const FILE_EVIDENCE_FIELDS: ReadonlySet<DisputeEvidenceField> = new Set<DisputeEvidenceField>([
  'shipping_documentation',
  'service_documentation',
])

function classifyOutcome(status: string): DisputeOutcome {
  if (status === 'won') return DisputeOutcome.won
  if (status === 'lost') return DisputeOutcome.lost
  if (status === 'warning_closed') return DisputeOutcome.warning_closed
  if (TERMINAL_STATUSES.has(status)) return DisputeOutcome.other
  return DisputeOutcome.open
}

const ADMIN_DETAIL_INCLUDE = {
  payment: {
    select: {
      id: true,
      kind: true,
      stripeChargeId: true,
      stripePaymentIntentId: true,
      amount: true,
      currency: true,
    },
  },
  bookingGroup: {
    select: {
      id: true,
      bookingGroupNumber: true,
      status: true,
      camp: { select: { id: true, name: true } },
      parent: {
        select: {
          user: { select: { firstName: true, lastName: true, email: true } },
        },
      },
      provider: { select: { id: true, legalCompanyName: true } },
    },
  },
} as const

@Injectable()
export class DisputesService {
  private readonly logger = new Logger(DisputesService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
    private readonly eventEmitter: EventEmitter2
  ) {}

  /**
   * Webhook: `charge.dispute.created`. Insert a Dispute row and flag the
   * BookingGroup as `disputed` so the superadmin dashboard can surface it
   * urgently. Disputes withdraw funds from the platform balance with little
   * notice — every minute of operator visibility matters.
   */
  async handleCreated(dispute: StripeDispute): Promise<void> {
    const payment = await this.findPaymentForDispute(dispute)
    if (!payment) {
      this.logger.warn(
        `disputes.unknown_charge stripe_dispute=${dispute.id} charge=${dispute.charge}`
      )
      return
    }

    const status = dispute.status ?? 'needs_response'
    // Track whether the upsert actually created a row so we only notify once.
    let createdNewRow = false
    await this.prisma.$transaction(async tx => {
      const existing = await tx.dispute.findUnique({
        where: { stripeDisputeId: dispute.id },
        select: { id: true },
      })
      await tx.dispute.upsert({
        where: { stripeDisputeId: dispute.id },
        create: {
          paymentId: payment.id,
          bookingGroupId: payment.bookingGroupId,
          stripeDisputeId: dispute.id,
          amount: new Prisma.Decimal(dispute.amount).div(100),
          currency: dispute.currency,
          reason: dispute.reason,
          status,
          outcome: classifyOutcome(status),
          evidenceDueBy:
            dispute.evidence_details?.due_by != null
              ? new Date(dispute.evidence_details.due_by * 1000)
              : null,
        },
        update: {
          status,
          outcome: classifyOutcome(status),
        },
      })
      createdNewRow = !existing
      await tx.bookingGroup.update({
        where: { id: payment.bookingGroupId },
        data: { status: 'disputed' },
      })
    })

    billingAudit(this.logger, 'dispute_created', {
      bookingGroupId: payment.bookingGroupId,
      stripeDisputeId: dispute.id,
      amount: dispute.amount,
      currency: dispute.currency,
      reason: dispute.reason,
    })

    if (createdNewRow) {
      // v28 catalog dispatch — parent notification when a chargeback first
      // appears. Skip on the update path so a stream of stripe status churn
      // (`needs_response` → `under_review`) doesn't re-notify.
      const row = await this.prisma.dispute.findUnique({
        where: { stripeDisputeId: dispute.id },
        select: { id: true },
      })
      if (row) {
        notify(this.eventEmitter, NotificationType.ParentDisputeOpened, {
          disputeId: row.id,
          bookingGroupId: payment.bookingGroupId,
          paymentId: payment.id,
        })
        // provider-side mirror. The catalog entry uses the
        // `providerOwnerForBooking` resolver so only the camp owner sees
        // it; chargebacks are commercially sensitive and the spec puts
        // them on a single accountable person.
        notify(this.eventEmitter, NotificationType.ProviderDisputeOpened, {
          disputeId: row.id,
          bookingGroupId: payment.bookingGroupId,
          paymentId: payment.id,
        })
        // superadmin mirror. Stripe imposes hard response
        // deadlines on chargebacks; the admin team gets a parallel alert
        // so platform-level response coordination starts immediately.
        notify(this.eventEmitter, NotificationType.SuperadminDisputeFiled, {
          disputeId: row.id,
          bookingGroupId: payment.bookingGroupId,
          paymentId: payment.id,
        })
      }
    }
  }

  /**
   * Webhook: `charge.dispute.closed`. Update outcome.
   *
   * For a lost dispute, Stripe automatically refunds the charge. That refund
   * fires its own `charge.refunded` / `refund.updated` webhook, which our
   * `RefundsService.markRefundCompleted` handles end-to-end (including
   * creating a Refund row via the orphan-recovery path and a Reimbursement
   * row when `transferDate` has passed). DisputesService does NOT create the
   * Reimbursement directly here — that responsibility lives in the refund
   * webhook handler so all reimbursement-creating paths funnel through one
   * place.
   */
  async handleClosed(dispute: StripeDispute): Promise<void> {
    const row = await this.prisma.dispute.findUnique({
      where: { stripeDisputeId: dispute.id },
    })
    if (!row) {
      this.logger.warn(`disputes.close_unknown stripe_dispute=${dispute.id}`)
      // The create webhook may have arrived after — handle inline so we
      // don't lose the audit trail.
      await this.handleCreated(dispute)
      return
    }
    const outcome = classifyOutcome(dispute.status ?? '')
    const prevOutcome = row.outcome
    await this.prisma.dispute.update({
      where: { id: row.id },
      data: { status: dispute.status ?? row.status, outcome },
    })

    billingAudit(this.logger, 'dispute_closed', {
      bookingGroupId: row.bookingGroupId,
      stripeDisputeId: dispute.id,
      outcome,
    })

    // only fire on the transition into a terminal
    // outcome (won / lost) and only once per outcome change, including
    // the provider-side mirrors (single recipient = camp owner).
    if (outcome !== prevOutcome) {
      const parentType =
        outcome === DisputeOutcome.won
          ? NotificationType.ParentDisputeResolvedWon
          : outcome === DisputeOutcome.lost
            ? NotificationType.ParentDisputeResolvedLost
            : null
      const providerType =
        outcome === DisputeOutcome.won
          ? NotificationType.ProviderDisputeResolvedWon
          : outcome === DisputeOutcome.lost
            ? NotificationType.ProviderDisputeResolvedLost
            : null
      const ctx = {
        disputeId: row.id,
        bookingGroupId: row.bookingGroupId,
        paymentId: row.paymentId,
      }
      if (parentType) notify(this.eventEmitter, parentType, ctx)
      if (providerType) notify(this.eventEmitter, providerType, ctx)
      // single superadmin "resolved" notification regardless
      // of outcome; the loader includes `outcome` in props for the
      // template to render the "in favour of …" sentence.
      if (outcome === DisputeOutcome.won || outcome === DisputeOutcome.lost) {
        notify(this.eventEmitter, NotificationType.SuperadminDisputeResolved, {
          ...ctx,
          extra: { outcome: outcome === DisputeOutcome.won ? 'won' : 'lost' },
        })
      }
    }
  }

  /**
   * handle `charge.dispute.funds_withdrawn` and
   * `charge.dispute.funds_reinstated`. Stripe debits the connected account
   * immediately on dispute and may reinstate if the dispute is later won;
   * tracking the most recent timestamp lets the admin UI surface a "Funds
   * withdrawn" pill so operators know whether the camp's been hit.
   */
  async handleFundsMovement(
    dispute: StripeDispute,
    movement: 'withdrawn' | 'reinstated'
  ): Promise<void> {
    const row = await this.prisma.dispute.findUnique({
      where: { stripeDisputeId: dispute.id },
      select: { id: true, bookingGroupId: true },
    })
    if (!row) {
      this.logger.warn(
        `disputes.funds_movement_unknown stripe_dispute=${dispute.id} movement=${movement}`
      )
      return
    }
    const now = new Date()
    await this.prisma.dispute.update({
      where: { id: row.id },
      data: movement === 'withdrawn' ? { fundsWithdrawnAt: now } : { fundsReinstatedAt: now },
    })
    billingAudit(this.logger, 'dispute_funds_movement', {
      bookingGroupId: row.bookingGroupId,
      stripeDisputeId: dispute.id,
      movement,
    })
  }

  private async findPaymentForDispute(dispute: StripeDispute) {
    const chargeId = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id
    if (!chargeId) return null
    return await this.prisma.payment.findFirst({
      where: { stripeChargeId: chargeId },
      select: { id: true, bookingGroupId: true },
    })
  }

  // ===== Superadmin UI =====================================

  /**
   * Paginated list for the superadmin disputes queue. Sorted by `evidenceDueBy
   * ASC NULLS LAST` so disputes closest to their evidence deadline sit at the
   * top — that's where operator urgency is highest. The `outcome` filter maps
   * 1:1 with the UI's status tabs (open/won/lost/warning_closed/all).
   */
  async listForAdmin(input: {
    outcome?: DisputeOutcome | DisputeOutcome[]
    limit?: number
    offset?: number
  }) {
    const limit = Math.min(Math.max(input.limit ?? 50, 1), 200)
    const offset = Math.max(input.offset ?? 0, 0)
    const outcomeFilter = Array.isArray(input.outcome)
      ? { in: input.outcome }
      : input.outcome
        ? { equals: input.outcome }
        : undefined

    const where: Prisma.DisputeWhereInput = outcomeFilter ? { outcome: outcomeFilter } : {}

    const [rows, total] = await Promise.all([
      this.prisma.dispute.findMany({
        where,
        // Open disputes first by deadline urgency, closed disputes by recency.
        orderBy: [{ evidenceDueBy: 'asc' }, { createdAt: 'desc' }],
        take: limit,
        skip: offset,
        include: ADMIN_DETAIL_INCLUDE,
      }),
      this.prisma.dispute.count({ where }),
    ])
    return { rows, total, limit, offset }
  }

  async findByIdForAdmin(id: string) {
    return await this.prisma.dispute.findUnique({
      where: { id },
      include: ADMIN_DETAIL_INCLUDE,
    })
  }

  /**
   * Submit (or save as draft) evidence to Stripe for a disputed charge.
   *
   * Flow:
   *   1. Validate the dispute is still in a state Stripe accepts evidence
   *      for (terminal disputes already have an outcome — Stripe rejects
   *      `disputes.update` with a 400). We short-circuit with a clearer
   *      error message than Stripe's.
   *   2. Each file in `fileUploads` is uploaded to Stripe via
   *      `files.create` with `purpose=dispute_evidence`; the resulting
   *      file id is attached to the matching evidence key.
   *   3. Text fields are passed through verbatim.
   *   4. Stripe's response refreshes our local `status`/`outcome` if it
   *      moved (Stripe will set `status=under_review` on submit).
   */
  async submitEvidence(input: {
    disputeId: string
    adminUserId: string
    submit: boolean
    fields: Partial<Record<DisputeEvidenceField, string>>
    fileUploads: Array<{
      field: DisputeEvidenceField
      filename: string
      mimetype: string
      buffer: Buffer
    }>
  }) {
    const row = await this.prisma.dispute.findUnique({
      where: { id: input.disputeId },
      select: {
        id: true,
        stripeDisputeId: true,
        status: true,
        outcome: true,
        bookingGroupId: true,
        // Direct Charges: the dispute lives on the connected account, so all
        // Stripe API calls (file upload, disputes.update) must include the
        // `Stripe-Account` header. `Payment.stripeAccountId` is the
        // denormalized snapshot captured at PaymentIntent create time.
        payment: { select: { stripeAccountId: true } },
      },
    })
    if (!row) throw new NotFoundException(`Dispute ${input.disputeId} not found`)
    const stripeAccountId = row.payment.stripeAccountId

    if (row.outcome !== DisputeOutcome.open) {
      throw new BadRequestException(
        `Dispute ${row.id} is no longer open (outcome=${row.outcome}); evidence cannot be submitted.`
      )
    }

    // Validate every file's target field is a known file-typed evidence
    // slot. Misrouted files (e.g. someone tries to upload a PDF for
    // `customer_name`) would be silently accepted by Stripe with weird
    // results — fail loud here instead.
    for (const upload of input.fileUploads) {
      if (!FILE_EVIDENCE_FIELDS.has(upload.field)) {
        throw new BadRequestException(
          `Evidence field "${upload.field}" does not accept file uploads. ` +
            `Supported file fields: ${[...FILE_EVIDENCE_FIELDS].join(', ')}.`
        )
      }
    }

    const evidence: StripeEvidence = {}

    // Text fields — pass through, drop empty strings so we don't overwrite
    // already-populated Stripe state with blanks.
    for (const [field, value] of Object.entries(input.fields)) {
      if (!TEXT_EVIDENCE_FIELDS.has(field as DisputeEvidenceField)) {
        throw new BadRequestException(
          `Evidence field "${field}" is not a recognized text field. ` +
            `Supported text fields: ${[...TEXT_EVIDENCE_FIELDS].join(', ')}.`
        )
      }
      const trimmed = value?.trim()
      if (trimmed) {
        ;(evidence as Record<string, unknown>)[field] = trimmed
      }
    }

    // File uploads + dispute update wrapped together. Track every successful
    // upload id so we can audit orphans on ANY failure mid-sequence — a
    // mid-loop failure (e.g. Stripe rate-limit on file 2 of 4) is just as
    // orphan-prone as a final dispute-update failure. Stripe's File API is
    // immutable (no delete), so the audit log is the only handle operators
    // have for manual cleanup.
    const uploadedFileIds: string[] = []
    let updated: Awaited<ReturnType<typeof this.stripeService.client.disputes.update>>
    try {
      for (const upload of input.fileUploads) {
        // Direct Charges: dispute evidence files must be uploaded to the
        // connected account (the same one that owns the dispute) — Stripe
        // rejects platform-account file ids on a connected-account dispute.
        const stripeFile = await this.stripeService.client.files.create(
          {
            purpose: 'dispute_evidence',
            file: {
              data: upload.buffer,
              name: upload.filename,
              type: upload.mimetype,
            },
          },
          { stripeAccount: stripeAccountId }
        )
        uploadedFileIds.push(stripeFile.id)
        ;(evidence as Record<string, unknown>)[upload.field] = stripeFile.id
      }

      updated = await this.stripeService.client.disputes.update(
        row.stripeDisputeId,
        { evidence, submit: input.submit },
        { stripeAccount: stripeAccountId }
      )
    } catch (err) {
      if (uploadedFileIds.length > 0) {
        billingAudit(this.logger, 'dispute_evidence_orphan', {
          disputeId: row.id,
          stripeDisputeId: row.stripeDisputeId,
          stripeFileIds: uploadedFileIds.join(','),
          error: err instanceof Error ? err.message : String(err),
        })
      }
      throw err
    }

    // Stripe transitions `status` on a submit; refresh our local row to keep
    // the UI in sync without waiting for the next webhook (which can lag).
    //
    // Race-safety: a `charge.dispute.closed` webhook may have arrived between
    // our pre-check (`row.outcome === open`) and now (Stripe ruled fast or
    // we hit a slow path). If that happened, the local outcome is already
    // terminal and reflects the canonical answer — Stripe's response to our
    // `disputes.update` call may still report an in-flight status (e.g.
    // `under_review`) that's actually stale. Trust the webhook over the
    // API response: only persist the refreshed status if the local row is
    // still `open`. We use a transaction to make the read+write atomic.
    const refreshedStatus = updated.status ?? row.status
    const refreshedOutcome = classifyOutcome(refreshedStatus)
    const persisted = await this.prisma.$transaction(async tx => {
      const fresh = await tx.dispute.findUniqueOrThrow({
        where: { id: row.id },
        select: { outcome: true },
      })
      if (fresh.outcome !== DisputeOutcome.open) {
        // Webhook beat us. Don't downgrade the terminal classification.
        return tx.dispute.findUniqueOrThrow({
          where: { id: row.id },
          include: ADMIN_DETAIL_INCLUDE,
        })
      }
      return tx.dispute.update({
        where: { id: row.id },
        data: { status: refreshedStatus, outcome: refreshedOutcome },
        include: ADMIN_DETAIL_INCLUDE,
      })
    })

    billingAudit(this.logger, 'dispute_evidence_submitted', {
      bookingGroupId: row.bookingGroupId,
      stripeDisputeId: row.stripeDisputeId,
      adminUserId: input.adminUserId,
      submit: input.submit,
      textFieldCount: Object.keys(input.fields).length,
      fileFieldCount: input.fileUploads.length,
      newStatus: refreshedStatus,
    })

    return persisted
  }

  /**
   * Manual outcome override — for the rare case where Stripe's webhook is
   * delayed or stuck and an operator needs to close a dispute in our system
   * for downstream reconciliation. This does NOT call Stripe (Stripe owns the
   * authoritative `status`); it only updates our local DB classification so
   * the UI can move on. The note is captured for audit.
   */
  async recordOutcomeOverride(input: {
    disputeId: string
    outcome: DisputeOutcome
    note?: string
    adminUserId: string
  }) {
    const row = await this.prisma.dispute.findUnique({
      where: { id: input.disputeId },
      select: { id: true, stripeDisputeId: true, bookingGroupId: true, outcome: true },
    })
    if (!row) throw new NotFoundException(`Dispute ${input.disputeId} not found`)
    if (input.outcome === DisputeOutcome.open) {
      throw new BadRequestException(
        'Override outcome must be one of: won, lost, warning_closed, other.'
      )
    }

    const persisted = await this.prisma.dispute.update({
      where: { id: row.id },
      data: { outcome: input.outcome },
      include: ADMIN_DETAIL_INCLUDE,
    })

    billingAudit(this.logger, 'dispute_outcome_override', {
      bookingGroupId: row.bookingGroupId,
      stripeDisputeId: row.stripeDisputeId,
      adminUserId: input.adminUserId,
      previousOutcome: row.outcome,
      newOutcome: input.outcome,
      note: input.note ?? null,
    })

    return persisted
  }
}
