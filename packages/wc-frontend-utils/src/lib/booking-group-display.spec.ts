import { describe, expect, it } from 'vitest'
import { formatSessionDateRange, formatSessionRange } from './booking-group-display'

const START = '2026-06-01'
const END = '2026-06-08'

describe('formatSessionDateRange', () => {
  it('returns only the date range, never the session name', () => {
    expect(formatSessionDateRange(START, END)).toBe('Jun 1 – Jun 8, 2026')
  })

  it('returns the empty fallback by default when a date is unparseable', () => {
    expect(formatSessionDateRange('not-a-date', END)).toBe('')
    expect(formatSessionDateRange(START, 'not-a-date')).toBe('')
  })

  it('returns the provided fallback when a date is unparseable', () => {
    expect(formatSessionDateRange('not-a-date', END, 'Week 1')).toBe('Week 1')
  })
})

describe('formatSessionRange', () => {
  it('appends the session name after the date range', () => {
    expect(formatSessionRange(START, END, 'Week 1')).toBe('Jun 1 – Jun 8, 2026 · Week 1')
  })

  it('falls back to just the name when the dates are unparseable', () => {
    expect(formatSessionRange('not-a-date', END, 'Week 1')).toBe('Week 1')
  })
})
