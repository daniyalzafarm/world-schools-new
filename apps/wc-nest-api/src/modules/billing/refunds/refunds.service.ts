import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import Stripe from 'stripe'
import { notify } from '../../notifications/dispatcher/notify'
import { Prisma } from '../../../generated/client/client'
import {
  BookingGroupStatus,
  PaymentKind,
  PaymentStatus,
  RefundReason,
  RefundStatus,
  ReimbursementStatus,
} from '../../../generated/client/enums'
import { PrismaService } from '../../../prisma/prisma.service'
import { RedisService } from '../../redis/redis.service'
import { StripeService } from '../../stripe/stripe.service'
import { CancelCaptureService } from '../captures/cancel-capture.service'
import { PayoutsService } from '../payouts/payouts.service'
import { ReimbursementsService } from '../reimbursements/reimbursements.service'
import { billingAudit } from '../shared/audit-log.util'
import { NotificationType, type SpecialCircumstanceType } from '@world-schools/wc-types'
import {
  evaluatePolicy as evaluatePolicySnapshot,
  PolicySnapshot,
} from '../shared/cancellation-policy.util'
import { buildIdempotencyKey } from '../shared/idempotency.util'
import { toStripeMinorUnits } from '../shared/money.util'
import { withStripeErrors } from '../shared/with-stripe-errors.util'

type StripeClient = InstanceType<typeof Stripe>
type StripeRefund = Awaited<ReturnType<StripeClient['refunds']['create']>>
type StripeCharge = Awaited<ReturnType<StripeClient['charges']['retrieve']>>
type RefundCreateParams = Parameters<StripeClient['refunds']['create']>[0]

const REFUND_LOCK_TTL_SECONDS = 30

interface RefundInput {
  bookingGroupId: string
  initiatedByUserId?: string
  /**
   * Optional special-circumstance claim (medical / force_majeure / weather).
   * When set AND the provider has configured a refund % for that circumstance,
   * the standard tier % is OVERRIDDEN for the balance refund. Deposit is still
   * non-refundable. Override only kicks in if it would help the parent — never
   * reduces a refund the parent already qualifies for under standard policy.
   */
  circumstance?: SpecialCircumstanceType | null
}

/**
 * BookingGroup statuses where the parent-initiated cancel button MUST be a
 * no-op. `cancelled` / `declined` / `expired` / `fully_refunded` /
 * `partially_refunded` are already terminal; `at_camp` / `completed` mean
 * the program has run (parent can't undo it after the fact); `payment_failed`
 * means an admin needs to intervene; `disputed` means Stripe is the
 * authority. The provider-side cancel paths (camp_cancel, force_majeure)
 * have their own status guards in their public methods.
 */
const NON_CANCELABLE_BOOKING_STATUSES: ReadonlySet<BookingGroupStatus> =
  new Set<BookingGroupStatus>([
    BookingGroupStatus.cancelled,
    BookingGroupStatus.declined,
    BookingGroupStatus.expired,
    BookingGroupStatus.at_camp,
    BookingGroupStatus.completed,
    BookingGroupStatus.payment_failed,
    BookingGroupStatus.fully_refunded,
    BookingGroupStatus.partially_refunded,
    BookingGroupStatus.disputed,
  ])

export type ParentCancelMode = 'void_auth' | 'grace' | 'policy' | 'not_cancelable'

export interface RefundPreviewItem {
  paymentId: string
  kind: PaymentKind
  originalAmountMajor: string
  refundAmountMajor: string
}

export interface RefundPreview {
  mode: ParentCancelMode
  currentStatus: BookingGroupStatus
  reason?: string
  gracePeriodEndsAt?: string
  policy?: PolicySnapshot
  items: RefundPreviewItem[]
  totalRefundMajor: string
  currency: string | null
}

function sumDecimal(values: string[]): Prisma.Decimal {
  return values.reduce((acc, v) => acc.plus(new Prisma.Decimal(v)), new Prisma.Decimal(0))
}

/**
 * Named refund-flag presets so the call sites at every refund path read like
 * documentation. Direct Charges only exposes one knob on `refunds.create`:
 * `refund_application_fee`. (The Destination-Charges-era `reverse_transfer`
 * flag is gone — there is no transfer to reverse because the charge already
 * lives on the connected account.) The remaining matrix encodes the
 * platform's commercial policy:
 *
 *   | Scenario                                   | refundApplicationFee |
 *   |--------------------------------------------|----------------------|
 *   | Grace-period parent cancel (48h)           | true   ← FULL_REFUND_AND_FEE |
 *   | Camp / provider cancel                     | true   ← FULL_REFUND_AND_FEE |
 *   | Provider declined / 72h expired            | true   ← FULL_REFUND_AND_FEE |
 *   | Parent post-grace policy refund            | false  ← KEEP_PLATFORM_FEE |
 *   | Force-majeure (admin discretionary)        | false  ← KEEP_PLATFORM_FEE |
 *
 * `refundApplicationFee: false` means:
 *   - Parent receives the refund (debited from the connected account balance)
 *   - Platform KEEPS the application_fee_amount it earned at capture time
 *
 * That's intentional commercial deterrent — a parent cancel post-grace
 * shouldn't refund the platform's processing/holding fee.
 * Reference: https://docs.stripe.com/connect/direct-charges plus internal
 * commercial policy doc.
 */
const REFUND_FLAGS_FULL_REFUND_AND_FEE = {
  refundApplicationFee: true,
} as const
const REFUND_FLAGS_KEEP_PLATFORM_FEE = {
  refundApplicationFee: false,
} as const

// `PolicyTier` / `PolicySnapshot` types live in
// `../shared/cancellation-policy.util.ts` and are imported above. They are also
// consumed by PayoutsService to compute tranche release dates.

@Injectable()
export class RefundsService {
  private readonly logger = new Logger(RefundsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
    private readonly redis: RedisService,
    private readonly reimbursementsService: ReimbursementsService,
    private readonly payoutsService: PayoutsService,
    private readonly cancelCaptureService: CancelCaptureService,
    private readonly eventEmitter: EventEmitter2
  ) {}

  /**
   * Spec Part D row 1 — within 48h grace period.
   * 100% refund of every succeeded Payment for the group. `refund_application_fee`
   * is true so the platform's previously-collected app fee is reversed to the
   * connected account (parent never actually committed).
   */
  async processGracePeriodRefund(input: RefundInput) {
    return this.withLock(input.bookingGroupId, () => this.processGracePeriodRefundUnlocked(input))
  }

  /**
   * Lock-free implementation. Public callers MUST go through
   * `processGracePeriodRefund`; only re-entrant in-class callers
   * (e.g. `cancelForParent`, which already holds the booking lock) call
   * this directly. Re-acquiring the same Redis SET-NX lock from a holder
   * would fail with a `ConflictException`.
   */
  private async processGracePeriodRefundUnlocked(input: RefundInput) {
    const group = await this.loadGroupOrThrow(input.bookingGroupId)
    if (!group.gracePeriodEndsAt || new Date() > group.gracePeriodEndsAt) {
      throw new BadRequestException('Grace period has ended; use the policy refund path instead')
    }
    const succeeded = await this.succeededPayments(group.id)
    if (succeeded.length === 0) {
      throw new BadRequestException('No succeeded payments to refund')
    }
    const refunds = await this.refundEachFully({
      group,
      payments: succeeded,
      reason: RefundReason.grace_period,
      ...REFUND_FLAGS_FULL_REFUND_AND_FEE,
      initiatedByUserId: input.initiatedByUserId,
    })
    await this.markGroupCancelled(group.id, 'grace_period', input.initiatedByUserId)
    return refunds
  }

  /**
   * Spec Part D row 2/3 — parent cancellation after grace, before/within
   * non-refund window. Deposit is non-refundable (per spec: "service fee
   * portion is non-refundable after 48h" — combined with the deposit-non-
   * refundable rule). Balance is refunded according to the cancellation
   * policy tier whose `daysBeforeStart` boundary is satisfied.
   *
   * Stripe call (Direct Charges):
   *   - refund_application_fee = false (we keep the platform's app fee)
   *   - The refund debits the connected account directly; no transfer-reversal
   *     step is needed since there was no platform→provider transfer to begin with.
   */
  async processPolicyRefund(input: RefundInput) {
    return this.withLock(input.bookingGroupId, () => this.processPolicyRefundUnlocked(input))
  }

  /** See note on `processGracePeriodRefundUnlocked` — same locking caveat. */
  private async processPolicyRefundUnlocked(input: RefundInput) {
    const group = await this.loadGroupOrThrow(input.bookingGroupId)
    if (group.gracePeriodEndsAt && new Date() <= group.gracePeriodEndsAt) {
      throw new BadRequestException(
        'Booking is still within the 48h grace period; use the grace-period refund instead'
      )
    }
    const succeeded = await this.succeededPayments(group.id)
    if (succeeded.length === 0) {
      throw new BadRequestException('No succeeded payments to refund')
    }

    const snapshot = this.evaluatePolicy(group, input.circumstance ?? null)
    const refundFraction = snapshot.matchedTier
      ? new Prisma.Decimal(snapshot.matchedTier.refundPercentage).div(100)
      : new Prisma.Decimal(0)

    const refunds: Awaited<ReturnType<typeof this.refundEachFully>> = []
    for (const payment of succeeded) {
      // Deposit is always non-refundable post-grace, even under special-
      // circumstance overrides — the design HTML is explicit on this:
      // "These apply to the BALANCE only - deposit is never refundable."
      if (payment.kind === PaymentKind.deposit) continue
      // Refund only the policy-driven fraction of the balance.
      const amount = payment.amount.mul(refundFraction).toFixed(2, Prisma.Decimal.ROUND_HALF_UP)
      if (new Prisma.Decimal(amount).isZero()) continue

      const refund = await this.issueRefund({
        group,
        payment,
        amountMajor: amount,
        reason: snapshot.appliedCircumstance
          ? RefundReason.special_circumstance
          : RefundReason.policy_balance,
        ...REFUND_FLAGS_KEEP_PLATFORM_FEE,
        policySnapshot: snapshot,
        initiatedByUserId: input.initiatedByUserId,
      })
      refunds.push(refund)
    }

    // No refunds means the policy gives 0% at this point in time — that's
    // a valid business outcome, but we still want to mark the group cancelled.
    await this.markGroupCancelled(group.id, 'policy_balance', input.initiatedByUserId)
    // Phase 8: a policy refund may be partial (some funds still owed to the
    // camp). Recompute pending tranches so the schedule reflects the new
    // "still owed" amount. For policy_staged bookings whose deposit-grace
    // tranche has already paid, this trims later tier_threshold tranches.
    // For default_after_start / offset_days bookings, the single pending
    // tranche is clipped to the remaining due.
    await this.payoutsService.recomputeRemainingTranches(group.id)
    return refunds
  }

  /**
   * Spec Part D row "Camp cancels". 100% refund + reimbursement obligation if
   * funds were already disbursed. Under Accounts v2 (`losses.payments='application'`),
   * the platform absorbs the refund debit; we collect from the camp side-channel
   * via the `Reimbursement` model.
   */
  async processCampCancelRefund(input: RefundInput & { adminUserId: string }) {
    return this.withLock(input.bookingGroupId, () => this.processCampCancelRefundUnlocked(input))
  }

  private async processCampCancelRefundUnlocked(input: RefundInput & { adminUserId: string }) {
    const group = await this.loadGroupOrThrow(input.bookingGroupId)
    const succeeded = await this.succeededPayments(group.id)
    if (succeeded.length === 0) {
      throw new BadRequestException('No succeeded payments to refund')
    }

    const refunds = await this.refundEachFully({
      group,
      payments: succeeded,
      reason: RefundReason.camp_cancel,
      ...REFUND_FLAGS_FULL_REFUND_AND_FEE,
      initiatedByUserId: input.adminUserId,
    })

    await this.markGroupCancelled(group.id, 'camp_cancel', input.adminUserId)
    return refunds
  }

  /**
   * Admin records that the camp cancelled the booking. Like `cancelForParent`,
   * this dispatches based on capture state:
   *   - No succeeded payments → void any open auth/SetupIntent, mark
   *     cancelled. No refund needed (parent never paid).
   *   - Succeeded payments → 100% refund (`processCampCancelRefund` path),
   *     creates a Reimbursement if payout was already disbursed
   *     (Accounts v2 — platform absorbs the debit, collects from camp).
   *
   * Status guard rejects bookings that have already left the cancelable
   * surface (cancelled / declined / expired / at_camp / completed / etc.).
   * Camp-cancel of an `at_camp` booking is intentionally rejected — that's
   * a "we shut down mid-program" scenario that needs manual case work, not
   * a button click.
   */
  async cancelByCamp(input: {
    bookingGroupId: string
    adminUserId: string
    voidAuthFn?: (bookingGroupId: string) => Promise<void>
  }) {
    return this.withLock(input.bookingGroupId, async () => {
      const group = await this.loadGroupOrThrow(input.bookingGroupId)
      if (NON_CANCELABLE_BOOKING_STATUSES.has(group.status)) {
        throw new BadRequestException(
          `Booking is in ${group.status} status and cannot be cancelled by camp`
        )
      }
      const succeeded = await this.succeededPayments(group.id)
      if (succeeded.length === 0) {
        if (input.voidAuthFn) await input.voidAuthFn(group.id)
        await this.markGroupCancelled(group.id, 'camp_cancel_pre_capture', input.adminUserId)
        return { mode: 'void_auth' as const, refunds: [] }
      }
      const refunds = await this.processCampCancelRefundUnlocked({
        bookingGroupId: group.id,
        adminUserId: input.adminUserId,
      })
      return { mode: 'camp_cancel' as const, refunds }
    })
  }

  /**
   * Spec: provider declines explicitly. Auths were voided in the Stripe call
   * (no funds ever captured), but if the provider somehow declines after a
   * deposit was already captured, we still need to refund.
   *
   * Quick-checks the succeeded-payments count BEFORE acquiring the Redis lock
   * because the common case is "no captures yet, nothing to do" and we don't
   * want to serialize provider declines on a refund lock.
   */
  async processProviderDeclinedRefund(input: RefundInput) {
    const earlyCount = await this.prisma.payment.count({
      where: { bookingGroupId: input.bookingGroupId, status: PaymentStatus.succeeded },
    })
    if (earlyCount === 0) return []

    return this.withLock(input.bookingGroupId, async () => {
      const group = await this.loadGroupOrThrow(input.bookingGroupId)
      const succeeded = await this.succeededPayments(group.id)
      if (succeeded.length === 0) {
        // Race: another writer voided the auth between our pre-check and the
        // lock acquisition. Nothing to do.
        return []
      }
      const refunds = await this.refundEachFully({
        group,
        payments: succeeded,
        reason: RefundReason.provider_declined,
        ...REFUND_FLAGS_FULL_REFUND_AND_FEE,
        initiatedByUserId: input.initiatedByUserId,
      })
      await this.markGroupCancelled(group.id, 'provider_declined', input.initiatedByUserId)
      return refunds
    })
  }

  /**
   * H1 audit fix: auto-refund triggered by an actionable Stripe Radar
   * Early Fraud Warning. Called from the `radar.early_fraud_warning.created`
   * webhook handler. Issues a 100% refund (including the application fee —
   * we eat the cost) on every succeeded Payment for the group, cancels the
   * booking, and marks the group as `cancelled` with reason `fraud`.
   *
   * Auto-refund only fires when Stripe's EFW payload has `actionable: true`.
   * Non-actionable EFWs are still logged + stamped on the Payment row for
   * admin review, but we don't preemptively refund those (too many false
   * positives historically). See `StripeWebhookService.handleRadarEarlyFraudWarning`.
   *
   * Same early-exit + lock pattern as the provider-declined / provider-expired
   * refunds: the common path is "no captured payments yet" which collapses to
   * a no-op without acquiring the Redis lock.
   */
  async processFraudRefund(input: RefundInput) {
    const earlyCount = await this.prisma.payment.count({
      where: { bookingGroupId: input.bookingGroupId, status: PaymentStatus.succeeded },
    })
    if (earlyCount === 0) return []

    return this.withLock(input.bookingGroupId, async () => {
      const group = await this.loadGroupOrThrow(input.bookingGroupId)
      const succeeded = await this.succeededPayments(group.id)
      if (succeeded.length === 0) return []
      const refunds = await this.refundEachFully({
        group,
        payments: succeeded,
        reason: RefundReason.fraud,
        ...REFUND_FLAGS_FULL_REFUND_AND_FEE,
        initiatedByUserId: input.initiatedByUserId,
      })
      await this.markGroupCancelled(group.id, 'fraud', input.initiatedByUserId)
      return refunds
    })
  }

  /**
   * Spec: 72h provider response window expired. Same shape as declined.
   * Same early-exit optimization for the common no-op case.
   */
  async processProviderExpiredRefund(input: RefundInput) {
    const earlyCount = await this.prisma.payment.count({
      where: { bookingGroupId: input.bookingGroupId, status: PaymentStatus.succeeded },
    })
    if (earlyCount === 0) return []

    return this.withLock(input.bookingGroupId, async () => {
      const group = await this.loadGroupOrThrow(input.bookingGroupId)
      const succeeded = await this.succeededPayments(group.id)
      if (succeeded.length === 0) return []
      const refunds = await this.refundEachFully({
        group,
        payments: succeeded,
        reason: RefundReason.provider_expired,
        ...REFUND_FLAGS_FULL_REFUND_AND_FEE,
        initiatedByUserId: input.initiatedByUserId,
      })
      await this.markGroupCancelled(group.id, 'provider_expired', input.initiatedByUserId)
      return refunds
    })
  }

  /**
   * Spec Part D row "Force majeure". Discretionary — admin chooses cash refund
   * or credit note. Cash refund: 100% less service fee. Credit note: handled
   * outside this service in a future doc-generation phase.
   */
  async processForceMajeureRefund(
    input: RefundInput & { adminUserId: string; mode: 'cash' | 'credit_note' }
  ) {
    return this.withLock(input.bookingGroupId, () => this.processForceMajeureRefundUnlocked(input))
  }

  private async processForceMajeureRefundUnlocked(
    input: RefundInput & { adminUserId: string; mode: 'cash' | 'credit_note' }
  ) {
    if (input.mode === 'credit_note') {
      // Document generation lives outside this PR per plan scope. Mark the
      // booking cancelled and exit; the credit note will be issued by the
      // future docs module reading this BookingGroup's state.
      const group = await this.loadGroupOrThrow(input.bookingGroupId)
      await this.markGroupCancelled(group.id, 'force_majeure_credit_note', input.adminUserId)
      return []
    }

    const group = await this.loadGroupOrThrow(input.bookingGroupId)
    const succeeded = await this.succeededPayments(group.id)
    if (succeeded.length === 0) {
      throw new BadRequestException('No succeeded payments to refund')
    }
    const refunds = await this.refundEachFully({
      group,
      payments: succeeded,
      reason: RefundReason.force_majeure,
      ...REFUND_FLAGS_KEEP_PLATFORM_FEE,
      initiatedByUserId: input.adminUserId,
    })
    await this.markGroupCancelled(group.id, 'force_majeure_cash', input.adminUserId)
    return refunds
  }

  /**
   * Admin force-majeure cancellation. Status guard is intentionally
   * permissive (admins use this for genuinely exceptional cases) but still
   * rejects already-terminal statuses. For pre-capture bookings or
   * credit-note mode (no Stripe refund), voids the auth and marks
   * cancelled with a reason that the future docs module reads.
   */
  async cancelByForceMajeure(input: {
    bookingGroupId: string
    adminUserId: string
    mode: 'cash' | 'credit_note'
    voidAuthFn?: (bookingGroupId: string) => Promise<void>
  }) {
    return this.withLock(input.bookingGroupId, async () => {
      const group = await this.loadGroupOrThrow(input.bookingGroupId)
      if (NON_CANCELABLE_BOOKING_STATUSES.has(group.status)) {
        throw new BadRequestException(
          `Booking is in ${group.status} status and force-majeure cancel is not applicable`
        )
      }

      // credit_note mode: skip Stripe entirely; the docs module handles it.
      if (input.mode === 'credit_note') {
        if (input.voidAuthFn) await input.voidAuthFn(group.id)
        return this.processForceMajeureRefundUnlocked({
          bookingGroupId: group.id,
          adminUserId: input.adminUserId,
          mode: 'credit_note',
        }).then(refunds => ({ mode: 'force_majeure_credit_note' as const, refunds }))
      }

      // cash mode: pre-capture path (void) or post-capture path (refund).
      const succeeded = await this.succeededPayments(group.id)
      if (succeeded.length === 0) {
        if (input.voidAuthFn) await input.voidAuthFn(group.id)
        await this.markGroupCancelled(group.id, 'force_majeure_pre_capture', input.adminUserId)
        return { mode: 'force_majeure_cash' as const, refunds: [] }
      }
      const refunds = await this.processForceMajeureRefundUnlocked({
        bookingGroupId: group.id,
        adminUserId: input.adminUserId,
        mode: 'cash',
      })
      return { mode: 'force_majeure_cash' as const, refunds }
    })
  }

  // -------- Preview / dispatch -------------------------------------------

  /**
   * Resolves which refund path applies to a parent-initiated cancellation
   * AT THIS MOMENT IN TIME. Used by:
   *   1. The `GET /user/booking-groups/:id/refund-preview` endpoint so the
   *      parent sees the exact amount before they confirm.
   *   2. The `POST /user/booking-groups/:id/cancel` endpoint so the cancel
   *      path is computed once, server-side, from the same code path the
   *      preview used. (Belts-and-suspenders against the trivial "preview
   *      and confirm crossed a boundary" race — the actual refund still
   *      uses live `now()` so the amount can differ by at most a few
   *      seconds, but never by a tier.)
   *
   * Read-only — does NOT issue any Stripe refund or mutate any row.
   *
   * Returned `mode`:
   *   - `'void_auth'`  — booking is in `request` (or `accepted` with no captured
   *                      payments yet). No refund is needed; the deposit auth
   *                      is voided and no funds were ever taken.
   *   - `'grace'`      — within 48h grace, every succeeded payment refunds 100%.
   *   - `'policy'`     — post-grace, balance refunds at the policy tier %, deposit
   *                      stays non-refundable. May be 0% if past the strictest tier.
   *   - `'not_cancelable'` — booking is already cancelled / declined / expired /
   *                      at_camp / completed / payment_failed / disputed and the
   *                      parent's cancel button must not act.
   */
  async previewParentCancel(
    bookingGroupId: string,
    options: { circumstance?: SpecialCircumstanceType | null } = {}
  ): Promise<RefundPreview> {
    const group = await this.loadGroupOrThrow(bookingGroupId)

    if (NON_CANCELABLE_BOOKING_STATUSES.has(group.status)) {
      return {
        mode: 'not_cancelable',
        reason: `Booking is in ${group.status} status and cannot be cancelled by the parent`,
        currentStatus: group.status,
        items: [],
        totalRefundMajor: '0.00',
        currency: null,
      }
    }

    const succeeded = await this.succeededPayments(group.id)
    const currency = succeeded[0]?.currency ?? null

    // Pre-payment / pre-capture: no refund, just void the auth.
    if (succeeded.length === 0) {
      return {
        mode: 'void_auth',
        currentStatus: group.status,
        items: [],
        totalRefundMajor: '0.00',
        currency,
      }
    }

    const inGrace = !!group.gracePeriodEndsAt && new Date() <= group.gracePeriodEndsAt

    if (inGrace) {
      const items = succeeded.map(p => ({
        paymentId: p.id,
        kind: p.kind,
        originalAmountMajor: p.amount.toFixed(2),
        refundAmountMajor: p.amount.toFixed(2),
      }))
      return {
        mode: 'grace',
        currentStatus: group.status,
        gracePeriodEndsAt: group.gracePeriodEndsAt!.toISOString(),
        items,
        totalRefundMajor: sumDecimal(items.map(i => i.refundAmountMajor)).toFixed(2),
        currency,
      }
    }

    // Post-grace: deposit non-refundable, balance refunded at tier %.
    const snapshot = this.evaluatePolicy(group, options.circumstance ?? null)
    const fraction = snapshot.matchedTier
      ? new Prisma.Decimal(snapshot.matchedTier.refundPercentage).div(100)
      : new Prisma.Decimal(0)

    const items = succeeded.map(p => {
      const refundAmount =
        p.kind === PaymentKind.deposit
          ? new Prisma.Decimal(0)
          : p.amount.mul(fraction).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
      return {
        paymentId: p.id,
        kind: p.kind,
        originalAmountMajor: p.amount.toFixed(2),
        refundAmountMajor: refundAmount.toFixed(2),
      }
    })

    return {
      mode: 'policy',
      currentStatus: group.status,
      policy: snapshot,
      items,
      totalRefundMajor: sumDecimal(items.map(i => i.refundAmountMajor)).toFixed(2),
      currency,
    }
  }

  /**
   * Top-level parent-cancel entrypoint. Routes to the right path based on the
   * live booking state, voiding the auth or issuing the refund as appropriate.
   * Idempotent: calling twice returns the same Refund rows on the second call
   * via the `(paymentId, reason)` unique constraint inside `issueRefund`.
   *
   * The status check is repeated here against the LIVE booking row inside
   * `withLock` so the preview→confirm boundary cannot race a webhook-driven
   * status change (e.g. provider clicked decline at the same moment).
   */
  async cancelForParent(input: {
    bookingGroupId: string
    parentUserId: string
    voidAuthFn?: (bookingGroupId: string) => Promise<void>
    /** Optional special-circumstance claim — see RefundInput.circumstance. */
    circumstance?: SpecialCircumstanceType | null
  }) {
    return this.withLock(input.bookingGroupId, async () => {
      const group = await this.loadGroupOrThrow(input.bookingGroupId)

      // Defense in depth: callers MUST verify ownership before reaching this
      // method (see BookingGroupsService.cancelForParent), but re-check at the
      // service boundary so a future direct caller cannot bypass it. One
      // extra Parent lookup per cancel is an acceptable cost for the
      // guarantee that no refund can run cross-parent.
      await this.assertParentOwnsBooking(group.parentId, input.parentUserId)

      if (NON_CANCELABLE_BOOKING_STATUSES.has(group.status)) {
        throw new BadRequestException(
          `Booking is in ${group.status} status and cannot be cancelled`
        )
      }
      const succeeded = await this.succeededPayments(group.id)

      // Pre-capture: nothing to refund. Cancel any open auth/SetupIntent and
      // mark the group cancelled directly.
      if (succeeded.length === 0) {
        if (input.voidAuthFn) {
          await input.voidAuthFn(group.id)
        }
        await this.markGroupCancelled(group.id, 'parent_cancel_pre_capture', input.parentUserId)
        return { mode: 'void_auth' as const, refunds: [] }
      }

      // Captured payments exist — branch on grace window. We call the
      // *unlocked* variants because we already hold the booking-level
      // refund lock at this scope (re-acquiring would throw 409).
      const inGrace = !!group.gracePeriodEndsAt && new Date() <= group.gracePeriodEndsAt
      if (inGrace) {
        const refunds = await this.processGracePeriodRefundUnlocked({
          bookingGroupId: group.id,
          initiatedByUserId: input.parentUserId,
        })
        return { mode: 'grace' as const, refunds }
      }
      const refunds = await this.processPolicyRefundUnlocked({
        bookingGroupId: group.id,
        initiatedByUserId: input.parentUserId,
        circumstance: input.circumstance ?? null,
      })
      return { mode: 'policy' as const, refunds }
    })
  }

  // -------- Webhook event handlers ---------------------------------------

  /**
   * Webhook: `charge.refunded` / `refund.updated`. Reconcile our Refund row
   * with Stripe's authoritative state. Increment BookingGroup.refundedAmount
   * only when transitioning into a terminal succeeded state for the first time.
   *
   * Recovery for auto-refunds (lost dispute, manual Stripe-dashboard refund):
   * if no Refund row exists for the Stripe refund id, look up the Payment by
   * `charge` and create a synthetic Refund row keyed on
   * `(paymentId, RefundReason.dispute)`. This catches the spec's "lost dispute
   * triggers Stripe auto-refund" path which would otherwise leave our DB
   * out of sync.
   */
  async markRefundCompleted(refund: StripeRefund): Promise<void> {
    // Fetch the existing row (or recover an orphan) WITH the related Payment
    // currency, so we never make a second round-trip to look up currency for
    // the Reimbursement row creation later in this method.
    let row = await this.prisma.refund.findUnique({
      where: { stripeRefundId: refund.id },
      include: { payment: { select: { currency: true } } },
    })
    if (!row) {
      const recovered = await this.recoverOrphanRefund(refund)
      if (!recovered) {
        this.logger.warn(`markRefundCompleted: no Refund row for stripe refund ${refund.id}`)
        return
      }
      row = recovered
    }

    const newStatus = this.translateRefundStatus(refund.status ?? null)
    const wasSucceeded = row.status === RefundStatus.succeeded
    const isSucceeded = newStatus === RefundStatus.succeeded

    await this.prisma.$transaction(async tx => {
      await tx.refund.update({
        where: { id: row!.id },
        data: {
          status: newStatus,
          succeededAt: isSucceeded ? (row!.succeededAt ?? new Date()) : null,
          stripeFailureReason: refund.failure_reason ?? null,
        },
      })
      if (isSucceeded && !wasSucceeded) {
        await tx.bookingGroup.update({
          where: { id: row!.bookingGroupId },
          data: { refundedAmount: { increment: row!.amount } },
        })
      }
      // Phase-7 audit fix H4: ensure the Reimbursement is committed in the
      // same tx as the status flip. Covers the case where the original
      // `issueRefund` call's `createIfNeeded` invocation raced this webhook
      // (or was missed via the orphan-recovery path).
      if (isSucceeded && row!.requiresReimbursement) {
        await this.reimbursementsService.createIfNeeded(
          {
            bookingGroupId: row!.bookingGroupId,
            refundId: row!.id,
            amountOwed: row!.amount,
            currency: row!.payment.currency,
          },
          tx
        )
      }
    })

    // v28 catalog dispatch — refund success / failure. Fires only on the
    // transition into a terminal state so duplicate webhook deliveries (or
    // status churn before the final outcome) don't spam the parent.
    // Phase 8 adds the provider-side mirrors plus a reimbursement-owed
    // notification when the platform absorbed the refund (transferDate
    // already passed).
    if (isSucceeded && !wasSucceeded) {
      notify(this.eventEmitter, NotificationType.ParentRefundIssued, {
        refundId: row.id,
        bookingGroupId: row.bookingGroupId,
        paymentId: row.paymentId,
      })
      notify(this.eventEmitter, NotificationType.ProviderRefundIssued, {
        refundId: row.id,
        bookingGroupId: row.bookingGroupId,
        paymentId: row.paymentId,
      })
      if (row.requiresReimbursement) {
        notify(this.eventEmitter, NotificationType.ProviderReimbursementOwed, {
          refundId: row.id,
          bookingGroupId: row.bookingGroupId,
          paymentId: row.paymentId,
        })
      }
    } else if (newStatus === RefundStatus.failed && row.status !== RefundStatus.failed) {
      notify(this.eventEmitter, NotificationType.ParentRefundFailed, {
        refundId: row.id,
        bookingGroupId: row.bookingGroupId,
        paymentId: row.paymentId,
      })
      notify(this.eventEmitter, NotificationType.ProviderRefundFailed, {
        refundId: row.id,
        bookingGroupId: row.bookingGroupId,
        paymentId: row.paymentId,
      })
    }
  }

  // -------- Internal helpers ---------------------------------------------

  private async withLock<T>(bookingGroupId: string, fn: () => Promise<T>): Promise<T> {
    const lockKey = `refund:bg:${bookingGroupId}`
    const client = this.redis.getClient()
    if (!client) {
      // Redis unavailable — fall back to no lock (better than failing the user).
      // The unique (paymentId, reason) constraint protects us from double-refund.
      return fn()
    }
    const acquired = await client.set(lockKey, '1', 'EX', REFUND_LOCK_TTL_SECONDS, 'NX')
    if (!acquired) {
      throw new ConflictException('A refund for this booking is already in progress')
    }
    try {
      return await fn()
    } finally {
      await client.del(lockKey).catch(() => {
        /* lock will expire on its own if delete fails */
      })
    }
  }

  private async loadGroupOrThrow(bookingGroupId: string) {
    const group = await this.prisma.bookingGroup.findUnique({
      where: { id: bookingGroupId },
      include: {
        provider: { include: { settings: true } },
        session: true,
      },
    })
    if (!group) throw new NotFoundException(`BookingGroup ${bookingGroupId} not found`)
    return group
  }

  private async assertParentOwnsBooking(
    bookingParentId: string,
    callerUserId: string
  ): Promise<void> {
    const parent = await this.prisma.parent.findUnique({
      where: { userId: callerUserId },
      select: { id: true },
    })
    if (parent?.id !== bookingParentId) {
      // Audit the attempt — cross-parent refund tries are interesting even
      // when blocked. `callerUserId` is the requesting User, which is the
      // useful key for forensic correlation.
      billingAudit(this.logger, 'refund_authorization_denied', {
        callerUserId,
        bookingParentId,
        resolvedParentId: parent?.id ?? null,
      })
      throw new ForbiddenException('You do not own this booking')
    }
  }

  private async succeededPayments(bookingGroupId: string) {
    return this.prisma.payment.findMany({
      where: { bookingGroupId, status: PaymentStatus.succeeded },
      orderBy: { createdAt: 'asc' },
    })
  }

  /**
   * C2 audit fix: pre-flight validation against the live Stripe charge before
   * a refund is issued. Trust the DB to know WHICH charge to refund, but
   * trust Stripe to tell us whether the refund is *legal* right now.
   *
   * Three failure modes are caught here:
   *
   *   1. `charge.captured === false` — the charge is still on a hold (manual
   *      capture window). Refund would be a no-op or error; the correct path
   *      is to cancel the PaymentIntent, not refund.
   *   2. amount / currency mismatch — the Payment row's `amount`/`currency`
   *      no longer matches what Stripe has. Either the Payment row was
   *      corrupted, or `stripeChargeId` points at the wrong charge entirely.
   *      Either way, refunding blindly compounds the problem.
   *   3. insufficient refundable balance — `amount - amount_refunded` is
   *      smaller than the refund we're about to issue. Stripe would reject,
   *      but failing fast here gives us a usable error in the audit log.
   *
   * Throws `BadRequestException` on any failure and emits a
   * `refund_charge_validation_failed` audit event with the specific reason.
   *
   * The Stripe call is on the connected account that owns the charge, same
   * as the refund itself — if the account is unroutable, this surfaces it
   * before we burn an idempotency key on `refunds.create`.
   */
  private async validateChargeForRefund(
    payment: {
      id: string
      stripeChargeId: string | null
      stripeAccountId: string
      amount: Prisma.Decimal
      currency: string
    },
    refundAmountMajor: string
  ): Promise<void> {
    // Caller already null-checked, but TypeScript can't see across the
    // boundary — guard once more so the assertion below is sound.
    if (!payment.stripeChargeId) {
      throw new BadRequestException(`Payment ${payment.id} has no charge id; cannot refund`)
    }

    const charge: StripeCharge = await withStripeErrors(() =>
      this.stripeService.client.charges.retrieve(payment.stripeChargeId!, undefined, {
        stripeAccount: payment.stripeAccountId,
      })
    )

    const expectedMinor = toStripeMinorUnits(payment.amount.toFixed(2), payment.currency)
    const refundMinor = toStripeMinorUnits(refundAmountMajor, payment.currency)
    const chargeCurrency = charge.currency.toLowerCase()
    const paymentCurrency = payment.currency.toLowerCase()
    const refundable = charge.amount - (charge.amount_refunded ?? 0)

    if (!charge.captured) {
      billingAudit(this.logger, 'refund_charge_validation_failed', {
        paymentId: payment.id,
        stripeChargeId: payment.stripeChargeId,
        reason: 'charge_not_captured',
      })
      throw new BadRequestException(
        `Cannot refund charge ${payment.stripeChargeId}: not captured (still on authorization)`
      )
    }

    if (charge.amount !== expectedMinor || chargeCurrency !== paymentCurrency) {
      billingAudit(this.logger, 'refund_charge_validation_failed', {
        paymentId: payment.id,
        stripeChargeId: payment.stripeChargeId,
        reason: 'amount_or_currency_mismatch',
        expectedAmount: expectedMinor,
        expectedCurrency: paymentCurrency,
        actualAmount: charge.amount,
        actualCurrency: chargeCurrency,
      })
      throw new BadRequestException(
        `Stripe charge ${payment.stripeChargeId} does not match Payment row: ` +
          `expected ${expectedMinor} ${paymentCurrency.toUpperCase()}, ` +
          `got ${charge.amount} ${chargeCurrency.toUpperCase()}`
      )
    }

    if (refundMinor > refundable) {
      billingAudit(this.logger, 'refund_charge_validation_failed', {
        paymentId: payment.id,
        stripeChargeId: payment.stripeChargeId,
        reason: 'insufficient_refundable_amount',
        requestedAmount: refundMinor,
        availableAmount: refundable,
        alreadyRefunded: charge.amount_refunded ?? 0,
      })
      throw new BadRequestException(
        `Cannot refund ${refundMinor} from charge ${payment.stripeChargeId}: ` +
          `only ${refundable} remains refundable ` +
          `(${charge.amount_refunded ?? 0} of ${charge.amount} already refunded)`
      )
    }
  }

  private async refundEachFully(args: {
    group: { id: string }
    payments: Array<Awaited<ReturnType<RefundsService['succeededPayments']>>[number]>
    reason: RefundReason
    refundApplicationFee: boolean
    initiatedByUserId?: string
    policySnapshot?: PolicySnapshot
  }) {
    const results = []
    for (const payment of args.payments) {
      const refund = await this.issueRefund({
        group: args.group,
        payment,
        amountMajor: payment.amount.toFixed(2),
        reason: args.reason,
        refundApplicationFee: args.refundApplicationFee,
        policySnapshot: args.policySnapshot,
        initiatedByUserId: args.initiatedByUserId,
      })
      results.push(refund)
    }
    return results
  }

  /**
   * Issues a single Stripe refund and persists the Refund row. The unique
   * `(paymentId, reason)` constraint serves as the dedup line: if the parent
   * (or admin) re-clicks "Refund" with the same reason, the second insert
   * collides and we look up the existing row instead of double-refunding.
   *
   * If `transferDate` has already passed (early-payout case under Accounts v2),
   * sets `requiresReimbursement=true` and creates a `Reimbursement` row with
   * a 7-day deadline so the camp's debt to the platform is tracked.
   */
  private async issueRefund(args: {
    group: { id: string }
    payment: Awaited<ReturnType<RefundsService['succeededPayments']>>[number]
    amountMajor: string
    reason: RefundReason
    refundApplicationFee: boolean
    policySnapshot?: PolicySnapshot
    initiatedByUserId?: string
  }) {
    const existing = await this.prisma.refund.findUnique({
      where: {
        paymentId_reason: { paymentId: args.payment.id, reason: args.reason },
      },
    })
    if (existing) {
      // Idempotency: same payment + same reason → return prior result.
      return existing
    }

    if (!args.payment.stripeChargeId) {
      // Direct Charges: refund is keyed on the charge that lives on the
      // connected account. Without a charge id the payment isn't actually
      // settled — bail out.
      throw new BadRequestException(`Payment ${args.payment.id} has no charge id; cannot refund`)
    }

    // C2 audit fix: validate the live Stripe charge before we issue the
    // refund. The Payment row's stripe ids are a denormalized snapshot; if
    // they're stale (provider re-onboarded with a new account; data
    // corruption; manual DB edits) we'd otherwise issue a refund on the
    // wrong charge or hit a non-refundable balance. The retrieve runs on the
    // same connected account the refund will run on, so it also serves as a
    // canary for "is this account still routable from us?".
    await this.validateChargeForRefund(args.payment, args.amountMajor)

    // Reimbursement is required iff the camp has already received the funds.
    // Phase 8: query `BookingPayoutSchedule` for any tranches in `paid` status
    // for this booking — that's the real disbursement signal. Whether we keep
    // the app fee or refund it does NOT change the reimbursement obligation;
    // under Direct Charges the refund debits the connected account directly,
    // and if the payout has already moved funds out, the platform collects from
    // the camp side-channel via Reimbursement.
    const requiresReimbursement = this.resolveRequiresReimbursement()

    const params: RefundCreateParams = {
      charge: args.payment.stripeChargeId,
      amount: toStripeMinorUnits(args.amountMajor, args.payment.currency),
      // Direct Charges: `refund_application_fee` controls whether the
      // platform's previously-collected `application_fee_amount` is reversed
      // back to the connected account. `reverse_transfer` is N/A — there's no
      // platform→connected-account transfer to reverse on a Direct Charge.
      refund_application_fee: args.refundApplicationFee,
      metadata: {
        bookingGroupId: args.group.id,
        paymentId: args.payment.id,
        reason: args.reason,
      },
    }
    const idempotencyKey = buildIdempotencyKey(`refund:p:${args.payment.id}:${args.reason}`, params)

    const refund: StripeRefund = await withStripeErrors(() =>
      this.stripeService.client.refunds.create(params, {
        idempotencyKey,
        // Direct Charges: refund runs on the connected account that owns the
        // charge. `Payment.stripeAccountId` is the denormalized snapshot of
        // that account; see `providers/stripe-connect.service.ts` for how it
        // was captured at PaymentIntent create time.
        stripeAccount: args.payment.stripeAccountId,
      })
    )

    // Phase 4 audit fix Q1: when Stripe returns `succeeded` immediately
    // (the normal happy path for card refunds), we MUST run the
    // `BookingGroup.refundedAmount` increment in the same transaction as the
    // Refund row insert. If we wrote status=succeeded here without the
    // increment, the eventual `refund.updated` webhook would see the row
    // already at succeeded and short-circuit before ever incrementing —
    // exact same bug pattern as Phase 2's captureForBookingGroup and
    // Phase 3's chargeOffSession. The webhook is then a true no-op (its
    // `if (isSucceeded && !wasSucceeded)` guard sees wasSucceeded=true).
    const initialStatus = this.translateRefundStatus(refund.status ?? null)
    const succeededImmediately = initialStatus === RefundStatus.succeeded

    // Phase-7 audit fix H4: create the Reimbursement row INSIDE the same
    // transaction as the Refund row + refundedAmount increment, so a DB blip
    // on the Reimbursement insert rolls everything back. Previously the
    // Reimbursement was created outside the tx, allowing a Refund row with
    // `requiresReimbursement=true` to commit while no Reimbursement existed.
    const row = await this.prisma.$transaction(async tx => {
      const created = await tx.refund.create({
        data: {
          paymentId: args.payment.id,
          bookingGroupId: args.group.id,
          stripeRefundId: refund.id,
          amount: new Prisma.Decimal(args.amountMajor),
          reason: args.reason,
          status: initialStatus,
          succeededAt: succeededImmediately ? new Date() : null,
          policySnapshot: args.policySnapshot
            ? (args.policySnapshot as unknown as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          requiresReimbursement,
          reimbursementStatus: requiresReimbursement
            ? ReimbursementStatus.pending
            : ReimbursementStatus.not_required,
          initiatedByUserId: args.initiatedByUserId ?? null,
        },
      })
      if (succeededImmediately) {
        await tx.bookingGroup.update({
          where: { id: args.group.id },
          data: { refundedAmount: { increment: created.amount } },
        })
      }
      if (requiresReimbursement) {
        await this.reimbursementsService.createIfNeeded(
          {
            bookingGroupId: args.group.id,
            refundId: created.id,
            amountOwed: created.amount,
            currency: args.payment.currency,
          },
          tx
        )
      }
      return created
    })

    billingAudit(this.logger, 'refund_issued', {
      bookingGroupId: args.group.id,
      paymentId: args.payment.id,
      refundId: row.id,
      amount: args.amountMajor,
      reason: args.reason,
      requiresReimbursement,
      // Capture the matched tier % and any special-circumstance override so
      // audit log alone can reconstruct "why this refund amount" without
      // joining back to the Refund.policySnapshot JSON.
      tierPercentage: args.policySnapshot?.matchedTier?.refundPercentage ?? null,
      daysBeforeStart: args.policySnapshot?.daysBeforeStart ?? null,
      appliedCircumstance: args.policySnapshot?.appliedCircumstance?.type ?? null,
      // Provenance — `live_legacy` flags pre-launch bookings, `live_fallback`
      // flags data corruption that should be investigated. `snapshot` is the
      // production happy path; absent for grace_period refunds (no policy
      // resolution involved).
      snapshotSource: args.policySnapshot?.snapshotSource ?? null,
    })

    return row
  }

  /**
   * Recovery path for a Stripe refund webhook with no matching Refund row.
   * The most common case is a lost dispute: Stripe auto-refunds the charge
   * and our DB has nothing tying the refund back to a Payment. We look up
   * the Payment by `charge.id` and create a synthetic Refund row with
   * `reason=dispute` so subsequent processing can proceed normally.
   *
   * Returns the new row, or null if we genuinely can't locate the Payment
   * (truly unrelated refund — e.g. a manual Stripe-dashboard refund on a
   * legacy charge).
   */
  private async recoverOrphanRefund(refund: StripeRefund) {
    const chargeId = typeof refund.charge === 'string' ? refund.charge : (refund.charge?.id ?? null)
    if (!chargeId) return null
    const payment = await this.prisma.payment.findFirst({
      where: { stripeChargeId: chargeId },
    })
    if (!payment) return null

    // Use unique (paymentId, reason)=`dispute` so re-deliveries of the same
    // event don't try to insert duplicates. If the `dispute` row already
    // exists for some reason, return it (with the payment join so the caller
    // doesn't need a second round-trip for currency).
    const existing = await this.prisma.refund.findUnique({
      where: {
        paymentId_reason: { paymentId: payment.id, reason: RefundReason.dispute },
      },
      include: { payment: { select: { currency: true } } },
    })
    if (existing) {
      if (existing.stripeRefundId !== refund.id) {
        return this.prisma.refund.update({
          where: { id: existing.id },
          data: { stripeRefundId: refund.id },
          include: { payment: { select: { currency: true } } },
        })
      }
      return existing
    }

    // Convert Stripe minor units to major-unit string for our Decimal column.
    const amountMajor = new Prisma.Decimal(refund.amount)
      .div(this.minorUnitFactor(refund.currency))
      .toFixed(2)
    const requiresReimbursement = this.resolveRequiresReimbursement()

    // Phase 4 audit fix Q1b: always write `pending` for the recovery row,
    // even if Stripe's webhook payload says `succeeded`. The caller
    // (`markRefundCompleted`) immediately runs its own status-transition
    // logic — by writing pending here we preserve `wasSucceeded=false`
    // so the increment runs once in the caller's transaction. If we wrote
    // `succeeded` here, both `wasSucceeded` and `isSucceeded` would be
    // true and the `BookingGroup.refundedAmount` increment would never
    // happen for this orphan.
    const created = await this.prisma.refund.create({
      data: {
        paymentId: payment.id,
        bookingGroupId: payment.bookingGroupId,
        stripeRefundId: refund.id,
        amount: new Prisma.Decimal(amountMajor),
        reason: RefundReason.dispute,
        status: RefundStatus.pending,
        requiresReimbursement,
        reimbursementStatus: requiresReimbursement
          ? ReimbursementStatus.pending
          : ReimbursementStatus.not_required,
      },
      include: { payment: { select: { currency: true } } },
    })

    billingAudit(this.logger, 'refund_recovered', {
      bookingGroupId: payment.bookingGroupId,
      paymentId: payment.id,
      stripeRefundId: refund.id,
      reason: RefundReason.dispute,
    })

    return created
  }

  /**
   * Phase 8: decide whether a refund needs to flag a Reimbursement, i.e. has
   * the camp already received funds (any tranche) for this booking?
   *
   * The signal is the count of `BookingPayoutSchedule` rows in `paid` (Stripe
   * webhook confirmed) or `released` (Stripe call returned successfully —
   * funds in flight) status. If at least one tranche has actually disbursed,
   * any new refund must net against funds that already moved; the camp owes
   * back what was over-released. The exact reimbursement amount is computed
   * separately by the caller via `computeReimbursementCap`.
   */
  private resolveRequiresReimbursement(): boolean {
    // Payments revamp (Spec v2.3): RETIRED. Under capture-when-non-refundable on
    // Standard accounts, money is captured only once it is already non-refundable
    // and is immediately the Provider's — there is never a "refund after the
    // funds were disbursed early" scenario, so reimbursement is never required.
    //
    // This also MUST short-circuit before the destructive migration (M2) drops
    // `BookingPayoutSchedule`, which this used to query.
    return false
  }

  /**
   * Inline minor-unit factor — used only by the refund-recovery path. Mirrors
   * the table in `money.util.ts` so we don't re-import for a single read.
   */
  private minorUnitFactor(currency: string): number {
    const lower = currency.toLowerCase()
    if (
      [
        'bif',
        'clp',
        'djf',
        'gnf',
        'jpy',
        'kmf',
        'krw',
        'mga',
        'pyg',
        'rwf',
        'ugx',
        'vnd',
        'vuv',
        'xaf',
        'xof',
        'xpf',
      ].includes(lower)
    ) {
      return 1
    }
    if (['bhd', 'jod', 'kwd', 'omr', 'tnd'].includes(lower)) return 1000
    return 100
  }

  /**
   * Evaluates the cancellation policy in the context of "now vs. session start"
   * and returns the snapshot that gets pinned on the Refund row.
   *
   * Source of truth for tiers (in priority order):
   *   1. `BookingGroup.cancellationPolicySnapshot` — frozen at submit. This
   *      is the consumer-protection invariant: provider edits to the policy
   *      after the parent books cannot move the parent's refund schedule.
   *   2. Live `ProviderSettings.cancellationPolicy*` — fallback for legacy
   *      bookings predating the snapshot column (pre-launch only; once we
   *      ship, every new booking carries a snapshot).
   *
   * `circumstance` opts into a provider-configured special-circumstance
   * refund (medical / force_majeure / weather). The override only applies
   * when it would actually help the parent (i.e. exceeds the standard tier).
   */
  private evaluatePolicy(
    group: {
      cancellationPolicySnapshot: Prisma.JsonValue | null
      session: { startDate: Date }
      provider: {
        settings: {
          cancellationPolicy: string
          cancellationPolicyCustom: Prisma.JsonValue | null
          cancellationPolicySpecialCircumstances: Prisma.JsonValue | null
        } | null
      }
    },
    circumstance?: SpecialCircumstanceType | null
  ): PolicySnapshot {
    return evaluatePolicySnapshot({
      policyName: group.provider.settings?.cancellationPolicy ?? 'moderate',
      cancellationPolicyCustom: group.provider.settings?.cancellationPolicyCustom ?? null,
      cancellationPolicySpecialCircumstances:
        group.provider.settings?.cancellationPolicySpecialCircumstances ?? null,
      bookingPolicySnapshot: group.cancellationPolicySnapshot,
      circumstance: circumstance ?? null,
      sessionStartDate: group.session.startDate,
    })
  }

  private translateRefundStatus(stripeStatus: string | null): RefundStatus {
    switch (stripeStatus) {
      case 'succeeded':
        return RefundStatus.succeeded
      case 'failed':
        return RefundStatus.failed
      case 'canceled':
        return RefundStatus.canceled
      case 'pending':
      case 'requires_action':
      default:
        return RefundStatus.pending
    }
  }

  private async markGroupCancelled(
    bookingGroupId: string,
    reason: string,
    cancelledByUserId?: string
  ): Promise<void> {
    // Capture the pre-cancellation status before we flip it to `cancelled` —
    // BUG-178 gates the non-payment notification set on it (see below).
    const prior = await this.prisma.bookingGroup.findUnique({
      where: { id: bookingGroupId },
      select: { status: true },
    })
    await this.prisma.bookingGroup.update({
      where: { id: bookingGroupId },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancelledReason: reason,
        cancelledByUserId: cancelledByUserId ?? null,
      },
    })
    // Payments revamp (Spec v2.3) — CRITICAL: cancel the booking's scheduled
    // captures and remove their delayed BullMQ jobs. This is wired into the
    // SHARED cancellation sink so it covers EVERY cancel path (parent grace/
    // post-grace, camp-cancel, provider-declined, fraud, expiry, Force Majeure) —
    // the contractual invariant that no capture fires on a cancelled booking.
    // The engine's "PaymentIntent canceled = no-op" guard is the second line of
    // defence against a job that fires in the race window.
    await this.cancelCaptureService.cancelForBooking(bookingGroupId, `cancelled:${reason}`)

    // Legacy payout-tranche cancellation (no-op for capture-engine bookings,
    // which never create tranches). Removed in step 8 with the payout engine.
    await this.payoutsService.cancelPendingTranches(bookingGroupId, `refund:${reason}`)

    // Phase 7.5 — when the cancellation was driven by a balance payment
    // failure (the balance-charge cron flips BookingGroup to `payment_failed`
    // first, then this path runs with reason `policy_balance`), the parent
    // gets a distinct "cancelled because we couldn't collect" email rather
    // than the generic cancellation copy. The catalog's `cancelledNonPayment`
    // entry uses the formal "Dear" salutation and points the parent at the
    // browse page (no refund line — the deposit was non-refundable). Other
    // cancellation reasons stay silent here because the active path emits
    // `ParentBookingCancelled` from `BookingGroupsService.cancelForParent`.
    //
    // BUG-178: `policy_balance` is also the reason used when a family cancels a
    // fully-paid booking post-grace (`cancelForParent` → `processPolicyRefund`).
    // Firing the non-payment set there wrongly tells the parent/camp/superadmin
    // "we couldn't collect your balance" on a booking that was already paid. The
    // genuine non-payment path is the ONLY one that runs on a booking already in
    // `payment_failed` (the balance cron flips it first; `cancelForParent`/
    // `cancelByCamp` reject `payment_failed` outright), so gate on the prior
    // status to fire these only for a real collection failure.
    if (reason === 'policy_balance' && prior?.status === BookingGroupStatus.payment_failed) {
      notify(this.eventEmitter, NotificationType.ParentPaymentCancelledNonPayment, {
        bookingGroupId,
      })
      // v28 Phase 8 — provider-side mirror.
      notify(this.eventEmitter, NotificationType.ProviderBookingCancelledNonPayment, {
        bookingGroupId,
      })
      // v28 Phase 9 — superadmin mirror. Deposit payout has already settled
      // per cancellation policy; this is purely informational so admins can
      // spot patterns (e.g. card-failure clusters at one camp).
      notify(this.eventEmitter, NotificationType.SuperadminBookingCancelledNonPayment, {
        bookingGroupId,
      })
    }
  }

  /**
   * Used by webhook handlers to verify our Refund row's shape against Stripe's
   * `charge` object when a `charge.refunded` arrives. Iterates through the
   * charge's nested refund list (Stripe duplicates each refund under both
   * `charge.refunded` and `refund.updated`) and reconciles each one.
   */
  async syncFromCharge(charge: StripeCharge): Promise<void> {
    if (!charge.refunds?.data) return
    for (const refund of charge.refunds.data) {
      const fullRefund = refund as unknown as StripeRefund
      await this.markRefundCompleted(fullRefund)
    }
  }
}
