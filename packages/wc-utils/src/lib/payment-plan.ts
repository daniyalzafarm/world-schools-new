/**
 * Cross-product payment-plan policy: a single source of truth for the
 * day-offset thresholds, provider-response window, and grace-period that
 * govern the booking → capture → balance-due lifecycle.
 *
 * Consumers:
 *   - wc-booking frontend — decides Stripe Elements mode + renders
 *     "You'll be charged €X" copy.
 *   - wc-nest-api backend — computes the persisted financial snapshot on
 *     submit (the authoritative numbers stored on `BookingGroup`).
 *
 * The backend wraps `computeDepositAmountNumber` to retain `Prisma.Decimal`
 * precision on persistence and re-throw validation errors as
 * `BadRequestException`. Number arithmetic at the cents scale we operate at
 * is bit-stable through 2dp rounding — see booking-snapshot.util.ts.
 */

export const BALANCE_DUE_OFFSET_DAYS_DEPOSIT_FLOW = 60
export const BALANCE_DUE_OFFSET_DAYS_NO_DEPOSIT_FLOW = 90
export const PROVIDER_RESPONSE_WINDOW_HOURS = 72

/**
 * @deprecated Payments revamp (Spec v2.3): the grace window is now anchored to
 * the booking REQUEST (24h), not provider acceptance (48h). Use
 * {@link GRACE_PERIOD_FROM_REQUEST_HOURS} and
 * {@link computeGracePeriodDeadlineFromRequest}. Retained during the cutover so
 * legacy `computeGracePeriodDeadline` callers keep compiling.
 */
export const GRACE_PERIOD_HOURS = 48

/**
 * Payments revamp (Spec v2.3): grace window measured from the booking REQUEST
 * submission time (CT v1.4 §8.4(b) / PT v1.7 §7.3).
 */
export const GRACE_PERIOD_FROM_REQUEST_HOURS = 24

/**
 * Programmes starting within this many calendar days of the booking request get
 * a ZERO-LENGTH grace window (CT v1.4 §8.4(b): grace "does not apply where the
 * Programme start date is within seven (7) days of the booking request").
 */
export const NEAR_TERM_THRESHOLD_DAYS = 7

const MS_PER_DAY = 24 * 60 * 60 * 1000
const MS_PER_HOUR = 60 * 60 * 1000

/**
 * Marker prefix on `Error.message` so backend wrappers can recognise a
 * validation failure from this module without depending on a custom class
 * (which would have to be exported and imported across the wc-utils boundary).
 */
export const INVALID_DEPOSIT_CONFIG = 'INVALID_DEPOSIT_CONFIG'

export type PaymentPlanKind = 'deposit' | 'full' | 'setup'

/**
 * Loose four-field shape accepted by both the camp row (backend) and the
 * mirror returned by the camp API (frontend). The `depositFixedAmount` type
 * is left as `number` for the shared helper; backend code converts its
 * `Prisma.Decimal` to a number before calling.
 */
export interface DepositSettingsForPlan {
  depositRequired?: boolean | null
  depositType?: string | null
  depositPercentage?: number | null
  depositFixedAmount?: number | null
}

export interface PaymentPlan {
  kind: PaymentPlanKind
  /// Major-unit amount due TODAY at submit (the deposit, the full balance, or
  /// 0 for the setup-only flow).
  chargeAmount: number
  /// Major-unit amount that will eventually be charged in total (used to
  /// render the "you'll be charged €X on Aug 1" copy on the setup path).
  futureBalanceAmount: number
  /// Total program cost (chargeAmount + futureBalanceAmount).
  total: number
}

export function computePaymentPlan(input: {
  total: number
  sessionStartDate: Date
  depositSettings: DepositSettingsForPlan | null | undefined
  now?: Date
}): PaymentPlan {
  const now = input.now ?? new Date()
  const total = input.total
  const settings = input.depositSettings ?? null

  const depositAmount = computeDepositAmountNumber(total, settings)
  const daysUntilStart = Math.floor((input.sessionStartDate.getTime() - now.getTime()) / MS_PER_DAY)

  if (depositAmount && depositAmount > 0) {
    return {
      kind: 'deposit',
      chargeAmount: round2(depositAmount),
      futureBalanceAmount: round2(total - depositAmount),
      total: round2(total),
    }
  }
  if (daysUntilStart >= BALANCE_DUE_OFFSET_DAYS_NO_DEPOSIT_FLOW) {
    return {
      kind: 'setup',
      chargeAmount: 0,
      futureBalanceAmount: round2(total),
      total: round2(total),
    }
  }
  return {
    kind: 'full',
    chargeAmount: round2(total),
    futureBalanceAmount: 0,
    total: round2(total),
  }
}

/**
 * Payments revamp (Spec v2.3, Alex answer 4): the Flexible tier means "fully
 * refundable", which only holds if it carries NO deposit — a captured deposit is
 * non-refundable after the grace window. Deposit is therefore force-disabled for
 * Flexible bookings regardless of provider/camp deposit settings. Deposit
 * resolution must consult this and record the override in `depositSnapshot`.
 */
export function isFlexiblePolicy(policyName: string | null | undefined): boolean {
  return policyName === 'flexible'
}

/**
 * Resolves deposit configuration into a concrete amount in major units.
 *
 * Returns null when no deposit is configured (or it would resolve to zero).
 * Throws an `Error` whose message starts with [[INVALID_DEPOSIT_CONFIG]] for
 * internally inconsistent settings (e.g. `percentage` type with no
 * percentage). The backend's Decimal wrapper catches this and re-throws as
 * `BadRequestException` to preserve the existing API contract.
 */
export function computeDepositAmountNumber(
  total: number,
  settings: DepositSettingsForPlan | null
): number | null {
  if (!settings?.depositRequired) return null

  const type = settings.depositType
  if (type === 'percentage') {
    const pct = settings.depositPercentage
    if (pct == null || !Number.isFinite(pct) || pct <= 0 || pct > 100) {
      throw new Error(`${INVALID_DEPOSIT_CONFIG}: depositPercentage must be between 1 and 100`)
    }
    const amount = round2((total * pct) / 100)
    return amount > 0 ? amount : null
  }

  if (type === 'fixed') {
    const fixed = settings.depositFixedAmount
    if (fixed == null || !Number.isFinite(fixed) || fixed <= 0) {
      throw new Error(`${INVALID_DEPOSIT_CONFIG}: depositFixedAmount must be positive`)
    }
    // Cap at total so we never preview a charge larger than the booking value
    // (consumer-protection sanity check).
    return Math.min(fixed, total)
  }

  throw new Error(`${INVALID_DEPOSIT_CONFIG}: unknown depositType '${type}'`)
}

/// Provider response deadline (`expiresAt`) — submit time + 72h.
export function computeProviderResponseDeadline(now: Date): Date {
  return new Date(now.getTime() + PROVIDER_RESPONSE_WINDOW_HOURS * MS_PER_HOUR)
}

/**
 * @deprecated Payments revamp (Spec v2.3): grace is request-anchored now. Use
 * {@link computeGracePeriodDeadlineFromRequest}. Retained for legacy callers
 * during the cutover.
 */
export function computeGracePeriodDeadline(respondedAt: Date): Date {
  return new Date(respondedAt.getTime() + GRACE_PERIOD_HOURS * MS_PER_HOUR)
}

/**
 * Request-anchored grace deadline (Payments revamp, Spec v2.3).
 *
 * Returns `requestTime + 24h`, EXCEPT when the programme starts within
 * {@link NEAR_TERM_THRESHOLD_DAYS} calendar days of the request — then the grace
 * window is zero-length (the deadline IS the request time), so the deposit
 * captures at provider acceptance rather than before it. Computing zero-length
 * (rather than skipping grace) keeps the acceptance guard intact: a capture can
 * never resolve before `acceptanceTime` regardless of the grace deadline.
 */
export function computeGracePeriodDeadlineFromRequest(
  requestTime: Date,
  sessionStartDate: Date
): Date {
  const daysUntilStart = Math.floor(
    (sessionStartDate.getTime() - requestTime.getTime()) / MS_PER_DAY
  )
  if (daysUntilStart <= NEAR_TERM_THRESHOLD_DAYS) {
    return new Date(requestTime.getTime())
  }
  return new Date(requestTime.getTime() + GRACE_PERIOD_FROM_REQUEST_HOURS * MS_PER_HOUR)
}

function round2(v: number): number {
  return Math.round(v * 100) / 100
}
