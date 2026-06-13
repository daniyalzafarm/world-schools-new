import type { PolicyTier } from './cancellation-policy.util'
import {
  buildCaptureSchedule,
  calendarDayMidnightUTC,
  deriveCaptureMode,
  resolveEffectiveCaptureDate,
  resolveProgrammeLocationTimezone,
} from './capture-schedule.util'

const FLEXIBLE: PolicyTier[] = [
  { daysBeforeStart: 30, refundPercentage: 100 },
  { daysBeforeStart: 0, refundPercentage: 0 },
]
const MODERATE: PolicyTier[] = [
  { daysBeforeStart: 60, refundPercentage: 100 },
  { daysBeforeStart: 30, refundPercentage: 50 },
  { daysBeforeStart: 0, refundPercentage: 0 },
]
// 3 distinct drops → custom mode.
const CUSTOM_3: PolicyTier[] = [
  { daysBeforeStart: 90, refundPercentage: 100 },
  { daysBeforeStart: 60, refundPercentage: 75 },
  { daysBeforeStart: 30, refundPercentage: 50 },
  { daysBeforeStart: 0, refundPercentage: 0 },
]
// Equal-% consecutive bands must collapse to no event at the equal band.
const CUSTOM_EQUAL: PolicyTier[] = [
  { daysBeforeStart: 90, refundPercentage: 100 },
  { daysBeforeStart: 60, refundPercentage: 100 },
  { daysBeforeStart: 30, refundPercentage: 50 },
  { daysBeforeStart: 0, refundPercentage: 0 },
]

const SESSION_START = new Date('2026-08-10T00:00:00.000Z')
const GRACE = new Date('2026-04-02T12:00:00.000Z')

function sum(events: { amount: number }[]): number {
  return Math.round(events.reduce((s, e) => s + e.amount, 0) * 100) / 100
}

describe('deriveCaptureMode', () => {
  it('maps event count to internal mode', () => {
    expect(deriveCaptureMode(0)).toBe('binary')
    expect(deriveCaptureMode(1)).toBe('binary')
    expect(deriveCaptureMode(2)).toBe('two_stage')
    expect(deriveCaptureMode(3)).toBe('custom')
    expect(deriveCaptureMode(4)).toBe('custom')
  })
})

describe('resolveEffectiveCaptureDate (acceptance guard)', () => {
  const early = new Date('2026-01-01T00:00:00.000Z')
  const mid = new Date('2026-02-01T00:00:00.000Z')
  const late = new Date('2026-03-01T00:00:00.000Z')

  it('takes the max of captureDate and graceDeadline when no acceptance yet', () => {
    expect(resolveEffectiveCaptureDate(early, late).getTime()).toBe(late.getTime())
    expect(resolveEffectiveCaptureDate(late, early).getTime()).toBe(late.getTime())
  })

  it('never resolves before acceptanceTime', () => {
    expect(resolveEffectiveCaptureDate(early, early, late).getTime()).toBe(late.getTime())
  })

  it('keeps the captureDate when it is the latest of the three', () => {
    expect(resolveEffectiveCaptureDate(late, mid, early).getTime()).toBe(late.getTime())
  })
})

describe('resolveProgrammeLocationTimezone', () => {
  it('prefers camp tz, then provider tz, then UTC', () => {
    expect(
      resolveProgrammeLocationTimezone({
        campTimezone: 'Asia/Tokyo',
        providerTimezone: 'Europe/Zurich',
      })
    ).toBe('Asia/Tokyo')
    expect(resolveProgrammeLocationTimezone({ providerTimezone: 'Europe/Zurich' })).toBe(
      'Europe/Zurich'
    )
    expect(resolveProgrammeLocationTimezone({})).toBe('UTC')
    expect(resolveProgrammeLocationTimezone({ campTimezone: null, providerTimezone: null })).toBe(
      'UTC'
    )
  })
})

describe('calendarDayMidnightUTC', () => {
  it('computes a UTC boundary at midnight UTC', () => {
    const d = calendarDayMidnightUTC(SESSION_START, 30, 'UTC')
    expect(d.toISOString()).toBe('2026-07-11T00:00:00.000Z')
  })

  it('anchors to local midnight in a western zone during DST (EDT, UTC-4)', () => {
    // Aug 10 − 30 = Jul 11; midnight EDT = 04:00 UTC.
    const d = calendarDayMidnightUTC(SESSION_START, 30, 'America/New_York')
    expect(d.toISOString()).toBe('2026-07-11T04:00:00.000Z')
  })

  it('uses the correct offset across a DST boundary (EST, UTC-5)', () => {
    // A November programme: midnight EST = 05:00 UTC (not 04:00).
    const novStart = new Date('2026-11-20T00:00:00.000Z')
    const d = calendarDayMidnightUTC(novStart, 0, 'America/New_York')
    expect(d.toISOString()).toBe('2026-11-20T05:00:00.000Z')
  })

  it('does not shift the programme day when start is stored at midnight UTC', () => {
    // Naive instant conversion would land on Aug 9 in NY; the canonical UTC date
    // (Aug 10) must be used, so the 0-day boundary is Aug 10 local midnight.
    const d = calendarDayMidnightUTC(SESSION_START, 0, 'America/New_York')
    expect(d.toISOString()).toBe('2026-08-10T04:00:00.000Z')
  })

  it('falls back to midnight UTC of the boundary date for an invalid zone', () => {
    const d = calendarDayMidnightUTC(SESSION_START, 30, 'Not/AZone')
    expect(d.toISOString()).toBe('2026-07-11T00:00:00.000Z')
  })
})

describe('buildCaptureSchedule', () => {
  it('Flexible (no-deposit) → single full-balance capture (binary)', () => {
    const { events, captureMode } = buildCaptureSchedule({
      tiers: FLEXIBLE,
      depositAmount: 0,
      balanceAmount: 1000,
      sessionStart: SESSION_START,
      timezone: 'UTC',
      graceDeadline: GRACE,
    })
    expect(captureMode).toBe('binary')
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ sequence: 1, kind: 'balance', amount: 1000 })
    expect(events[0].captureDate.toISOString()).toBe('2026-08-10T00:00:00.000Z')
    expect(sum(events)).toBe(1000)
  })

  it('Moderate with deposit → deposit seq 0 at grace + two 50% balance captures', () => {
    const { events, captureMode } = buildCaptureSchedule({
      tiers: MODERATE,
      depositAmount: 200,
      balanceAmount: 800,
      sessionStart: SESSION_START,
      timezone: 'UTC',
      graceDeadline: GRACE,
    })
    expect(captureMode).toBe('two_stage')
    expect(events).toHaveLength(3)
    expect(events[0]).toMatchObject({ sequence: 0, kind: 'deposit', amount: 200 })
    expect(events[0].captureDate.toISOString()).toBe(GRACE.toISOString())
    expect(events[1]).toMatchObject({ sequence: 1, kind: 'balance', amount: 400 })
    expect(events[1].captureDate.toISOString()).toBe('2026-07-11T00:00:00.000Z') // 30d before
    expect(events[2]).toMatchObject({ sequence: 2, kind: 'balance', amount: 400 })
    expect(events[2].captureDate.toISOString()).toBe('2026-08-10T00:00:00.000Z') // 0d
    // Balance events sum exactly to the balance (deposit excluded from the walk).
    expect(sum(events.filter(e => e.kind === 'balance'))).toBe(800)
  })

  it('Custom with 3 distinct drops → custom mode, 3 balance events', () => {
    const { events, captureMode } = buildCaptureSchedule({
      tiers: CUSTOM_3,
      depositAmount: 0,
      balanceAmount: 1000,
      sessionStart: SESSION_START,
      timezone: 'UTC',
      graceDeadline: GRACE,
    })
    expect(captureMode).toBe('custom')
    expect(events.map(e => e.amount)).toEqual([250, 250, 500]) // 25% @60d, 25% @30d, 50% @0d
    expect(sum(events)).toBe(1000)
  })

  it('collapses equal-% consecutive bands (no event at the equal band)', () => {
    const { events } = buildCaptureSchedule({
      tiers: CUSTOM_EQUAL,
      depositAmount: 0,
      balanceAmount: 1000,
      sessionStart: SESSION_START,
      timezone: 'UTC',
      graceDeadline: GRACE,
    })
    // 100→100 (no event), 100→50 @30d (500), 50→0 @0d (500).
    expect(events).toHaveLength(2)
    expect(events.map(e => e.amount)).toEqual([500, 500])
  })

  it('folds the rounding residual into the final balance event so the sum is exact', () => {
    const { events } = buildCaptureSchedule({
      tiers: MODERATE,
      depositAmount: 0,
      balanceAmount: 100.01,
      sessionStart: SESSION_START,
      timezone: 'UTC',
      graceDeadline: GRACE,
    })
    expect(sum(events)).toBe(100.01)
    // First event rounds up; the last absorbs the residual.
    expect(events[0].amount).toBe(50.01)
    expect(events[1].amount).toBe(50)
  })

  it('applies the acceptance guard to every event when acceptanceTime is later', () => {
    const acceptance = new Date('2026-08-01T00:00:00.000Z') // after the 30d boundary
    const { events } = buildCaptureSchedule({
      tiers: MODERATE,
      depositAmount: 200,
      balanceAmount: 800,
      sessionStart: SESSION_START,
      timezone: 'UTC',
      graceDeadline: GRACE,
      acceptanceTime: acceptance,
    })
    // The deposit and the already-past 30d boundary collapse to acceptanceTime;
    // the 0d boundary (Aug 10) stays after it.
    expect(events[0].effectiveCaptureDate.toISOString()).toBe(acceptance.toISOString())
    expect(events[1].effectiveCaptureDate.toISOString()).toBe(acceptance.toISOString())
    expect(events[2].effectiveCaptureDate.toISOString()).toBe('2026-08-10T00:00:00.000Z')
  })

  it('captures a residual when the closest tier never reaches 0%', () => {
    const neverZero: PolicyTier[] = [
      { daysBeforeStart: 60, refundPercentage: 100 },
      { daysBeforeStart: 30, refundPercentage: 50 },
    ]
    const { events } = buildCaptureSchedule({
      tiers: neverZero,
      depositAmount: 0,
      balanceAmount: 1000,
      sessionStart: SESSION_START,
      timezone: 'UTC',
      graceDeadline: GRACE,
    })
    // 100→50 @30d (500), then residual 50% non-refundable at session start (500).
    expect(events.map(e => e.amount)).toEqual([500, 500])
    expect(events[1].captureDate.toISOString()).toBe('2026-08-10T00:00:00.000Z')
    expect(sum(events)).toBe(1000)
  })

  it('returns no balance events when the balance is zero', () => {
    const { events } = buildCaptureSchedule({
      tiers: MODERATE,
      depositAmount: 500,
      balanceAmount: 0,
      sessionStart: SESSION_START,
      timezone: 'UTC',
      graceDeadline: GRACE,
    })
    expect(events).toEqual([expect.objectContaining({ sequence: 0, kind: 'deposit', amount: 500 })])
  })
})
