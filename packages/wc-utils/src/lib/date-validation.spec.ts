import { describe, it, expect } from 'vitest'
import {
  calculateAgeAtDate,
  isSessionBookable,
  isSessionInFuture,
  sessionBookabilityIssue,
  startOfUtcDay,
  wholeDaysBetween,
} from './date-validation'

const NOW = new Date('2026-06-01T12:00:00.000Z')

describe('calculateAgeAtDate', () => {
  it('computes whole-years age at the given date', () => {
    expect(calculateAgeAtDate('2016-06-01', '2026-06-01')).toBe(10)
  })

  it('does not count a birthday that has not occurred by the date', () => {
    // Born June 2; on June 1 the year before the 10th birthday they are 9.
    expect(calculateAgeAtDate('2016-06-02', '2026-06-01')).toBe(9)
  })

  it('counts the birthday itself', () => {
    expect(calculateAgeAtDate('2016-06-01', '2026-05-31')).toBe(9)
    expect(calculateAgeAtDate('2016-06-01', '2026-06-01')).toBe(10)
  })

  it('returns null for missing/invalid dates', () => {
    expect(calculateAgeAtDate(null, NOW)).toBeNull()
    expect(calculateAgeAtDate('not-a-date', NOW)).toBeNull()
    expect(calculateAgeAtDate('2016-06-01', null)).toBeNull()
  })

  it('is UTC-stable for date-only inputs', () => {
    // Date-only ISO parses as UTC midnight; age must not depend on local TZ.
    expect(calculateAgeAtDate('2010-01-01', '2026-01-01')).toBe(16)
  })
})

describe('sessionBookabilityIssue / isSessionBookable', () => {
  it('accepts a published future session with sane dates', () => {
    const s = { status: 'published', startDate: '2026-08-01', endDate: '2026-08-07' }
    expect(sessionBookabilityIssue(s, NOW)).toBeNull()
    expect(isSessionBookable(s, NOW)).toBe(true)
  })

  it('rejects an unpublished session', () => {
    expect(sessionBookabilityIssue({ status: 'draft', startDate: '2026-08-01' }, NOW)).toBe(
      'not_published'
    )
  })

  it('rejects a session that already started', () => {
    expect(sessionBookabilityIssue({ status: 'published', startDate: '2026-05-01' }, NOW)).toBe(
      'in_past'
    )
  })

  it('rejects start >= end', () => {
    expect(
      sessionBookabilityIssue(
        { status: 'published', startDate: '2026-08-07', endDate: '2026-08-01' },
        NOW
      )
    ).toBe('invalid_dates')
  })

  it('rejects missing start date', () => {
    expect(sessionBookabilityIssue({ startDate: null }, NOW)).toBe('invalid_dates')
  })

  it('ignores status when not provided', () => {
    expect(isSessionBookable({ startDate: '2026-08-01' }, NOW)).toBe(true)
  })
})

describe('isSessionInFuture', () => {
  it('is true only when start is strictly after now', () => {
    expect(isSessionInFuture('2026-08-01', NOW)).toBe(true)
    expect(isSessionInFuture('2026-05-01', NOW)).toBe(false)
    expect(isSessionInFuture(null, NOW)).toBe(false)
  })
})

describe('wholeDaysBetween', () => {
  it('floors to whole days', () => {
    expect(wholeDaysBetween('2026-06-01', '2026-06-08')).toBe(7)
    expect(wholeDaysBetween('2026-06-08', '2026-06-01')).toBe(-7)
    expect(wholeDaysBetween(null, '2026-06-01')).toBeNull()
  })
})

describe('startOfUtcDay', () => {
  it('drops the time-of-day to UTC midnight', () => {
    expect(startOfUtcDay('2026-08-01T08:30:00Z')?.toISOString()).toBe('2026-08-01T00:00:00.000Z')
  })

  it('is a no-op for a date-only (already UTC-midnight) input', () => {
    expect(startOfUtcDay('2026-08-01')?.toISOString()).toBe('2026-08-01T00:00:00.000Z')
  })

  it('returns null for missing/invalid input', () => {
    expect(startOfUtcDay(null)).toBeNull()
    expect(startOfUtcDay('not-a-date')).toBeNull()
  })
})
