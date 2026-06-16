import {
  type CancellationPolicySpecialCircumstance,
  FLEXIBLE_POLICY_TIERS,
  MODERATE_POLICY_TIERS,
  type SpecialCircumstanceType,
} from '@world-schools/wc-types'
import type { Prisma } from '../../../generated/client/client'

/**
 * Shared cancellation-policy helpers used by both `RefundsService` (to compute
 * how much of a booking is refundable RIGHT NOW) and `PayoutsService` (to
 * determine WHEN each balance increment becomes non-refundable, so we can
 * schedule a payout tranche at that boundary).
 *
 * Extracted from `RefundsService` so PayoutsService can reuse the exact same
 * tier definitions without taking a circular dep.
 *
 * Tier definitions are sourced from `@world-schools/wc-types` so the backend,
 * frontend booking modal, and provider onboarding form all evaluate the same
 * policy semantics. Do not redefine constants here.
 */

export interface PolicyTier {
  /** Threshold in days before session start. Cancellation `daysBeforeStart >= this` matches the tier. */
  daysBeforeStart: number
  /** % of the balance that's refundable when this tier matches. */
  refundPercentage: number
}

/**
 * Snapshot of the policy at a specific moment, persisted on `Refund.policySnapshot`.
 * Frozen so post-hoc edits to the provider's policy don't rewrite history.
 *
 * When `appliedCircumstance` is set, the matched tier was OVERRIDDEN by a
 * provider-configured special-circumstance refund (medical / force_majeure /
 * weather). The original `matchedTier` and `daysBeforeStart` still reflect
 * what the standard policy WOULD have returned — useful for audit ("we gave
 * 90% under medical exception, standard tier would have been 50%").
 */
export interface PolicySnapshot {
  policyName: string
  tiers: PolicyTier[]
  matchedTier: PolicyTier | null
  daysBeforeStart: number
  evaluatedAt: string
  appliedCircumstance?: {
    type: SpecialCircumstanceType
    refundPercentage: number
  } | null
  /**
   * Provenance of the resolved tier list — for observability of the
   * snapshot-vs-fallback path. Pure-additive on existing JSON; older Refund
   * rows persisted before this field will deserialize as `undefined`.
   *   - `snapshot`: read from BookingGroup.cancellationPolicySnapshot (production happy path)
   *   - `live_legacy`: no snapshot column populated; fell back to live ProviderSettings (legacy bookings)
   *   - `live_fallback`: snapshot column was non-null but unparseable; fell back to live ProviderSettings (data-corruption signal — investigate)
   */
  snapshotSource?: 'snapshot' | 'live_legacy' | 'live_fallback'
}

/**
 * Current shape version for `BookingPolicySnapshot`. Bump when the persisted
 * shape changes so readers can branch instead of mis-parsing older rows.
 */
export const BOOKING_POLICY_SNAPSHOT_VERSION = 1

/**
 * Booking-time policy snapshot persisted on `BookingGroup.cancellationPolicySnapshot`.
 * Frozen at submit so a provider editing their policy after the parent books
 * does NOT rewrite the parent's refund schedule (consumer-protection invariant).
 *
 * `tiers` carries the resolved tier list at booking time so we don't have to
 * re-resolve from `policyName + custom` later (and potentially get a different
 * answer if the canonical constants change).
 */
export interface BookingPolicySnapshot {
  policyName: string
  tiers: PolicyTier[]
  specialCircumstances: CancellationPolicySpecialCircumstance[]
  /** Wall-clock time of capture for audit. */
  capturedAt: string
  /**
   * Snapshot shape version. Lets readers branch when the shape evolves without
   * backfilling history. Rows written before this field default to `1`.
   */
  schemaVersion: number
}

/**
 * Returns the canonical tier set for a given policy name. `custom` reads
 * a JSON tier array from `ProviderSettings.cancellationPolicyCustom`.
 *
 * Source of truth for the canned policies: `@world-schools/wc-types`. Custom
 * tiers come from a JSON column populated by the wc-provider onboarding form
 * (validated by `SaveProviderSettingsDto`).
 */
export function resolveTiers(
  policyName: string,
  custom: Prisma.JsonValue | null | undefined
): PolicyTier[] {
  if (policyName === 'flexible') {
    return FLEXIBLE_POLICY_TIERS.map(t => ({ ...t }))
  }
  if (policyName === 'custom') {
    // Custom data is stored as `{ tiers: [...] }` (validated by the DTO) but
    // older / direct DB writes may have stored a bare array. Best-effort
    // coerce + filter NaN; downstream consumers sort descending themselves.
    const tierArr = Array.isArray(custom)
      ? (custom as Array<Record<string, unknown>>)
      : custom && typeof custom === 'object' && Array.isArray((custom as { tiers?: unknown }).tiers)
        ? ((custom as { tiers: Array<Record<string, unknown>> }).tiers ?? [])
        : null
    if (tierArr) {
      return tierArr
        .map(t => ({
          daysBeforeStart: Number(t.daysBeforeStart ?? t.days_before_start ?? 0),
          refundPercentage: Number(t.refundPercentage ?? t.refund_percentage ?? 0),
        }))
        .filter(t => Number.isFinite(t.daysBeforeStart) && Number.isFinite(t.refundPercentage))
    }
    // `custom` selected but the tier JSON is missing/malformed — fall back to the
    // Moderate default rather than throwing (a legit policy with a data gap).
    return MODERATE_POLICY_TIERS.map(t => ({ ...t }))
  }
  // `moderate` is the onboarding default; an empty/unset name also resolves to it.
  if (policyName === 'moderate' || !policyName) {
    return MODERATE_POLICY_TIERS.map(t => ({ ...t }))
  }
  // FAIL LOUD (Spec v2.3): any other policy name — including the not-yet-supported
  // `strict` / `super_strict` whose preset bands are pending a product lock
  // (Alex) — is a misconfiguration. Throw rather than SILENTLY pricing the refund
  // as Moderate (which would understate the parent's non-refundable exposure).
  // `strict` is intentionally absent from `CANCELLATION_POLICY_VALUES`, so the UI
  // cannot select it; this guards a stray snapshot / direct DB write.
  throw new Error(
    `resolveTiers: unsupported cancellation policy "${policyName}" (strict preset bands are pending a product lock)`
  )
}

/**
 * Coerces the JSON `cancellationPolicySpecialCircumstances` column into a
 * typed array, dropping any malformed entries. Returns [] if missing.
 */
export function resolveSpecialCircumstances(
  raw: Prisma.JsonValue | null | undefined
): CancellationPolicySpecialCircumstance[] {
  if (!Array.isArray(raw)) return []
  const validTypes = new Set<SpecialCircumstanceType>(['medical', 'force_majeure', 'weather'])
  const validPercentages = new Set([50, 75, 90, 100])
  const result: CancellationPolicySpecialCircumstance[] = []
  for (const entry of raw) {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) continue
    const obj = entry as Record<string, unknown>
    const rawType = obj.type
    if (typeof rawType !== 'string' || !validTypes.has(rawType as SpecialCircumstanceType)) continue
    const refundPercentage = Number(obj.refundPercentage ?? obj.refund_percentage ?? 0)
    if (!validPercentages.has(refundPercentage)) continue
    result.push({
      type: rawType as SpecialCircumstanceType,
      refundPercentage:
        refundPercentage as CancellationPolicySpecialCircumstance['refundPercentage'],
    })
  }
  return result
}

/**
 * Sorts tiers descending by daysBeforeStart so the first match wins
 * (mirrors the existing RefundsService behavior).
 */
export function sortTiersDescending(tiers: PolicyTier[]): PolicyTier[] {
  return [...tiers].sort((a, b) => b.daysBeforeStart - a.daysBeforeStart)
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Whole-day delta between two timestamps measured at UTC calendar-date
 * granularity. Drops the time-of-day on both sides before subtracting so
 * "60 days before camp" means "any moment of the calendar day 60 days before
 * the camp's start date" — consistent for users worldwide regardless of how
 * close to midnight they cancel.
 *
 * Without this, a parent in UTC+12 cancelling at 11pm local on the 60-day
 * boundary date would tip below the threshold by a few hours and silently
 * drop a tier; computing on calendar dates removes that unfairness.
 */
export function calendarDaysBetween(later: Date, earlier: Date): number {
  const laterUTC = Date.UTC(later.getUTCFullYear(), later.getUTCMonth(), later.getUTCDate())
  const earlierUTC = Date.UTC(earlier.getUTCFullYear(), earlier.getUTCMonth(), earlier.getUTCDate())
  return Math.floor((laterUTC - earlierUTC) / MS_PER_DAY)
}

/**
 * Build a `BookingPolicySnapshot` from live provider settings — called once
 * at booking submit. The snapshot is what `evaluatePolicy` reads at refund
 * time so policy edits after submit do NOT rewrite the parent's schedule.
 */
export function buildBookingPolicySnapshot(args: {
  policyName: string
  cancellationPolicyCustom: Prisma.JsonValue | null | undefined
  cancellationPolicySpecialCircumstances: Prisma.JsonValue | null | undefined
  now?: Date
}): BookingPolicySnapshot {
  const now = args.now ?? new Date()
  return {
    policyName: args.policyName,
    tiers: sortTiersDescending(resolveTiers(args.policyName, args.cancellationPolicyCustom)),
    specialCircumstances: resolveSpecialCircumstances(args.cancellationPolicySpecialCircumstances),
    capturedAt: now.toISOString(),
    schemaVersion: BOOKING_POLICY_SNAPSHOT_VERSION,
  }
}

/**
 * Coerces the JSON column `BookingGroup.cancellationPolicySnapshot` (stored
 * by `buildBookingPolicySnapshot`) back into a typed object. Returns null
 * when missing or malformed; callers must decide whether to fall back to
 * live settings or fail.
 */
export function readBookingPolicySnapshot(
  raw: Prisma.JsonValue | null | undefined
): BookingPolicySnapshot | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const obj = raw as Record<string, unknown>
  const policyName = obj.policyName
  const tiersRaw = obj.tiers
  const capturedAt = obj.capturedAt
  if (
    typeof policyName !== 'string' ||
    !Array.isArray(tiersRaw) ||
    typeof capturedAt !== 'string'
  ) {
    return null
  }
  const tiers = tiersRaw
    .filter((t): t is Record<string, unknown> => t !== null && typeof t === 'object')
    .map(t => ({
      daysBeforeStart: Number(t.daysBeforeStart),
      refundPercentage: Number(t.refundPercentage),
    }))
    .filter(t => Number.isFinite(t.daysBeforeStart) && Number.isFinite(t.refundPercentage))
  return {
    policyName,
    tiers,
    specialCircumstances: resolveSpecialCircumstances(
      Array.isArray(obj.specialCircumstances)
        ? (obj.specialCircumstances as Prisma.JsonValue)
        : null
    ),
    capturedAt,
    // Rows persisted before the version field existed are treated as v1.
    schemaVersion: typeof obj.schemaVersion === 'number' ? obj.schemaVersion : 1,
  }
}

/**
 * Builds a frozen snapshot of how the policy resolves at `now`. The snapshot
 * goes on `Refund.policySnapshot`, and the tier list is also reused by
 * `PayoutsService.generateScheduleForBooking` to compute tranche release dates.
 *
 * Source of truth for tiers (in priority order):
 *   1. `bookingPolicySnapshot` — frozen at submit (consumer-protection)
 *   2. `policyName + cancellationPolicyCustom` — live settings (fallback for
 *       legacy bookings predating the snapshot column)
 *
 * When `circumstance` matches a configured special-circumstance refund, the
 * tier % is overridden and recorded on the snapshot for audit.
 */
export function evaluatePolicy(args: {
  policyName: string
  cancellationPolicyCustom: Prisma.JsonValue | null | undefined
  bookingPolicySnapshot?: Prisma.JsonValue | null | undefined
  /** Live snapshot of provider's special circumstances (only used when no booking snapshot exists). */
  cancellationPolicySpecialCircumstances?: Prisma.JsonValue | null | undefined
  /** When set, attempts a provider-configured special-circumstance override. */
  circumstance?: SpecialCircumstanceType | null
  sessionStartDate: Date
  now?: Date
}): PolicySnapshot {
  const now = args.now ?? new Date()
  const bookingSnapshot = readBookingPolicySnapshot(args.bookingPolicySnapshot)

  // Provenance: did we resolve from the booking snapshot, or fall back to
  // live settings (and if so, why)? Surfaced on the returned PolicySnapshot
  // so the audit log can flag legacy/corrupted bookings for triage.
  const snapshotSource: PolicySnapshot['snapshotSource'] = bookingSnapshot
    ? 'snapshot'
    : args.bookingPolicySnapshot != null
      ? 'live_fallback'
      : 'live_legacy'

  const tiers = bookingSnapshot
    ? sortTiersDescending(bookingSnapshot.tiers)
    : sortTiersDescending(resolveTiers(args.policyName, args.cancellationPolicyCustom))

  const policyName = bookingSnapshot?.policyName ?? args.policyName

  // Calendar-day comparison (UTC) — see calendarDaysBetween for rationale.
  const daysBeforeStart = calendarDaysBetween(args.sessionStartDate, now)
  const standardTier = tiers.find(t => daysBeforeStart >= t.daysBeforeStart) ?? null

  const specialCircumstances = bookingSnapshot
    ? bookingSnapshot.specialCircumstances
    : resolveSpecialCircumstances(args.cancellationPolicySpecialCircumstances)

  let matchedTier: PolicyTier | null = standardTier
  let appliedCircumstance: PolicySnapshot['appliedCircumstance'] = null
  if (args.circumstance) {
    const override = specialCircumstances.find(c => c.type === args.circumstance)
    if (override) {
      // Special-circumstance refunds REPLACE the tier % (they don't stack).
      // The override only kicks in if it would actually help the parent —
      // never use a configured override to reduce a refund the parent
      // already qualifies for under the standard policy.
      const standardPct = standardTier?.refundPercentage ?? 0
      if (override.refundPercentage > standardPct) {
        matchedTier = {
          daysBeforeStart: standardTier?.daysBeforeStart ?? 0,
          refundPercentage: override.refundPercentage,
        }
        appliedCircumstance = {
          type: override.type,
          refundPercentage: override.refundPercentage,
        }
      }
    }
  }

  return {
    policyName,
    tiers,
    matchedTier,
    daysBeforeStart,
    evaluatedAt: now.toISOString(),
    appliedCircumstance,
    snapshotSource,
  }
}
