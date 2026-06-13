import { type PolicyTier, sortTiersDescending } from './cancellation-policy.util'

/**
 * Pure capture-schedule derivation engine (Payments revamp, Spec v2.3).
 *
 * Translates a booking's cancellation-policy tiers + deposit into the ordered
 * list of capture events the scheduler persists as `booking_scheduled_captures`
 * rows. No Nest/Prisma dependencies — mirrors `cancellation-policy.util.ts` so
 * it is trivially unit-testable and survives the payout-engine removal (M2).
 *
 * Organising principle: capture money only as it becomes NON-REFUNDABLE.
 *   - Deposit (sequence 0): non-refundable at the grace deadline.
 *   - Balance (sequence 1..n): the increment that flips from refundable to
 *     non-refundable at each cancellation-policy tier boundary, captured at the
 *     boundary date (00:00 in the programme-location timezone, stored as UTC).
 *
 * Contractual invariants encoded here:
 *   - Refund % applies to the BALANCE only (the deposit is excluded from the walk).
 *   - The acceptance guard: `effectiveCaptureDate = max(captureDate,
 *     graceDeadline, acceptanceTime)` — no capture may resolve before the
 *     provider accepts (CT v1.4 §5.2(f), §7.4(d)).
 */

/** Internal capture mechanics — observability only, NEVER shown to users. */
export type CaptureMode = 'binary' | 'two_stage' | 'custom'

export interface CaptureScheduleEvent {
  /** 0 = deposit; 1..n = balance captures (furthest-out boundary first). */
  sequence: number
  kind: 'deposit' | 'balance'
  /** Major-unit amount for this capture. The events sum exactly to deposit + balance. */
  amount: number
  /** Band-boundary date (00:00 programme-location tz, as a UTC instant), pre-guard. */
  captureDate: Date
  /** `max(captureDate, graceDeadline, acceptanceTime)` — the cron fires at/after this. */
  effectiveCaptureDate: Date
}

export interface CaptureSchedule {
  events: CaptureScheduleEvent[]
  /** Derived from the number of balance capture events (1 → binary, 2 → two_stage, >2 → custom). */
  captureMode: CaptureMode
}

function round2(v: number): number {
  return Math.round(v * 100) / 100
}

function readNumericPart(parts: Intl.DateTimeFormatPart[], type: string): number {
  const raw = parts.find(p => p.type === type)?.value
  const n = Number(raw)
  if (!Number.isFinite(n)) {
    throw new Error(`Intl.DateTimeFormat returned no usable "${type}" part (got ${String(raw)})`)
  }
  return n
}

/**
 * The UTC instant corresponding to 00:00:00 local time, on the given calendar
 * date, in the given IANA zone. Uses the standard offset round-trip so it is
 * correct across DST transitions. Lifted from the (removed) payout service.
 */
function tzMidnightAsUtc(year: number, month: number, day: number, tz: string): Date {
  const naiveUtc = Date.UTC(year, month, day, 0, 0, 0)
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date(naiveUtc))
  const localAsUtc = Date.UTC(
    readNumericPart(parts, 'year'),
    readNumericPart(parts, 'month') - 1,
    readNumericPart(parts, 'day'),
    readNumericPart(parts, 'hour') % 24,
    readNumericPart(parts, 'minute'),
    readNumericPart(parts, 'second')
  )
  const offsetMs = naiveUtc - localAsUtc
  return new Date(naiveUtc + offsetMs)
}

/**
 * Resolves the programme-location timezone with the contractual fallback chain:
 * the camp's own timezone if known, else the provider's registered timezone,
 * else UTC. (The Camp model has no dedicated tz column today, so in practice
 * this resolves to the provider timezone; `campTimezone` is accepted for when
 * a location-derived zone is added.)
 */
export function resolveProgrammeLocationTimezone(opts: {
  campTimezone?: string | null
  providerTimezone?: string | null
}): string {
  return opts.campTimezone || opts.providerTimezone || 'UTC'
}

/**
 * The capture boundary for "N days before programme start": 00:00 local time in
 * `tz` on the boundary date, returned as a UTC instant.
 *
 * `session.startDate` is a date-only value (stored at midnight UTC), so its UTC
 * calendar date IS the canonical programme date — we must NOT convert the
 * instant through `tz` (that would shift the day backward in western zones).
 * `tz` is used only to anchor the boundary date to local midnight. Falls back to
 * midnight UTC of the boundary date if the IANA zone is invalid (never throws —
 * a bad tz must not block a booking).
 */
export function calendarDayMidnightUTC(sessionStart: Date, daysBefore: number, tz: string): Date {
  const carrier = new Date(
    Date.UTC(sessionStart.getUTCFullYear(), sessionStart.getUTCMonth(), sessionStart.getUTCDate())
  )
  carrier.setUTCDate(carrier.getUTCDate() - Math.floor(daysBefore))
  try {
    return tzMidnightAsUtc(
      carrier.getUTCFullYear(),
      carrier.getUTCMonth(),
      carrier.getUTCDate(),
      tz
    )
  } catch {
    return carrier
  }
}

/** `max(captureDate, graceDeadline, acceptanceTime?)` — the acceptance guard. */
export function resolveEffectiveCaptureDate(
  captureDate: Date,
  graceDeadline: Date,
  acceptanceTime?: Date | null
): Date {
  let t = Math.max(captureDate.getTime(), graceDeadline.getTime())
  if (acceptanceTime) t = Math.max(t, acceptanceTime.getTime())
  return new Date(t)
}

/**
 * Walks the policy tiers furthest→closest and emits a balance capture each time
 * the refund % drops, for the increment that becomes non-refundable at that
 * boundary. Equal-% consecutive tiers produce no event. Any portion still
 * refundable after the closest tier (a policy that never reaches 0%) is captured
 * at the session-start boundary. Rounding residual is folded into the final
 * event so the events sum EXACTLY to `balanceAmount`.
 */
function deriveBalanceCaptureEvents(
  tiers: PolicyTier[],
  balanceAmount: number,
  sessionStart: Date,
  tz: string
): Array<{ captureDate: Date; amount: number }> {
  if (balanceAmount <= 0) return []
  const sorted = sortTiersDescending(tiers)
  const raw: Array<{ captureDate: Date; amount: number }> = []
  let prevPct = 100
  for (const tier of sorted) {
    const pct = tier.refundPercentage
    if (pct < prevPct) {
      const dropFraction = (prevPct - pct) / 100
      raw.push({
        captureDate: calendarDayMidnightUTC(sessionStart, tier.daysBeforeStart, tz),
        amount: round2(balanceAmount * dropFraction),
      })
      prevPct = pct
    }
  }
  // Residual still refundable after the last tier becomes non-refundable at
  // session start (programme delivered).
  if (prevPct > 0) {
    raw.push({
      captureDate: calendarDayMidnightUTC(sessionStart, 0, tz),
      amount: round2(balanceAmount * (prevPct / 100)),
    })
  }
  if (raw.length === 0) {
    // No drops at all (shouldn't happen for canonical policies) — capture the
    // whole balance at session start.
    return [
      { captureDate: calendarDayMidnightUTC(sessionStart, 0, tz), amount: round2(balanceAmount) },
    ]
  }
  // Fold the rounding residual into the final event so the sum is exact.
  const sumExceptLast = raw.slice(0, -1).reduce((s, e) => s + e.amount, 0)
  raw[raw.length - 1].amount = round2(balanceAmount - sumExceptLast)
  return raw
}

/** 1 balance event → binary, 2 → two_stage, >2 → custom. */
export function deriveCaptureMode(balanceEventCount: number): CaptureMode {
  if (balanceEventCount <= 1) return 'binary'
  if (balanceEventCount === 2) return 'two_stage'
  return 'custom'
}

/**
 * Builds the full ordered capture schedule for a booking.
 *
 * @param depositAmount Major-unit deposit (0 / null for no-deposit listings).
 * @param balanceAmount Major-unit balance (total − deposit; the whole price for
 *   no-deposit listings).
 * @param graceDeadline Request-anchored grace deadline (deposit non-refundable from here).
 * @param acceptanceTime Provider acceptance time, or null at request (acceptance guard).
 */
export function buildCaptureSchedule(args: {
  tiers: PolicyTier[]
  depositAmount: number | null | undefined
  balanceAmount: number
  sessionStart: Date
  timezone: string
  graceDeadline: Date
  acceptanceTime?: Date | null
}): CaptureSchedule {
  const events: CaptureScheduleEvent[] = []
  const deposit = args.depositAmount ?? 0

  if (deposit > 0) {
    events.push({
      sequence: 0,
      kind: 'deposit',
      amount: round2(deposit),
      captureDate: args.graceDeadline,
      effectiveCaptureDate: resolveEffectiveCaptureDate(
        args.graceDeadline,
        args.graceDeadline,
        args.acceptanceTime
      ),
    })
  }

  const balanceEvents = deriveBalanceCaptureEvents(
    args.tiers,
    args.balanceAmount,
    args.sessionStart,
    args.timezone
  )
  balanceEvents.forEach((e, i) => {
    events.push({
      sequence: i + 1,
      kind: 'balance',
      amount: e.amount,
      captureDate: e.captureDate,
      effectiveCaptureDate: resolveEffectiveCaptureDate(
        e.captureDate,
        args.graceDeadline,
        args.acceptanceTime
      ),
    })
  })

  return { events, captureMode: deriveCaptureMode(balanceEvents.length) }
}
