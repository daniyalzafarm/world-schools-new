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
export const GRACE_PERIOD_HOURS = 48

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

/// Grace-period deadline (`gracePeriodEndsAt`) — provider acceptance + 48h.
export function computeGracePeriodDeadline(respondedAt: Date): Date {
  return new Date(respondedAt.getTime() + GRACE_PERIOD_HOURS * MS_PER_HOUR)
}

function round2(v: number): number {
  return Math.round(v * 100) / 100
}
