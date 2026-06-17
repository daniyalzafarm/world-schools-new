import { describe, it, expect } from 'vitest'
import {
  DEFAULT_CUSTOM_POLICY_TIERS,
  FLEXIBLE_POLICY_TIERS,
  MODERATE_POLICY_TIERS,
  STRICT_POLICY_TIERS,
} from '@world-schools/wc-types'
import {
  buildCancellationPolicyRows,
  getCancellationPolicyLabel,
  getFreeCancellationCutoffDate,
  getRefundAmount,
  getRefundLabel,
  getRefundPercentage,
  resolveTiers,
} from './cancellation-policy'

describe('resolveTiers', () => {
  it('returns flexible tiers for the flexible policy', () => {
    expect(resolveTiers('flexible', null)).toEqual(FLEXIBLE_POLICY_TIERS)
  })

  it('returns moderate tiers for the moderate policy', () => {
    expect(resolveTiers('moderate', null)).toEqual(MODERATE_POLICY_TIERS)
  })

  it('returns strict tiers for the strict policy', () => {
    expect(resolveTiers('strict', null)).toEqual(STRICT_POLICY_TIERS)
  })

  it('falls back to MODERATE for genuinely unknown policy names', () => {
    expect(resolveTiers('super_strict', null)).toEqual(MODERATE_POLICY_TIERS)
    expect(resolveTiers('totally_unknown', null)).toEqual(MODERATE_POLICY_TIERS)
  })

  it('falls back to MODERATE when policy is null/undefined', () => {
    expect(resolveTiers(null, null)).toEqual(MODERATE_POLICY_TIERS)
    expect(resolveTiers(undefined, null)).toEqual(MODERATE_POLICY_TIERS)
  })

  it('returns custom tiers when policy is custom and tiers are provided', () => {
    const custom = { tiers: DEFAULT_CUSTOM_POLICY_TIERS.map(t => ({ ...t })) }
    expect(resolveTiers('custom', custom)).toEqual(DEFAULT_CUSTOM_POLICY_TIERS)
  })

  it('falls back to MODERATE when custom policy is selected but no tiers given', () => {
    expect(resolveTiers('custom', null)).toEqual(MODERATE_POLICY_TIERS)
    expect(resolveTiers('custom', { tiers: [] })).toEqual(MODERATE_POLICY_TIERS)
  })
})

describe('getRefundPercentage', () => {
  it('moderate: 60+ days = 100%, 30–59 = 50%, <30 = 0%', () => {
    expect(getRefundPercentage(90, 'moderate', null)).toBe(100)
    expect(getRefundPercentage(60, 'moderate', null)).toBe(100)
    expect(getRefundPercentage(59, 'moderate', null)).toBe(50)
    expect(getRefundPercentage(30, 'moderate', null)).toBe(50)
    expect(getRefundPercentage(29, 'moderate', null)).toBe(0)
    expect(getRefundPercentage(0, 'moderate', null)).toBe(0)
    expect(getRefundPercentage(-5, 'moderate', null)).toBe(0)
  })

  it('flexible: 30+ days = 100%, <30 = 0%', () => {
    expect(getRefundPercentage(30, 'flexible', null)).toBe(100)
    expect(getRefundPercentage(29, 'flexible', null)).toBe(0)
  })

  it('exact tier boundary belongs to the higher-% tier (>= semantics)', () => {
    // The "30" boundary day belongs to the 50% tier (moderate), NOT the
    // <30 day 0% tier. Documents the inclusive lower-bound rule.
    expect(getRefundPercentage(30, 'moderate', null)).toBe(50)
  })

  it('honors custom tier percentages', () => {
    const custom = { tiers: [...DEFAULT_CUSTOM_POLICY_TIERS] }
    // Default custom: [{90,100},{60,100},{30,50},{0,0}]
    expect(getRefundPercentage(120, 'custom', custom)).toBe(100)
    expect(getRefundPercentage(45, 'custom', custom)).toBe(50)
    expect(getRefundPercentage(15, 'custom', custom)).toBe(0)
  })
})

describe('getRefundAmount', () => {
  it('rounds half-up to whole currency units', () => {
    expect(getRefundAmount(1198, 50)).toBe(599)
    expect(getRefundAmount(1198, 100)).toBe(1198)
    expect(getRefundAmount(1198, 0)).toBe(0)
    // 333.33 → 333
    expect(getRefundAmount(1000, 33)).toBe(330)
  })
})

describe('getRefundLabel', () => {
  it('returns plain-language labels for canonical percentages', () => {
    expect(getRefundLabel(100)).toBe('Full refund')
    expect(getRefundLabel(0)).toBe('No refund')
    expect(getRefundLabel(50)).toBe('50% refund')
    expect(getRefundLabel(75)).toBe('75% refund')
  })
})

describe('getCancellationPolicyLabel', () => {
  it('returns the human-readable label for known policies', () => {
    expect(getCancellationPolicyLabel('flexible')).toBe('Flexible')
    expect(getCancellationPolicyLabel('moderate')).toBe('Moderate')
    expect(getCancellationPolicyLabel('strict')).toBe('Strict')
    expect(getCancellationPolicyLabel('custom')).toBe('Custom')
  })

  it('returns Custom for unknown / missing policies', () => {
    expect(getCancellationPolicyLabel(null)).toBe('Custom')
    expect(getCancellationPolicyLabel('bogus')).toBe('Custom')
  })
})

describe('getFreeCancellationCutoffDate', () => {
  it('returns null when sessionStartDate is missing/invalid', () => {
    expect(getFreeCancellationCutoffDate(null, 'moderate', null)).toBeNull()
    expect(getFreeCancellationCutoffDate(undefined, 'moderate', null)).toBeNull()
    expect(getFreeCancellationCutoffDate('not-a-date', 'moderate', null)).toBeNull()
  })

  it('returns the correct boundary for moderate (60 days before)', () => {
    // "2026-06-22" parses as UTC midnight Jun 22; 60 days back = Apr 23.
    const cutoff = getFreeCancellationCutoffDate('2026-06-22', 'moderate', null)
    expect(cutoff).not.toBeNull()
    // Verify in UTC so the test is timezone-agnostic.
    expect(cutoff!.toISOString().slice(0, 10)).toBe('2026-04-23')
  })

  it('returns the correct boundary for flexible (30 days before)', () => {
    const cutoff = getFreeCancellationCutoffDate('2026-06-22', 'flexible', null)
    expect(cutoff!.toISOString().slice(0, 10)).toBe('2026-05-23')
  })

  it('returns null when no tier offers a 100% refund', () => {
    const cutoff = getFreeCancellationCutoffDate(
      '2026-06-22',
      'custom',
      // No 100% tier — every tier is partial.
      { tiers: [{ daysBeforeStart: 30, refundPercentage: 50 }] }
    )
    expect(cutoff).toBeNull()
  })
})

describe('buildCancellationPolicyRows', () => {
  it('returns one row per tier, ordered by daysBeforeStart descending', () => {
    const rows = buildCancellationPolicyRows('moderate', null)
    expect(rows).toHaveLength(3)
    expect(rows.map(r => r.daysBeforeStart)).toEqual([60, 30, 0])
    expect(rows.map(r => r.refundPercentage)).toEqual([100, 50, 0])
  })

  it('renders rangeLabel for every row even without a session start', () => {
    const rows = buildCancellationPolicyRows('moderate', null)
    expect(rows[0].rangeLabel).toBe('60+ days before camp')
    expect(rows[1].rangeLabel).toBe('30–60 days before camp')
    expect(rows[2].rangeLabel).toBe('Less than 30 days before camp')
    expect(rows.every(r => r.dateRangeLabel === null)).toBe(true)
  })

  it('renders dateRangeLabel without overlap on boundary dates', () => {
    // Jun 22 start + moderate (60/30/0). Apr 23 = 60-day boundary, May 23 =
    // 30-day boundary. Boundary dates must NOT appear in two rows — they
    // belong to the higher-% tier (>= semantics).
    const rows = buildCancellationPolicyRows('moderate', null, '2026-06-22')
    expect(rows[0].dateRangeLabel).toBe('Before Apr 24, 2026') // up to Apr 23 inclusive
    expect(rows[1].dateRangeLabel).toBe('Apr 24, 2026 – May 23, 2026')
    expect(rows[2].dateRangeLabel).toBe('After May 23, 2026')
  })

  it('formats dates in UTC so calendar date is stable across timezones', () => {
    // ISO date-only "2026-06-22" parses as UTC midnight. A consumer in any
    // timezone (EST, JST, NZST) must see the same calendar date — without
    // the UTC formatter we previously bled local-tz offsets into the output.
    const rows = buildCancellationPolicyRows('moderate', null, '2026-06-22')
    const allLabels = rows.map(r => r.dateRangeLabel).join(' ')
    // Apr 23, May 23 (last day of each) and Apr 24 (start of mid range).
    expect(allLabels).toContain('Apr 24, 2026')
    expect(allLabels).toContain('May 23, 2026')
    // Negative case: should not have shifted by a day in either direction.
    expect(allLabels).not.toContain('Apr 22, 2026')
    expect(allLabels).not.toContain('May 22, 2026')
    expect(allLabels).not.toContain('Apr 23, 2026') // Apr 23 is in the prior row's "Before Apr 24"
  })

  it('handles single-tier policies (only first row, no middle/last)', () => {
    const rows = buildCancellationPolicyRows(
      'custom',
      { tiers: [{ daysBeforeStart: 0, refundPercentage: 100 }] },
      '2026-06-22'
    )
    expect(rows).toHaveLength(1)
    // With only one tier and daysBeforeStart=0, isFirst wins (the function
    // matches isFirst before isLast). Result: "Before Jun 23" (the day after
    // start), meaning "up to and including the camp start day".
    expect(rows[0].dateRangeLabel).toBe('Before Jun 23, 2026')
  })

  it('flexible policy renders correctly with two tiers', () => {
    const rows = buildCancellationPolicyRows('flexible', null, '2026-06-22')
    expect(rows).toHaveLength(2)
    expect(rows[0].refundPercentage).toBe(100)
    expect(rows[1].refundPercentage).toBe(0)
    expect(rows[0].dateRangeLabel).toBe('Before May 24, 2026')
    expect(rows[1].dateRangeLabel).toBe('After May 23, 2026')
  })

  it('custom policy with all 4 default tiers renders correctly', () => {
    const rows = buildCancellationPolicyRows(
      'custom',
      { tiers: DEFAULT_CUSTOM_POLICY_TIERS.map(t => ({ ...t })) },
      '2026-06-22'
    )
    expect(rows).toHaveLength(4)
    expect(rows.map(r => r.daysBeforeStart)).toEqual([90, 60, 30, 0])
  })

  it('returns valid rows even when sessionStartDate is invalid', () => {
    // Invalid date should produce rows without dateRangeLabel, not throw.
    const rows = buildCancellationPolicyRows('moderate', null, 'garbage')
    expect(rows).toHaveLength(3)
    expect(rows.every(r => r.dateRangeLabel === null)).toBe(true)
  })
})
