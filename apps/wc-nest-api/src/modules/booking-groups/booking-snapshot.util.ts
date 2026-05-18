import { BadRequestException } from '@nestjs/common'
import {
  BALANCE_DUE_OFFSET_DAYS_DEPOSIT_FLOW,
  BALANCE_DUE_OFFSET_DAYS_NO_DEPOSIT_FLOW,
  computeDepositAmountNumber,
  INVALID_DEPOSIT_CONFIG,
} from '@world-schools/wc-utils'
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
  computeProviderResponseDeadline,
} from '@world-schools/wc-utils'

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Deposit settings shape consumed by the snapshot util. Phase 9: these now
 * live on `Camp` (snapshotted from `ProviderSettings.deposit*` at camp
 * creation, editable per camp). Provider-level settings remain the default
 * for new camps but the booking submit path reads off the camp directly.
 *
 * The interface is intentionally narrow — accepts ANY object with these four
 * fields so both `Camp` rows and the provider-level row (used at camp create
 * time as the seed) satisfy it.
 */
export interface DepositSettingsForSnapshot {
  depositRequired?: boolean | null
  depositType?: string | null
  depositPercentage?: number | null
  depositFixedAmount?: Prisma.Decimal | null
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

  const depositAmount = computeDepositAmount(totalAmount, depositSettings)
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

function subtractDays(date: Date, days: number): Date {
  const result = new Date(date.getTime())
  result.setUTCDate(result.getUTCDate() - days)
  return result
}
