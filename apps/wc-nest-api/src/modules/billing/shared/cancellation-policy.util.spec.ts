import {
  buildBookingPolicySnapshot,
  calendarDaysBetween,
  evaluatePolicy,
  readBookingPolicySnapshot,
  resolveSpecialCircumstances,
  resolveTiers,
} from './cancellation-policy.util'

describe('resolveTiers (backend)', () => {
  it('returns flexible tiers from the shared package, not a backend duplicate', () => {
    const tiers = resolveTiers('flexible', null)
    // `flexible` design = [100,100,100,0] — collapsed to [{30,100},{0,0}].
    // Even after sorting, the highest-day-100% tier must be 30 days (NOT 60
    // or 90 — those would indicate the backend has drifted from the shared
    // canonical definition).
    expect(tiers).toEqual([
      { daysBeforeStart: 30, refundPercentage: 100 },
      { daysBeforeStart: 0, refundPercentage: 0 },
    ])
  })

  it('returns moderate tiers matching the design HTML (60/30/0)', () => {
    expect(resolveTiers('moderate', null)).toEqual([
      { daysBeforeStart: 60, refundPercentage: 100 },
      { daysBeforeStart: 30, refundPercentage: 50 },
      { daysBeforeStart: 0, refundPercentage: 0 },
    ])
  })

  it('returns strict tiers matching the locked product bands (90/60/0)', () => {
    expect(resolveTiers('strict', null)).toEqual([
      { daysBeforeStart: 90, refundPercentage: 100 },
      { daysBeforeStart: 60, refundPercentage: 50 },
      { daysBeforeStart: 0, refundPercentage: 0 },
    ])
  })

  it('resolves an empty/unset policy name to MODERATE (the onboarding default)', () => {
    expect(resolveTiers('', null)).toEqual(resolveTiers('moderate', null))
  })

  it('FAILS LOUD for a genuinely unsupported policy name', () => {
    // The four valid presets are flexible/moderate/strict/custom; anything else
    // (e.g. a legacy `super_strict` or a stray DB write) must throw rather than
    // silently price the refund as Moderate (Spec v2.3).
    expect(() => resolveTiers('super_strict', null)).toThrow(/unsupported cancellation policy/)
    expect(() => resolveTiers('bogus', null)).toThrow(/unsupported cancellation policy/)
  })

  it('parses custom tier JSON in both `{tiers: []}` and bare-array form', () => {
    const wrapped = resolveTiers('custom', {
      tiers: [
        { daysBeforeStart: 90, refundPercentage: 100 },
        { daysBeforeStart: 30, refundPercentage: 50 },
      ],
    } as unknown as null)
    expect(wrapped).toEqual([
      { daysBeforeStart: 90, refundPercentage: 100 },
      { daysBeforeStart: 30, refundPercentage: 50 },
    ])

    const bareArray = resolveTiers('custom', [
      { daysBeforeStart: 60, refundPercentage: 75 },
    ] as unknown as null)
    expect(bareArray).toEqual([{ daysBeforeStart: 60, refundPercentage: 75 }])
  })
})

describe('resolveSpecialCircumstances', () => {
  it('returns [] when the JSON is null or non-array', () => {
    expect(resolveSpecialCircumstances(null)).toEqual([])
    expect(resolveSpecialCircumstances({} as unknown as null)).toEqual([])
  })

  it('only allows the three canonical types and four canonical percentages', () => {
    const result = resolveSpecialCircumstances([
      { type: 'medical', refundPercentage: 100 },
      { type: 'force_majeure', refundPercentage: 75 },
      { type: 'weather', refundPercentage: 50 },
      // Invalid: bogus type
      { type: 'bogus', refundPercentage: 50 },
      // Invalid: out-of-range percentage
      { type: 'medical', refundPercentage: 33 },
    ] as unknown as null)
    expect(result).toEqual([
      { type: 'medical', refundPercentage: 100 },
      { type: 'force_majeure', refundPercentage: 75 },
      { type: 'weather', refundPercentage: 50 },
    ])
  })
})

describe('calendarDaysBetween', () => {
  it('uses UTC calendar dates so time-of-day does not change the day count', () => {
    // Jun 22 00:00 UTC and Jun 22 23:59 UTC are the SAME calendar day.
    const start = new Date('2026-06-22T00:00:00Z')
    const lateSameDay = new Date('2026-06-22T23:59:59Z')
    expect(calendarDaysBetween(start, lateSameDay)).toBe(0)
  })

  it('returns 60 when measuring exactly 60 calendar days between dates', () => {
    expect(
      calendarDaysBetween(new Date('2026-06-22T00:00:00Z'), new Date('2026-04-23T00:00:00Z'))
    ).toBe(60)
  })

  it('does not bump down a tier when cancelling late at night on the boundary day', () => {
    // Parent in NZST cancelling at 11pm local on Apr 23 (~ 11am UTC). With a
    // millisecond delta we'd see 59.5 days → floor to 59 → drop a tier.
    // calendarDaysBetween returns 60 — same as the boundary day at midnight.
    const sessionStart = new Date('2026-06-22T00:00:00Z')
    const lateNightOnBoundary = new Date('2026-04-23T11:00:00Z')
    expect(calendarDaysBetween(sessionStart, lateNightOnBoundary)).toBe(60)
  })
})

describe('buildBookingPolicySnapshot / readBookingPolicySnapshot', () => {
  it('round-trips a moderate policy with no custom data or special circumstances', () => {
    const snap = buildBookingPolicySnapshot({
      policyName: 'moderate',
      cancellationPolicyCustom: null,
      cancellationPolicySpecialCircumstances: null,
      now: new Date('2026-05-01T00:00:00Z'),
    })
    expect(snap.policyName).toBe('moderate')
    expect(snap.tiers).toEqual([
      { daysBeforeStart: 60, refundPercentage: 100 },
      { daysBeforeStart: 30, refundPercentage: 50 },
      { daysBeforeStart: 0, refundPercentage: 0 },
    ])
    expect(snap.specialCircumstances).toEqual([])
    expect(snap.capturedAt).toBe('2026-05-01T00:00:00.000Z')
    expect(snap.schemaVersion).toBe(1)

    // Persist as JSON and read back — the round trip must produce the same shape.
    const persisted = JSON.parse(JSON.stringify(snap))
    expect(readBookingPolicySnapshot(persisted)).toEqual(snap)
  })

  it('defaults a missing schemaVersion to 1 (rows persisted before versioning)', () => {
    const legacy = {
      policyName: 'moderate',
      tiers: [{ daysBeforeStart: 0, refundPercentage: 0 }],
      specialCircumstances: [],
      capturedAt: '2026-05-01T00:00:00.000Z',
    }
    expect(readBookingPolicySnapshot(legacy as unknown as null)?.schemaVersion).toBe(1)
  })

  it('returns null for malformed snapshot JSON', () => {
    expect(readBookingPolicySnapshot(null)).toBeNull()
    expect(readBookingPolicySnapshot('not-an-object' as unknown as null)).toBeNull()
    expect(readBookingPolicySnapshot({ tiers: [] } as unknown as null)).toBeNull() // missing policyName
  })
})

describe('evaluatePolicy', () => {
  const sessionStart = new Date('2026-06-22T00:00:00Z')

  it('uses the booking snapshot when present (consumer-protection)', () => {
    // Provider's CURRENT live policy is harshly downgraded to no-refund-anywhere,
    // but the booking snapshot was captured under the original moderate policy.
    // Refund must follow the snapshot, not the current live setting.
    const snapshot = buildBookingPolicySnapshot({
      policyName: 'moderate',
      cancellationPolicyCustom: null,
      cancellationPolicySpecialCircumstances: null,
      now: new Date('2026-04-01T00:00:00Z'),
    })
    const result = evaluatePolicy({
      policyName: 'custom',
      cancellationPolicyCustom: { tiers: [{ daysBeforeStart: 0, refundPercentage: 0 }] },
      bookingPolicySnapshot: JSON.parse(JSON.stringify(snapshot)),
      sessionStartDate: sessionStart,
      now: new Date('2026-04-23T00:00:00Z'), // 60 days before
    })
    // 60 days → 100% under moderate (the snapshot), not 0% under live custom.
    expect(result.matchedTier?.refundPercentage).toBe(100)
    expect(result.daysBeforeStart).toBe(60)
  })

  it('falls back to live settings when no booking snapshot exists (legacy bookings)', () => {
    const result = evaluatePolicy({
      policyName: 'moderate',
      cancellationPolicyCustom: null,
      bookingPolicySnapshot: null,
      sessionStartDate: sessionStart,
      now: new Date('2026-05-23T00:00:00Z'), // 30 days before
    })
    expect(result.matchedTier?.refundPercentage).toBe(50)
  })

  it('uses calendar-day comparison (no time-of-day fairness issue)', () => {
    const result = evaluatePolicy({
      policyName: 'moderate',
      cancellationPolicyCustom: null,
      sessionStartDate: sessionStart,
      // 11pm UTC on the 30-day boundary day. Millisecond delta would give
      // ~29.96 days → floor to 29 → drop to 0% tier. Calendar-day math
      // treats this as 30 → 50% tier (the right outcome).
      now: new Date('2026-05-23T23:00:00Z'),
    })
    expect(result.daysBeforeStart).toBe(30)
    expect(result.matchedTier?.refundPercentage).toBe(50)
  })

  describe('special-circumstance overrides', () => {
    const snapshot = buildBookingPolicySnapshot({
      policyName: 'moderate',
      cancellationPolicyCustom: null,
      cancellationPolicySpecialCircumstances: [
        { type: 'medical', refundPercentage: 90 },
      ] as unknown as null,
    })

    it('upgrades the matched tier when the override is more generous than standard', () => {
      // Cancelling 10 days before camp = 0% under standard moderate. Medical
      // claim with 90% provider override should upgrade the parent's refund.
      const result = evaluatePolicy({
        policyName: 'moderate',
        cancellationPolicyCustom: null,
        bookingPolicySnapshot: JSON.parse(JSON.stringify(snapshot)),
        circumstance: 'medical',
        sessionStartDate: sessionStart,
        now: new Date('2026-06-12T00:00:00Z'),
      })
      expect(result.matchedTier?.refundPercentage).toBe(90)
      expect(result.appliedCircumstance).toEqual({ type: 'medical', refundPercentage: 90 })
    })

    it('does NOT downgrade an already-better standard refund', () => {
      // Cancelling 90 days before camp = 100% under standard. A 50% medical
      // override must NOT replace it — overrides only ever HELP the parent.
      const downgradeSnapshot = buildBookingPolicySnapshot({
        policyName: 'moderate',
        cancellationPolicyCustom: null,
        cancellationPolicySpecialCircumstances: [
          { type: 'medical', refundPercentage: 50 },
        ] as unknown as null,
      })
      const result = evaluatePolicy({
        policyName: 'moderate',
        cancellationPolicyCustom: null,
        bookingPolicySnapshot: JSON.parse(JSON.stringify(downgradeSnapshot)),
        circumstance: 'medical',
        sessionStartDate: sessionStart,
        now: new Date('2026-03-22T00:00:00Z'),
      })
      expect(result.matchedTier?.refundPercentage).toBe(100)
      expect(result.appliedCircumstance).toBeNull()
    })

    it('ignores claims for circumstances the provider has not configured', () => {
      // Snapshot only configures medical, not weather. Weather claim is a no-op.
      const result = evaluatePolicy({
        policyName: 'moderate',
        cancellationPolicyCustom: null,
        bookingPolicySnapshot: JSON.parse(JSON.stringify(snapshot)),
        circumstance: 'weather',
        sessionStartDate: sessionStart,
        now: new Date('2026-06-12T00:00:00Z'), // 10 days
      })
      expect(result.matchedTier?.refundPercentage).toBe(0)
      expect(result.appliedCircumstance).toBeNull()
    })

    it('records the override on the snapshot for audit', () => {
      const result = evaluatePolicy({
        policyName: 'moderate',
        cancellationPolicyCustom: null,
        bookingPolicySnapshot: JSON.parse(JSON.stringify(snapshot)),
        circumstance: 'medical',
        sessionStartDate: sessionStart,
        now: new Date('2026-06-12T00:00:00Z'),
      })
      expect(result.appliedCircumstance?.type).toBe('medical')
      expect(result.appliedCircumstance?.refundPercentage).toBe(90)
      // Original tier match is implicit in `daysBeforeStart` — auditors can
      // re-derive what the standard tier WOULD have been.
      expect(result.daysBeforeStart).toBe(10)
    })
  })
})
