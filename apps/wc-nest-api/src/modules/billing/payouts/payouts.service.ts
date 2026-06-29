import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { NotificationType } from '@world-schools/wc-types'
import Stripe from 'stripe'
import { Prisma } from '../../../generated/client/client'
import { notify } from '../../notifications/dispatcher/notify'
import {
  PayoutMode,
  PayoutStatus,
  PayoutTrancheReason,
  PayoutTrancheStatus,
} from '../../../generated/client/enums'
import { PrismaService } from '../../../prisma/prisma.service'
import { StripeService } from '../../stripe/stripe.service'
import { billingAudit } from '../shared/audit-log.util'
import {
  evaluatePolicy,
  PolicyTier,
  readBookingPolicySnapshot,
} from '../shared/cancellation-policy.util'
import { buildIdempotencyKey } from '../shared/idempotency.util'
import { fromStripeMinorUnits, toStripeMinorUnits } from '../shared/money.util'
import { isSoftStripeFailure, withStripeErrors } from '../shared/with-stripe-errors.util'

type StripeClient = InstanceType<typeof Stripe>
type StripePayout = Awaited<ReturnType<StripeClient['payouts']['create']>>
type PayoutCreateParams = Parameters<StripeClient['payouts']['create']>[0]

const ZERO = new Prisma.Decimal(0)
const HUNDRED = new Prisma.Decimal(100)
/** Buffer between balance off-session capture and a tranche release that
 *  needs balance funds — gives Stripe one cron tick to settle the charge. */
const BALANCE_DUE_BUFFER_MS = 24 * 60 * 60 * 1000
/** When a partial release leaves residual amount, requeue immediately on the
 *  next cron tick (release_at = now + 1 hour). */
const RESIDUAL_RETRY_DELAY_MS = 60 * 60 * 1000
/**
 * Backoff parameters for tranches Stripe rejects with `balance_insufficient`
 * (Direct Charges: the connected account's available balance is still
 * pending). We reschedule with capped exponential backoff:
 *   attempt 0 → +6h, 1 → +12h, 2 → +24h, 3+ → +48h (capped).
 * After MAX_ATTEMPTS we stop retrying and park the row as `skipped` so ops
 * can investigate (provider's balance is genuinely stuck — bank reject,
 * Stripe reserve hold, refund chain, etc.).
 */
const INSUFFICIENT_BALANCE_BASE_RETRY_MS = 6 * 60 * 60 * 1000
const INSUFFICIENT_BALANCE_MAX_RETRY_MS = 48 * 60 * 60 * 1000
const INSUFFICIENT_BALANCE_MAX_ATTEMPTS = 5

function readNumericPart(parts: Intl.DateTimeFormatPart[], type: string): number {
  const raw = parts.find(p => p.type === type)?.value
  const n = Number(raw)
  if (!Number.isFinite(n)) {
    throw new Error(`Intl.DateTimeFormat returned no usable "${type}" part (got ${String(raw)})`)
  }
  return n
}

@Injectable()
export class PayoutsService {
  private readonly logger = new Logger(PayoutsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
    private readonly eventEmitter: EventEmitter2
  ) {}

  /**
   * Computes the canonical default-mode `transferDate`: first business day
   * **after** the session start date. When `providerTimezone` is supplied
   * (IANA zone name), the day-rollover and weekend skip are computed in the
   * provider's local time.
   *
   * Used by `generateScheduleForBooking` for both `default_after_start` and
   * the `final_default` tail tranche of `policy_staged`.
   */
  computeDefaultTransferDate(sessionStartDate: Date, providerTimezone?: string | null): Date {
    if (providerTimezone) {
      try {
        return this.computeNextBusinessDayInTimezone(sessionStartDate, providerTimezone)
      } catch (err) {
        // Tolerant fallback: invalid IANA name (typo, legacy abbrev like "PST"
        // that the constructor rejects, malformed Intl response → NaN, etc.)
        // shouldn't fail acceptance. Drop to UTC and warn so data quality
        // issues surface in logs without the user seeing a 500.
        this.logger.warn(
          `computeDefaultTransferDate: timezone "${providerTimezone}" failed to resolve, falling back to UTC: ${
            err instanceof Error ? err.message : String(err)
          }`
        )
      }
    }
    const next = new Date(sessionStartDate.getTime())
    next.setUTCHours(0, 0, 0, 0)
    next.setUTCDate(next.getUTCDate() + 1)
    while (next.getUTCDay() === 0 || next.getUTCDay() === 6) {
      next.setUTCDate(next.getUTCDate() + 1)
    }
    return next
  }

  /**
   * Computes the offset-days release date: `sessionStartDate - offsetDays`
   * (UTC). Defensive floor: returns null when the computed date would land
   * in the past relative to `now()` so the caller can fall back to the
   * default-mode date and never schedule a release before acceptance.
   */
  computeOffsetReleaseDate(sessionStartDate: Date, offsetDays: number, now: Date): Date | null {
    if (!Number.isFinite(offsetDays) || offsetDays <= 0) return null
    const early = new Date(sessionStartDate.getTime())
    early.setUTCDate(early.getUTCDate() - Math.floor(offsetDays))
    return early.getTime() > now.getTime() ? early : null
  }

  private computeNextBusinessDayInTimezone(sessionStartDate: Date, tz: string): Date {
    const local = this.tzCalendarDate(sessionStartDate, tz)
    const cal = new Date(Date.UTC(local.year, local.month, local.day))
    do {
      cal.setUTCDate(cal.getUTCDate() + 1)
    } while (cal.getUTCDay() === 0 || cal.getUTCDay() === 6)
    return this.tzMidnightAsUtc(cal.getUTCFullYear(), cal.getUTCMonth(), cal.getUTCDate(), tz)
  }

  private tzCalendarDate(date: Date, tz: string): { year: number; month: number; day: number } {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    const parts = fmt.formatToParts(date)
    const year = readNumericPart(parts, 'year')
    const month = readNumericPart(parts, 'month') - 1
    const day = readNumericPart(parts, 'day')
    return { year, month, day }
  }

  private tzMidnightAsUtc(year: number, month: number, day: number, tz: string): Date {
    const naiveUtc = Date.UTC(year, month, day, 0, 0, 0)
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
    const parts = fmt.formatToParts(new Date(naiveUtc))
    const localAsUtc = Date.UTC(
      readNumericPart(parts, 'year'),
      readNumericPart(parts, 'month') - 1,
      readNumericPart(parts, 'day'),
      readNumericPart(parts, 'hour'),
      readNumericPart(parts, 'minute'),
      readNumericPart(parts, 'second')
    )
    const offsetMs = naiveUtc - localAsUtc
    return new Date(naiveUtc + offsetMs)
  }

  // -------- Schedule generation ------------------------------------------

  /**
   * Generates the full `BookingPayoutSchedule` for a booking based on its
   * snapshotted payout mode. Called from the acceptance flow once
   * `gracePeriodEndsAt` is known.
   *
   * Idempotent: skips if any non-canceled tranches already exist for the
   * booking (a re-acceptance after a manual override regenerates via
   * `enablePerBookingOverride` instead).
   *
   * Pure-ish — all math derives from `(payoutMode, sessionStartDate,
   * gracePeriodEndsAt, depositAmount, totalAmount, balanceDueAt,
   * providerTimezone, policy tiers)` so it's easy to fixture-test.
   */
  async generateScheduleForBooking(bookingGroupId: string): Promise<{ trancheCount: number }> {
    const group = await this.prisma.bookingGroup.findUnique({
      where: { id: bookingGroupId },
      include: {
        session: { select: { startDate: true } },
        provider: {
          select: {
            settings: {
              select: {
                currency: true,
                timezone: true,
                cancellationPolicy: true,
                cancellationPolicyCustom: true,
              },
            },
          },
        },
      },
      // Note: BookingGroup.cancellationPolicySnapshot is also read here
      // (default `include` returns all scalar fields). Tier dates derived
      // from the snapshot must match what the parent saw at booking time.
    })
    if (!group) throw new NotFoundException(`BookingGroup ${bookingGroupId} not found`)

    const existing = await this.prisma.bookingPayoutSchedule.count({
      where: {
        bookingGroupId,
        status: { notIn: [PayoutTrancheStatus.canceled] },
      },
    })
    if (existing > 0) {
      this.logger.debug(
        `generateScheduleForBooking: skipping ${bookingGroupId} — ${existing} non-canceled tranches already exist`
      )
      return { trancheCount: 0 }
    }

    const currency = group.provider.settings?.currency
    if (!currency) {
      throw new BadRequestException(
        `Provider ${group.providerId} has no currency configured; cannot schedule payouts`
      )
    }

    const sessionStart = group.session.startDate
    const totalAmount = group.totalAmount
    const depositAmount = group.depositAmount ?? ZERO
    const balanceAmount = totalAmount.minus(depositAmount)

    const tranches = this.buildTranches({
      payoutMode: group.payoutMode,
      offsetDays: group.payoutOffsetDaysSnapshot ?? null,
      sessionStartDate: sessionStart,
      gracePeriodEndsAt: group.gracePeriodEndsAt,
      balanceDueAt: group.balanceDueAt,
      depositAmount,
      balanceAmount,
      totalAmount,
      providerTimezone: group.provider.settings?.timezone ?? null,
      cancellationPolicy: group.provider.settings?.cancellationPolicy ?? 'moderate',
      cancellationPolicyCustom: group.provider.settings?.cancellationPolicyCustom ?? null,
      // Snapshot wins when present (consumer-protection invariant: tranche
      // release dates must reflect the policy at booking time, not the
      // provider's currently-edited live policy).
      cancellationPolicySnapshot: group.cancellationPolicySnapshot,
      now: new Date(),
    })

    if (tranches.length === 0) {
      // Defensive: if for some reason we computed zero tranches (e.g.,
      // totalAmount is zero), don't proceed silently — log and exit.
      billingAudit(this.logger, 'payout_schedule_empty', {
        bookingGroupId,
        payoutMode: group.payoutMode,
        totalAmount: totalAmount.toFixed(2),
      })
      return { trancheCount: 0 }
    }

    const cachedTransferDate = tranches.reduce<Date>(
      (acc, t) => (t.releaseAt < acc ? t.releaseAt : acc),
      tranches[0].releaseAt
    )

    await this.prisma.$transaction(async tx => {
      await tx.bookingPayoutSchedule.createMany({
        data: tranches.map(t => ({
          bookingGroupId,
          reason: t.reason,
          releaseAt: t.releaseAt,
          plannedAmount: t.plannedAmount,
          currency,
          tierDaysBeforeStart: t.tierDaysBeforeStart ?? null,
          tierRefundPercent: t.tierRefundPercent ?? null,
        })),
      })
      await tx.bookingGroup.update({
        where: { id: bookingGroupId },
        data: { transferDate: cachedTransferDate },
      })
    })

    // Provenance — same three-way signal as `refund_issued`:
    //   `snapshot`  → tier dates derived from the booking-time snapshot (happy path)
    //   `live_fallback` → snapshot column non-null but unparseable (data corruption — investigate)
    //   `live_legacy`   → no snapshot column (pre-launch booking)
    // Operators can grep `snapshot_source="live_fallback"` to find tranches
    // that were scheduled against possibly-edited policy.
    const snapshotSource: 'snapshot' | 'live_fallback' | 'live_legacy' =
      readBookingPolicySnapshot(group.cancellationPolicySnapshot) != null
        ? 'snapshot'
        : group.cancellationPolicySnapshot != null
          ? 'live_fallback'
          : 'live_legacy'

    billingAudit(this.logger, 'payout_schedule_generated', {
      bookingGroupId,
      payoutMode: group.payoutMode,
      trancheCount: tranches.length,
      snapshotSource,
      // Compact one-line tranche summary so ops can grep the full schedule
      // off a single audit line without a separate query.
      tranches: tranches
        .map(
          t =>
            `${t.reason}@${t.releaseAt.toISOString()}:${t.plannedAmount.toFixed(2)}` +
            (t.tierDaysBeforeStart != null
              ? `(d-${t.tierDaysBeforeStart},${t.tierRefundPercent}%)`
              : '')
        )
        .join(','),
    })

    return { trancheCount: tranches.length }
  }

  /**
   * Pure builder — given the inputs, return the tranche list. Visible for
   * testing and for `recomputeRemainingTranches` / `enablePerBookingOverride`
   * to share the same math. Does NOT touch the DB.
   */
  buildTranches(input: {
    payoutMode: PayoutMode
    offsetDays: number | null
    sessionStartDate: Date
    gracePeriodEndsAt: Date | null
    balanceDueAt: Date | null
    depositAmount: Prisma.Decimal
    balanceAmount: Prisma.Decimal
    totalAmount: Prisma.Decimal
    providerTimezone: string | null
    cancellationPolicy: string
    cancellationPolicyCustom: Prisma.JsonValue | null
    /** Frozen snapshot from booking-time. When present, takes priority over live settings. */
    cancellationPolicySnapshot?: Prisma.JsonValue | null
    now: Date
  }): Array<{
    reason: PayoutTrancheReason
    releaseAt: Date
    plannedAmount: Prisma.Decimal
    tierDaysBeforeStart?: number
    tierRefundPercent?: number
  }> {
    if (input.totalAmount.lessThanOrEqualTo(0)) return []

    if (input.payoutMode === PayoutMode.offset_days) {
      const offsetDate =
        input.offsetDays != null
          ? this.computeOffsetReleaseDate(input.sessionStartDate, input.offsetDays, input.now)
          : null
      // Floor: if the offset date is in the past (or no offset configured),
      // fall back to default-mode timing for this booking.
      const releaseAt =
        offsetDate ??
        this.computeDefaultTransferDate(input.sessionStartDate, input.providerTimezone)
      return [
        { reason: PayoutTrancheReason.offset_release, releaseAt, plannedAmount: input.totalAmount },
      ]
    }

    if (input.payoutMode === PayoutMode.default_after_start) {
      return [
        {
          reason: PayoutTrancheReason.final_default,
          releaseAt: this.computeDefaultTransferDate(
            input.sessionStartDate,
            input.providerTimezone
          ),
          plannedAmount: input.totalAmount,
        },
      ]
    }

    // policy_staged — multi-tranche schedule.
    return this.buildPolicyStagedTranches({
      sessionStartDate: input.sessionStartDate,
      gracePeriodEndsAt: input.gracePeriodEndsAt,
      balanceDueAt: input.balanceDueAt,
      depositAmount: input.depositAmount,
      balanceAmount: input.balanceAmount,
      totalAmount: input.totalAmount,
      providerTimezone: input.providerTimezone,
      cancellationPolicy: input.cancellationPolicy,
      cancellationPolicyCustom: input.cancellationPolicyCustom,
      cancellationPolicySnapshot: input.cancellationPolicySnapshot ?? null,
      now: input.now,
    })
  }

  private buildPolicyStagedTranches(input: {
    sessionStartDate: Date
    gracePeriodEndsAt: Date | null
    balanceDueAt: Date | null
    depositAmount: Prisma.Decimal
    balanceAmount: Prisma.Decimal
    totalAmount: Prisma.Decimal
    providerTimezone: string | null
    cancellationPolicy: string
    cancellationPolicyCustom: Prisma.JsonValue | null
    cancellationPolicySnapshot?: Prisma.JsonValue | null
    now: Date
  }): Array<{
    reason: PayoutTrancheReason
    releaseAt: Date
    plannedAmount: Prisma.Decimal
    tierDaysBeforeStart?: number
    tierRefundPercent?: number
  }> {
    const tranches: Array<{
      reason: PayoutTrancheReason
      releaseAt: Date
      plannedAmount: Prisma.Decimal
      tierDaysBeforeStart?: number
      tierRefundPercent?: number
    }> = []

    // Resolve the tier list once. Sort DESC by daysBeforeStart so we walk
    // them in chronological order (earliest in real time first) — same order
    // they'll "expire" as the camp approaches.
    //
    // Priority: booking-time snapshot first (consumer-protection — release
    // dates must match what the parent saw). Live settings only when no
    // snapshot exists (legacy bookings predating the snapshot column).
    const policySnapshot = evaluatePolicy({
      policyName: input.cancellationPolicy,
      cancellationPolicyCustom: input.cancellationPolicyCustom,
      bookingPolicySnapshot: input.cancellationPolicySnapshot ?? null,
      sessionStartDate: input.sessionStartDate,
      now: input.now,
    })
    const tiersDesc = [...policySnapshot.tiers].sort(
      (a, b) => b.daysBeforeStart - a.daysBeforeStart
    )

    // Initial non-refundable at acceptance (now). The currently-matched tier
    // determines the refund% in effect. If no tier matches (booking accepted
    // with daysBeforeStart < strictest tier), refund% is 0 → 100%
    // non-refundable from day 1.
    const matchedNow = policySnapshot.matchedTier
    const initialRefundPct = matchedNow ? matchedNow.refundPercentage : 0
    const initialNonRefundableBalance = input.balanceAmount
      .mul(HUNDRED.minus(initialRefundPct))
      .div(HUNDRED)
      .toDecimalPlaces(2)

    // 1. Deposit tranche (combined with the initial non-refundable balance
    //    portion so we release everything that's non-refundable at
    //    acceptance time in a single payout at gracePeriodEndsAt).
    const depositGraceAmount = input.depositAmount.plus(initialNonRefundableBalance)
    if (depositGraceAmount.greaterThan(0) && input.gracePeriodEndsAt) {
      tranches.push({
        reason: PayoutTrancheReason.deposit_grace,
        releaseAt: input.gracePeriodEndsAt,
        plannedAmount: depositGraceAmount,
      })
    }
    let cumulativeBalanceScheduled = initialNonRefundableBalance

    // 2. Tier-expiration tranches. As time advances, each tier "expires" at
    //    `sessionStart - tier.daysBeforeStart`. After expiration the NEXT
    //    tier (or 0% if none) becomes effective, raising the non-refundable
    //    balance amount. We emit a tranche for each transition that
    //    increases the cumulative non-refundable balance.
    for (let i = 0; i < tiersDesc.length; i++) {
      const exitingTier = tiersDesc[i]
      const enteringTier = i + 1 < tiersDesc.length ? tiersDesc[i + 1] : null
      const newRefundPct = enteringTier ? enteringTier.refundPercentage : 0
      const newNonRefundableBalance = input.balanceAmount
        .mul(HUNDRED.minus(newRefundPct))
        .div(HUNDRED)
        .toDecimalPlaces(2)
      const increment = newNonRefundableBalance.minus(cumulativeBalanceScheduled)
      if (increment.lessThanOrEqualTo(0)) continue
      // Skip transitions that already happened (booking accepted past this
      // tier boundary) — those funds are already covered by the deposit_grace
      // tranche above.
      const fireDate = this.tierExpirationDate(input.sessionStartDate, exitingTier)
      if (fireDate <= input.now) {
        cumulativeBalanceScheduled = newNonRefundableBalance
        continue
      }

      const releaseAt = this.clampReleaseAt(fireDate, {
        gracePeriodEndsAt: input.gracePeriodEndsAt,
        balanceDueAt: input.balanceDueAt,
      })
      tranches.push({
        reason: PayoutTrancheReason.tier_threshold,
        releaseAt,
        plannedAmount: increment,
        tierDaysBeforeStart: exitingTier.daysBeforeStart,
        tierRefundPercent: newRefundPct,
      })
      cumulativeBalanceScheduled = newNonRefundableBalance
    }

    // 3. Final residual: deposit + balance - everything already scheduled.
    //    Only emit when there's a positive residual so the cron has a
    //    fallback handle (rounding, untyped extras).
    const scheduledSoFar = tranches.reduce<Prisma.Decimal>(
      (acc, t) => acc.plus(t.plannedAmount),
      ZERO
    )
    const residual = input.totalAmount.minus(scheduledSoFar)
    if (residual.greaterThan(0)) {
      tranches.push({
        reason: PayoutTrancheReason.final_default,
        releaseAt: this.computeDefaultTransferDate(input.sessionStartDate, input.providerTimezone),
        plannedAmount: residual,
      })
    }

    return tranches
  }

  /**
   * Returns the wall-clock moment a cancellation tier "expires" — i.e., when
   * `daysBeforeStart` ticks past the tier's threshold, the next (less
   * generous) tier becomes effective. Practically: sessionStart - tier.days.
   */
  private tierExpirationDate(sessionStartDate: Date, tier: PolicyTier): Date {
    const fire = new Date(sessionStartDate.getTime())
    fire.setUTCDate(fire.getUTCDate() - tier.daysBeforeStart)
    return fire
  }

  /** Push tier release dates forward when they collide with grace / balance-due. */
  private clampReleaseAt(
    raw: Date,
    bounds: { gracePeriodEndsAt: Date | null; balanceDueAt: Date | null }
  ): Date {
    let clamped = raw
    if (bounds.gracePeriodEndsAt && clamped < bounds.gracePeriodEndsAt) {
      clamped = bounds.gracePeriodEndsAt
    }
    if (bounds.balanceDueAt) {
      const balanceCleared = new Date(bounds.balanceDueAt.getTime() + BALANCE_DUE_BUFFER_MS)
      if (clamped < balanceCleared) clamped = balanceCleared
    }
    return clamped
  }

  // -------- Tranche release ----------------------------------------------

  /**
   * Releases a single pending tranche. Replaces the per-BG `releasePayout`.
   * Idempotent — re-running on a `released`/`paid` row is a no-op. If
   * available funds are less than the planned amount (e.g., off-session
   * balance hasn't captured yet), releases the available amount and queues
   * the residual on a fresh `partial_residual` tranche for the next cron
   * tick.
   */
  async releasePendingTranche(trancheId: string): Promise<{
    stripePayoutId: string | null
    skipped: boolean
    reason?: string
    releasedAmount?: string
  }> {
    const tranche = await this.prisma.bookingPayoutSchedule.findUnique({
      where: { id: trancheId },
      include: {
        bookingGroup: {
          include: {
            provider: { include: { settings: { select: { currency: true } } } },
          },
        },
      },
    })
    if (!tranche) throw new NotFoundException(`BookingPayoutSchedule ${trancheId} not found`)

    if (tranche.status !== PayoutTrancheStatus.pending) {
      return { stripePayoutId: null, skipped: true, reason: `already_${tranche.status}` }
    }
    if (tranche.releaseAt > new Date()) {
      return { stripePayoutId: null, skipped: true, reason: 'release_at_not_reached' }
    }
    const stripeAccountId = tranche.bookingGroup.provider.stripeAccountId
    if (!stripeAccountId) {
      return { stripePayoutId: null, skipped: true, reason: 'provider_no_stripe_account' }
    }
    const currency = tranche.bookingGroup.provider.settings?.currency
    if (!currency) {
      return { stripePayoutId: null, skipped: true, reason: 'provider_no_currency' }
    }

    // Compute available = paidAmount - refundedAmount - serviceFeeAmount -
    // sum(already-released tranches).
    const released = await this.prisma.bookingPayoutSchedule.aggregate({
      where: {
        bookingGroupId: tranche.bookingGroupId,
        status: { in: [PayoutTrancheStatus.released, PayoutTrancheStatus.paid] },
      },
      _sum: { releasedAmount: true },
    })
    const alreadyReleased = released._sum.releasedAmount ?? ZERO
    const available = tranche.bookingGroup.paidAmount
      .minus(tranche.bookingGroup.refundedAmount)
      .minus(tranche.bookingGroup.serviceFeeAmount ?? ZERO)
      .minus(alreadyReleased)

    if (available.lessThanOrEqualTo(0)) {
      // Net amount is zero/negative — close out without a Stripe call so the
      // cron stops re-trying.
      await this.prisma.bookingPayoutSchedule.update({
        where: { id: tranche.id },
        data: {
          status: PayoutTrancheStatus.skipped,
          skipReason: 'no_funds_available',
        },
      })
      await this.refreshBookingGroupCaches(tranche.bookingGroupId)
      billingAudit(this.logger, 'payout_tranche_skipped', {
        trancheId: tranche.id,
        bookingGroupId: tranche.bookingGroupId,
        reason: 'no_funds_available',
      })
      return { stripePayoutId: null, skipped: true, reason: 'no_funds_available' }
    }

    // Cap the release amount at what's actually available. If we can only
    // release a fraction (e.g., balance hasn't off-session-captured yet),
    // release that and queue the residual on a fresh tranche.
    const releaseAmount = Prisma.Decimal.min(tranche.plannedAmount, available)
    const residual = tranche.plannedAmount.minus(releaseAmount)

    const params: PayoutCreateParams = {
      amount: toStripeMinorUnits(releaseAmount, currency),
      currency,
      metadata: {
        bookingGroupId: tranche.bookingGroupId,
        trancheId: tranche.id,
        trancheReason: tranche.reason,
      },
    }
    // Include the attempt counter in the hashed params so a retry after a
    // `balance_insufficient` reschedule gets a fresh idempotency key —
    // otherwise Stripe replays the cached error response and we never
    // actually retry against the live balance.
    const idempotencyKey = buildIdempotencyKey(`payout:tranche:${tranche.id}`, {
      ...params,
      attempt: tranche.releaseAttempts,
    })

    const result = await withStripeErrors(
      () =>
        this.stripeService.client.payouts.create(params, {
          idempotencyKey,
          stripeAccount: stripeAccountId,
        }),
      { softErrorCodes: ['balance_insufficient'] }
    )

    if (isSoftStripeFailure(result)) {
      // Direct Charges: connected account's available balance hasn't caught
      // up with pending charges yet. Reschedule + retry; cron picks it back
      // up at the new releaseAt without polluting error logs.
      return this.rescheduleTrancheForInsufficientBalance(tranche.id, tranche.releaseAttempts, {
        bookingGroupId: tranche.bookingGroupId,
        stripeMessage: result.message,
      })
    }
    const payout: StripePayout = result

    await this.prisma.$transaction(async tx => {
      await tx.bookingPayoutSchedule.update({
        where: { id: tranche.id },
        data: {
          status: PayoutTrancheStatus.released,
          releasedAt: new Date(),
          releasedAmount: releaseAmount,
          stripePayoutId: payout.id,
        },
      })
      if (residual.greaterThan(0)) {
        await tx.bookingPayoutSchedule.create({
          data: {
            bookingGroupId: tranche.bookingGroupId,
            reason: PayoutTrancheReason.partial_residual,
            releaseAt: new Date(Date.now() + RESIDUAL_RETRY_DELAY_MS),
            plannedAmount: residual,
            currency,
            tierDaysBeforeStart: tranche.tierDaysBeforeStart,
            tierRefundPercent: tranche.tierRefundPercent,
          },
        })
      }
    })
    await this.refreshBookingGroupCaches(tranche.bookingGroupId)

    billingAudit(this.logger, 'payout_tranche_released', {
      trancheId: tranche.id,
      bookingGroupId: tranche.bookingGroupId,
      stripePayoutId: payout.id,
      amount: releaseAmount.toFixed(2),
      planned: tranche.plannedAmount.toFixed(2),
      residual: residual.toFixed(2),
      currency,
    })

    return {
      stripePayoutId: payout.id,
      skipped: false,
      releasedAmount: releaseAmount.toFixed(2),
    }
  }

  /**
   * Reschedule a pending tranche after Stripe rejects the payout with
   * `balance_insufficient`. Bumps `releaseAttempts`, pushes `releaseAt`
   * forward with capped exponential backoff, and leaves `status = pending`
   * so the cron picks it up at the new time. After
   * `INSUFFICIENT_BALANCE_MAX_ATTEMPTS` retries the row is parked as
   * `skipped` and surfaced via `billingAudit` for ops investigation —
   * something is keeping the connected account's balance below threshold
   * (genuine bank reject, Stripe reserve, etc.) that auto-retry won't fix.
   */
  private async rescheduleTrancheForInsufficientBalance(
    trancheId: string,
    currentAttempts: number,
    ctx: { bookingGroupId: string; stripeMessage: string }
  ): Promise<{ stripePayoutId: null; skipped: true; reason: string }> {
    const nextAttempts = currentAttempts + 1
    if (nextAttempts >= INSUFFICIENT_BALANCE_MAX_ATTEMPTS) {
      await this.prisma.bookingPayoutSchedule.update({
        where: { id: trancheId },
        data: {
          status: PayoutTrancheStatus.skipped,
          releaseAttempts: nextAttempts,
          skipReason: 'balance_insufficient_max_retries',
        },
      })
      billingAudit(this.logger, 'payout_tranche_blocked', {
        trancheId,
        bookingGroupId: ctx.bookingGroupId,
        reason: 'balance_insufficient_max_retries',
        attempts: nextAttempts,
        stripeMessage: ctx.stripeMessage,
      })
      return { stripePayoutId: null, skipped: true, reason: 'balance_insufficient_max_retries' }
    }

    // Backoff: 6h * 2^attempt, capped at 48h.
    const backoffMs = Math.min(
      INSUFFICIENT_BALANCE_BASE_RETRY_MS * 2 ** currentAttempts,
      INSUFFICIENT_BALANCE_MAX_RETRY_MS
    )
    const nextReleaseAt = new Date(Date.now() + backoffMs)
    await this.prisma.bookingPayoutSchedule.update({
      where: { id: trancheId },
      data: {
        releaseAt: nextReleaseAt,
        releaseAttempts: nextAttempts,
        skipReason: `balance_insufficient (attempt ${nextAttempts})`,
      },
    })
    return { stripePayoutId: null, skipped: true, reason: 'balance_insufficient' }
  }

  /**
   * Cancels every pending tranche for a BookingGroup. Used by every full-
   * refund path (grace, camp_cancel, provider_declined, provider_expired,
   * force_majeure_cash) — already-released tranches are untouched (the
   * refund layer handles reimbursement of already-paid-out funds via
   * `refunds.create` on the connected account).
   */
  async cancelPendingTranches(
    bookingGroupId: string,
    skipReason: string
  ): Promise<{ canceledCount: number }> {
    const result = await this.prisma.bookingPayoutSchedule.updateMany({
      where: { bookingGroupId, status: PayoutTrancheStatus.pending },
      data: {
        status: PayoutTrancheStatus.canceled,
        skipReason,
      },
    })
    if (result.count > 0) {
      await this.refreshBookingGroupCaches(bookingGroupId)
      billingAudit(this.logger, 'payout_tranches_canceled', {
        bookingGroupId,
        canceledCount: result.count,
        reason: skipReason,
      })
    }
    return { canceledCount: result.count }
  }

  /**
   * Recomputes pending tranches after a partial refund. Strategy: cancel
   * tranches from latest-releaseAt backward until the remaining pending sum
   * does not exceed the new "still owed to camp" amount. We protect earlier
   * tranches because they tend to be deposit / first-tier — providers expect
   * those funds; clipping the tail is less disruptive.
   */
  async recomputeRemainingTranches(bookingGroupId: string): Promise<{ canceledCount: number }> {
    const group = await this.prisma.bookingGroup.findUnique({
      where: { id: bookingGroupId },
      select: {
        paidAmount: true,
        refundedAmount: true,
        serviceFeeAmount: true,
      },
    })
    if (!group) throw new NotFoundException(`BookingGroup ${bookingGroupId} not found`)

    const released = await this.prisma.bookingPayoutSchedule.aggregate({
      where: {
        bookingGroupId,
        status: { in: [PayoutTrancheStatus.released, PayoutTrancheStatus.paid] },
      },
      _sum: { releasedAmount: true },
    })
    const alreadyReleased = released._sum.releasedAmount ?? ZERO

    const remainingDue = group.paidAmount
      .minus(group.refundedAmount)
      .minus(group.serviceFeeAmount ?? ZERO)
      .minus(alreadyReleased)

    const pending = await this.prisma.bookingPayoutSchedule.findMany({
      where: { bookingGroupId, status: PayoutTrancheStatus.pending },
      orderBy: { releaseAt: 'desc' },
    })

    let pendingSum = pending.reduce<Prisma.Decimal>((acc, t) => acc.plus(t.plannedAmount), ZERO)
    if (pendingSum.lessThanOrEqualTo(remainingDue)) {
      // No clipping needed.
      await this.refreshBookingGroupCaches(bookingGroupId)
      return { canceledCount: 0 }
    }

    let canceled = 0
    for (const t of pending) {
      if (pendingSum.lessThanOrEqualTo(remainingDue)) break
      await this.prisma.bookingPayoutSchedule.update({
        where: { id: t.id },
        data: {
          status: PayoutTrancheStatus.canceled,
          skipReason: 'recomputed_after_refund',
        },
      })
      pendingSum = pendingSum.minus(t.plannedAmount)
      canceled++
    }
    await this.refreshBookingGroupCaches(bookingGroupId)
    billingAudit(this.logger, 'payout_tranches_recomputed', {
      bookingGroupId,
      canceledCount: canceled,
      remainingDue: remainingDue.toFixed(2),
    })
    return { canceledCount: canceled }
  }

  /**
   * Per-booking admin override. Cancels every pending tranche, snapshots
   * the new mode + offset to the BookingGroup, and regenerates the schedule.
   * Audited via `payoutOverrideAgreedAt` + `payoutOverrideAgreedByAdminId`.
   *
   * Replaces the legacy `enableEarlyPayout` (which was offset-only).
   */
  async enablePerBookingOverride(input: {
    bookingGroupId: string
    payoutMode: PayoutMode
    offsetDays?: number | null
    adminUserId: string
  }): Promise<{ trancheCount: number }> {
    if (input.payoutMode === PayoutMode.offset_days) {
      if (!input.offsetDays || input.offsetDays <= 0) {
        throw new BadRequestException('offset_days mode requires a positive offsetDays value')
      }
    }

    await this.cancelPendingTranches(input.bookingGroupId, 'admin_override')
    await this.prisma.bookingGroup.update({
      where: { id: input.bookingGroupId },
      data: {
        payoutMode: input.payoutMode,
        payoutOffsetDaysSnapshot:
          input.payoutMode === PayoutMode.offset_days ? (input.offsetDays ?? null) : null,
        payoutOverrideAgreedAt: new Date(),
        payoutOverrideAgreedByAdminId: input.adminUserId,
      },
    })
    const result = await this.generateScheduleForBooking(input.bookingGroupId)

    billingAudit(this.logger, 'payout_override_applied', {
      bookingGroupId: input.bookingGroupId,
      payoutMode: input.payoutMode,
      offsetDays: input.offsetDays ?? null,
      adminUserId: input.adminUserId,
      trancheCount: result.trancheCount,
    })
    return result
  }

  /**
   * Refreshes the cached `transferDate` (= earliest pending tranche releaseAt)
   * and `payoutReleasedAt` (= latest released tranche releasedAt when no
   * pending tranches remain) on the BookingGroup. Called after every status
   * mutation that might shift the cache.
   */
  private async refreshBookingGroupCaches(bookingGroupId: string): Promise<void> {
    const earliestPending = await this.prisma.bookingPayoutSchedule.findFirst({
      where: { bookingGroupId, status: PayoutTrancheStatus.pending },
      orderBy: { releaseAt: 'asc' },
      select: { releaseAt: true },
    })
    const latestReleased = await this.prisma.bookingPayoutSchedule.findFirst({
      where: {
        bookingGroupId,
        status: { in: [PayoutTrancheStatus.released, PayoutTrancheStatus.paid] },
      },
      orderBy: { releasedAt: 'desc' },
      select: { releasedAt: true },
    })
    await this.prisma.bookingGroup.update({
      where: { id: bookingGroupId },
      data: {
        transferDate: earliestPending?.releaseAt ?? null,
        // payoutReleasedAt only flips once there are no more pending tranches —
        // i.e., the booking is fully disbursed (or all remaining tranches are
        // canceled/skipped).
        payoutReleasedAt: earliestPending ? null : (latestReleased?.releasedAt ?? null),
      },
    })
  }

  // -------- Webhook event handlers ---------------------------------------

  /**
   * Webhook: `payout.paid`. Persist a PayoutEvent audit row, then backfill
   * the matching `BookingPayoutSchedule.payoutEventId`. The link key is the
   * tranche's `stripePayoutId` (set by `releasePendingTranche`).
   */
  async recordPayoutPaid(payout: StripePayout, accountId: string): Promise<void> {
    const event = await this.upsertPayoutEvent(payout, accountId, PayoutStatus.paid)
    if (event) {
      await this.linkTranchesToPayoutEvent(payout.id, event.id, PayoutTrancheStatus.paid)
      // provider-owner notification on every released payout.
      notify(this.eventEmitter, NotificationType.ProviderPayoutReleased, {
        payoutEventId: event.id,
      })
    }
  }

  /**
   * Webhook: `payout.failed`. Persist + leave tranches unlinked so the cron
   * can retry under a NEW Stripe payout id (mirrors the historical
   * recordPayoutFailed semantics — a failed link would block the retry
   * because `linkTranchesToPayoutEvent` is `payoutEventId: null` guarded).
   * The tranche is flipped to `failed` and a fresh pending tranche is
   * generated for retry.
   */
  async recordPayoutFailed(payout: StripePayout, accountId: string): Promise<void> {
    const failedEvent = await this.upsertPayoutEvent(payout, accountId, PayoutStatus.failed)
    if (failedEvent) {
      notify(this.eventEmitter, NotificationType.ProviderPayoutFailed, {
        payoutEventId: failedEvent.id,
      })
      // superadmin mirror so platform team can spot
      // recurring payout failures (often bank-detail issues the camp
      // needs help fixing).
      notify(this.eventEmitter, NotificationType.SuperadminPayoutFailure, {
        payoutEventId: failedEvent.id,
      })
    }
    const tranche = await this.prisma.bookingPayoutSchedule.findFirst({
      where: { stripePayoutId: payout.id, status: PayoutTrancheStatus.released },
    })
    if (!tranche) return

    await this.prisma.$transaction(async tx => {
      await tx.bookingPayoutSchedule.update({
        where: { id: tranche.id },
        data: {
          status: PayoutTrancheStatus.failed,
          skipReason: payout.failure_message ?? payout.failure_code ?? 'stripe_payout_failed',
        },
      })
      // Generate a fresh pending tranche for the failed amount. Deposit /
      // tier metadata copied so the audit trail stays clear about which
      // tranche this retry corresponds to.
      await tx.bookingPayoutSchedule.create({
        data: {
          bookingGroupId: tranche.bookingGroupId,
          reason: PayoutTrancheReason.partial_residual,
          releaseAt: new Date(Date.now() + RESIDUAL_RETRY_DELAY_MS),
          plannedAmount: tranche.releasedAmount ?? tranche.plannedAmount,
          currency: tranche.currency,
          tierDaysBeforeStart: tranche.tierDaysBeforeStart,
          tierRefundPercent: tranche.tierRefundPercent,
        },
      })
    })
    await this.refreshBookingGroupCaches(tranche.bookingGroupId)

    billingAudit(this.logger, 'payout_tranche_failed_retry_queued', {
      trancheId: tranche.id,
      bookingGroupId: tranche.bookingGroupId,
      stripePayoutId: payout.id,
      failureCode: payout.failure_code ?? null,
    })
  }

  /**
   * Backfill `payoutEventId` on every tranche whose `stripePayoutId` matches
   * this payout, AND flip status from `released` → terminal (`paid`).
   * Idempotent — guarded by `payoutEventId: null` so re-delivered webhooks
   * don't overwrite a prior link.
   */
  private async linkTranchesToPayoutEvent(
    stripePayoutId: string,
    payoutEventId: string,
    terminalStatus: PayoutTrancheStatus
  ): Promise<void> {
    const result = await this.prisma.bookingPayoutSchedule.updateMany({
      where: { stripePayoutId, payoutEventId: null },
      data: { payoutEventId, status: terminalStatus },
    })
    if (result.count > 0) {
      // Refresh caches for every BG touched.
      const updated = await this.prisma.bookingPayoutSchedule.findMany({
        where: { stripePayoutId, payoutEventId },
        select: { bookingGroupId: true },
      })
      const bookingGroupIds = Array.from(new Set(updated.map(t => t.bookingGroupId)))
      for (const bgId of bookingGroupIds) await this.refreshBookingGroupCaches(bgId)

      billingAudit(this.logger, 'payout_event_linked', {
        stripePayoutId,
        payoutEventId,
        trancheCount: result.count,
        bookingGroupCount: bookingGroupIds.length,
      })
    }
  }

  private async upsertPayoutEvent(
    payout: StripePayout,
    accountId: string,
    status: PayoutStatus
  ): Promise<{ id: string } | null> {
    const provider = await this.prisma.provider.findUnique({
      where: { stripeAccountId: accountId },
      select: { id: true },
    })
    if (!provider) {
      this.logger.warn(`payouts.unknown_account stripe_account=${accountId} payout=${payout.id}`)
      return null
    }
    return this.prisma.payoutEvent.upsert({
      where: { stripePayoutId: payout.id },
      create: {
        providerId: provider.id,
        stripePayoutId: payout.id,
        stripeAccountId: accountId,
        amount: new Prisma.Decimal(fromStripeMinorUnits(payout.amount, payout.currency)),
        currency: payout.currency,
        arrivalDate: new Date(payout.arrival_date * 1000),
        status,
        failureCode: payout.failure_code ?? null,
        failureMessage: payout.failure_message ?? null,
      },
      update: {
        status,
        failureCode: payout.failure_code ?? null,
        failureMessage: payout.failure_message ?? null,
      },
      select: { id: true },
    })
  }
}
