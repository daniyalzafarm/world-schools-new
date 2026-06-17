import type { CaptureSchedule } from './capture-schedule.util'

/**
 * Builders for the `booking_consent_snapshots` JSON columns (Payments revamp,
 * Spec v2.5 §5.1). Shared by the booking-submit path and the §9.7 reschedule
 * re-consent path so both produce an identical snapshot shape (the snapshot is
 * dispute evidence + the SCA-mandate record, retained 10 years).
 */

export interface ConsentChargeScheduleJson {
  graceDeadline: string
  /** Internal capture shape (binary/two_stage/custom); never shown to the customer. */
  captureMode: string
  events: { sequence: number; kind: 'deposit' | 'balance'; amount: number; captureDate: string }[]
}

/** The exact charge schedule the customer is consenting to (deposit + balance bands). */
export function buildConsentChargeSchedule(
  schedule: CaptureSchedule,
  graceDeadline: Date
): ConsentChargeScheduleJson {
  return {
    graceDeadline: graceDeadline.toISOString(),
    captureMode: schedule.captureMode,
    events: schedule.events.map(e => ({
      sequence: e.sequence,
      kind: e.kind,
      amount: e.amount,
      captureDate: e.captureDate.toISOString(),
    })),
  }
}

export interface ConsentDepositInfoJson {
  applies: boolean
  amount: string | null
  gracePeriodHours: number
  campDepositEnabled: boolean
}

/**
 * The deposit terms shown at checkout. `depositAmountMajor === null` means no
 * deposit applies (Flexible / deposit switched off) — `applies` is false and the
 * amount is null; a real deposit is formatted to 2dp.
 */
export function buildConsentDepositInfo(args: {
  depositAmountMajor: number | null
  campDepositEnabled: boolean
  gracePeriodHours?: number
}): ConsentDepositInfoJson {
  return {
    applies: args.depositAmountMajor != null,
    amount: args.depositAmountMajor != null ? args.depositAmountMajor.toFixed(2) : null,
    gracePeriodHours: args.gracePeriodHours ?? 24,
    campDepositEnabled: args.campDepositEnabled,
  }
}
