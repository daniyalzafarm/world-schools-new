import { BadRequestException } from '@nestjs/common'
import {
  BALANCE_DUE_OFFSET_DAYS_DEPOSIT_FLOW,
  BALANCE_DUE_OFFSET_DAYS_NO_DEPOSIT_FLOW,
  computeDepositAmountNumber,
  INVALID_DEPOSIT_CONFIG,
  isFlexiblePolicy,
} from '@world-schools/wc-utils'
import type { DepositType } from '@world-schools/wc-types'
import { Prisma } from '../../generated/client/client'
import { PaymentMode } from '../../generated/client/enums'

/**
 * Thresholds and deadline helpers come from `@world-schools/wc-utils`, which
 * is the single source of truth shared with the wc-booking frontend. Backend
 * code continues to import these symbols from this file — the re-export keeps
 * the existing call sites (booking-groups.service, refund service, crons)
 * working without touching them.
 */
export {
  BALANCE_DUE_OFFSET_DAYS_DEPOSIT_FLOW,
  BALANCE_DUE_OFFSET_DAYS_NO_DEPOSIT_FLOW,
  PROVIDER_RESPONSE_WINDOW_HOURS,
  computeGracePeriodDeadline,
  computeGracePeriodDeadlineFromRequest,
  computeProviderResponseDeadline,
} from '@world-schools/wc-utils'

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Deposit settings shape consumed by the snapshot util. Deposit settings are
 * the provider's (`ProviderSettings.deposit*`) — the single source of truth.
 * The booking submit path reads them off the provider and snapshots the
 * resulting amount onto the BookingGroup.
 *
 * The interface is intentionally narrow — accepts ANY object with these four
 * fields so the provider-settings row satisfies it.
 */
export interface DepositSettingsForSnapshot {
  depositRequired?: boolean | null
  depositType?: string | null
  depositPercentage?: number | null
  depositFixedAmount?: Prisma.Decimal | null
}

/**
 * Current shape version for `BookingDepositSnapshot`. Bump when the persisted
 * shape changes so readers can branch instead of mis-parsing older rows.
 */
export const BOOKING_DEPOSIT_SNAPSHOT_VERSION = 1

/**
 * Frozen deposit *terms* persisted on `BookingGroup.depositSnapshot` at submit.
 * Preserves what the parent agreed to (type + percentage/fixed + the resolved
 * amount) so provider edits to their deposit settings can't rewrite an
 * in-flight booking's terms — symmetric with `BookingPolicySnapshot`.
 *
 * AUDIT/receipt/dispute data only: all payment/refund/payout math reads the
 * scalar `BookingGroup.depositAmount` (== `resolvedAmount` here). Decimals are
 * serialized as strings to preserve precision in stored JSON.
 */
export interface BookingDepositSnapshot {
  depositRequired: boolean
  depositType: DepositType | null
  depositPercentage: number | null
  /** Configured fixed amount in major units, as a string. Null for percentage / no-deposit. */
  depositFixedAmount: string | null
  /** Resolved deposit captured at submit (== the scalar `depositAmount`), as a string. */
  resolvedAmount: string | null
  capturedAt: string
  schemaVersion: number
}

/**
 * Normalizes a raw `depositType` string (from the loosely-typed settings row)
 * to the canonical snapshot union.
 */
function normalizeDepositType(t: string | null | undefined): DepositType | null {
  if (t === 'percentage') return 'percentage'
  if (t === 'fixed') return 'fixed'
  return null
}

export interface SnapshotInput {
  totalAmount: Prisma.Decimal
  sessionStartDate: Date
  /// When `providerAppFeeCustom` is true and `providerAppFeePercentage` is non-null,
  /// the provider override is used. Otherwise the system default is used.
  providerAppFeeCustom: boolean
  providerAppFeePercentage: Prisma.Decimal | null
  systemDefaultAppFee: Prisma.Decimal
  depositSettings: DepositSettingsForSnapshot | null
  /// Payments revamp (Spec v2.3): per-Listing deposit override. When `false`,
  /// this camp takes NO deposit regardless of provider deposit settings.
  /// Defaults to `true` (deposit applies) when omitted.
  depositEnabledForCamp?: boolean
  /// Payments revamp (Spec v2.3, Alex answer 4): the booking's cancellation
  /// policy name. The Flexible tier is "fully refundable", which only holds with
  /// ZERO deposit — so a Flexible booking is forced to no-deposit regardless of
  /// provider/camp settings.
  policyName?: string | null
  now: Date
}

export interface BookingFinancialSnapshot {
  /// Amount captured at provider acceptance (manual capture). Null when
  /// no-deposit + due-later (SetupIntent path).
  depositAmount: Prisma.Decimal | null
  paymentMode: PaymentMode
  /// When the off-session balance charge is due. Null for full_at_booking
  /// (everything is due now and captured at acceptance).
  balanceDueAt: Date | null
  appFeePercentageSnapshot: Prisma.Decimal
  serviceFeeAmount: Prisma.Decimal
  /// Frozen deposit terms for audit/receipts (null when no deposit). Math uses
  /// `depositAmount`; this preserves the agreed type + percentage/fixed.
  depositSnapshot: BookingDepositSnapshot | null
}

/**
 * Computes the financial snapshot to persist on a BookingGroup at submission.
 *
 * The booking-groups service must call this synchronously inside its submit
 * transaction so every downstream consumer (PaymentIntentsService for the
 * authorize call, RefundsService for refund math, PayoutsService for the
 * transfer date) reads the same frozen values regardless of later provider
 * setting changes.
 *
 * Validation: throws BadRequestException for invalid provider configurations
 * (e.g. depositType='percentage' but no depositPercentage). Validates monetary
 * values too — a 0-amount deposit is treated as "no deposit configured."
 */
export function computeBookingFinancialSnapshot(input: SnapshotInput): BookingFinancialSnapshot {
  const { totalAmount, sessionStartDate, depositSettings, now } = input

  const appFeePercentageSnapshot =
    input.providerAppFeeCustom && input.providerAppFeePercentage != null
      ? input.providerAppFeePercentage
      : input.systemDefaultAppFee
  const serviceFeeAmount = totalAmount
    .mul(appFeePercentageSnapshot)
    .div(100)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)

  // Payments revamp (Spec v2.3): a deposit applies only when the provider
  // requires one AND the camp's per-Listing toggle is on AND the policy is not
  // Flexible (Flexible is "fully refundable", incompatible with a non-refundable
  // deposit — Alex answer 4). When suppressed, the booking follows the no-deposit
  // flow; the frozen `depositAmount = null` makes the decision immutable, so a
  // later camp/provider toggle never moves this in-flight booking.
  const depositSuppressed =
    input.depositEnabledForCamp === false || isFlexiblePolicy(input.policyName)
  const effectiveDepositSettings = depositSuppressed ? null : depositSettings

  const depositAmount = computeDepositAmount(totalAmount, effectiveDepositSettings)
  const depositSnapshot = buildDepositSnapshot(effectiveDepositSettings, depositAmount, now)
  const daysUntilStart = Math.floor((sessionStartDate.getTime() - now.getTime()) / MS_PER_DAY)

  let paymentMode: PaymentMode
  let balanceDueAt: Date | null

  if (depositAmount?.greaterThan(0)) {
    // Deposit flow: deposit captured at acceptance, balance off-session later.
    paymentMode = PaymentMode.deposit_then_balance
    balanceDueAt = subtractDays(sessionStartDate, BALANCE_DUE_OFFSET_DAYS_DEPOSIT_FLOW)
    // Edge case: if balanceDueAt is in the past (booked very close to camp
    // start with deposit), pull it forward to "now" so the cron picks it up
    // immediately after deposit captures.
    if (balanceDueAt < now) balanceDueAt = now
  } else if (daysUntilStart >= BALANCE_DUE_OFFSET_DAYS_NO_DEPOSIT_FLOW) {
    // No deposit, far enough out: SetupIntent path. The balance-charge cron
    // will pick this up at `balanceDueAt`.
    paymentMode = PaymentMode.full_at_due
    balanceDueAt = subtractDays(sessionStartDate, BALANCE_DUE_OFFSET_DAYS_NO_DEPOSIT_FLOW)
  } else {
    // No deposit, close to start: full charge captured at acceptance.
    paymentMode = PaymentMode.full_at_booking
    balanceDueAt = null
  }

  return {
    depositAmount,
    paymentMode,
    balanceDueAt,
    appFeePercentageSnapshot,
    serviceFeeAmount,
    depositSnapshot,
  }
}

/**
 * Decimal-typed wrapper around `computeDepositAmountNumber`. The policy
 * decision is shared with the frontend (pure JS numbers); this layer keeps
 * the persisted value as a `Prisma.Decimal` and translates validation errors
 * into `BadRequestException` so controllers handle them the way they handled
 * the pre-refactor `BadRequestException` throws.
 */
export function computeDepositAmount(
  totalAmount: Prisma.Decimal,
  settings: DepositSettingsForSnapshot | null
): Prisma.Decimal | null {
  const numericSettings = settings
    ? {
        depositRequired: settings.depositRequired,
        depositType: settings.depositType,
        depositPercentage: settings.depositPercentage,
        depositFixedAmount: settings.depositFixedAmount
          ? settings.depositFixedAmount.toNumber()
          : (settings.depositFixedAmount ?? null),
      }
    : null

  let amount: number | null
  try {
    amount = computeDepositAmountNumber(totalAmount.toNumber(), numericSettings)
  } catch (err) {
    if (err instanceof Error && err.message.startsWith(INVALID_DEPOSIT_CONFIG)) {
      // Strip the marker prefix so the user-facing message reads the same as
      // it did before the refactor.
      const message = err.message.slice(INVALID_DEPOSIT_CONFIG.length + 2)
      throw new BadRequestException(`Deposit configuration is invalid: ${message}`)
    }
    throw err
  }
  if (amount == null) return null
  return new Prisma.Decimal(amount).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
}

/**
 * Builds the frozen deposit snapshot from the settings used at submit and the
 * resolved amount. Returns null when no deposit was resolved — mirroring how
 * the no-deposit path leaves `cancellationPolicySnapshot` null (nothing to
 * preserve for audit).
 */
function buildDepositSnapshot(
  settings: DepositSettingsForSnapshot | null,
  resolvedAmount: Prisma.Decimal | null,
  now: Date
): BookingDepositSnapshot | null {
  if (resolvedAmount == null) return null
  return {
    depositRequired: settings?.depositRequired ?? false,
    depositType: normalizeDepositType(settings?.depositType),
    depositPercentage: settings?.depositPercentage ?? null,
    depositFixedAmount:
      settings?.depositFixedAmount != null ? settings.depositFixedAmount.toString() : null,
    resolvedAmount: resolvedAmount.toString(),
    capturedAt: now.toISOString(),
    schemaVersion: BOOKING_DEPOSIT_SNAPSHOT_VERSION,
  }
}

function subtractDays(date: Date, days: number): Date {
  const result = new Date(date.getTime())
  result.setUTCDate(result.getUTCDate() - days)
  return result
}

/**
 * Coerces the JSON column `BookingGroup.depositSnapshot` (written by
 * `buildDepositSnapshot`) back into a typed object. Returns null when missing
 * or malformed. For audit/receipt/dispute surfaces only — payment, refund, and
 * payout math read the scalar `BookingGroup.depositAmount`.
 */
export function readBookingDepositSnapshot(
  raw: Prisma.JsonValue | null | undefined
): BookingDepositSnapshot | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const obj = raw as Record<string, unknown>
  if (typeof obj.capturedAt !== 'string') return null
  const numOrNull = (v: unknown): number | null =>
    typeof v === 'number' && Number.isFinite(v) ? v : null
  const strOrNull = (v: unknown): string | null => (typeof v === 'string' ? v : null)
  return {
    depositRequired: obj.depositRequired === true,
    depositType: normalizeDepositType(typeof obj.depositType === 'string' ? obj.depositType : null),
    depositPercentage: numOrNull(obj.depositPercentage),
    depositFixedAmount: strOrNull(obj.depositFixedAmount),
    resolvedAmount: strOrNull(obj.resolvedAmount),
    capturedAt: obj.capturedAt,
    // Rows persisted before the version field existed are treated as v1.
    schemaVersion: typeof obj.schemaVersion === 'number' ? obj.schemaVersion : 1,
  }
}
