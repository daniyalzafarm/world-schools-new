import { describe, it, expect } from 'vitest'
import {
  ageGroupCanonicalId,
  checkCapacityFit,
  getChildAgeGroupId,
  totalCapacity,
} from './session-capacity'

const SESSION_START = '2026-08-01'
const AGE_GROUPS = [
  { min: 6, max: 9 },
  { min: 10, max: 13 },
]

// Ages at 2026-08-01: born 2018 → 8 (group 6-9); born 2014 → 12 (group 10-13).
const YOUNG = '2018-01-01'
const OLD = '2014-01-01'

describe('ageGroupCanonicalId', () => {
  it('prefers explicit id, falls back to min-max', () => {
    expect(ageGroupCanonicalId({ id: 'g1', min: 6, max: 9 })).toBe('g1')
    expect(ageGroupCanonicalId({ min: 6, max: 9 })).toBe('6-9')
  })
})

describe('getChildAgeGroupId', () => {
  it('maps a child to its age group id', () => {
    expect(getChildAgeGroupId(YOUNG, AGE_GROUPS, SESSION_START)).toBe('6-9')
    expect(getChildAgeGroupId(OLD, AGE_GROUPS, SESSION_START)).toBe('10-13')
  })
  it('returns null when outside all groups', () => {
    expect(getChildAgeGroupId('2000-01-01', AGE_GROUPS, SESSION_START)).toBeNull()
  })
})

describe('totalCapacity', () => {
  it('returns totalSpots for single availability', () => {
    expect(totalCapacity({ availabilityType: 'single', totalSpots: 10 })).toBe(10)
    expect(totalCapacity({ availabilityType: 'single', totalSpots: null })).toBeNull()
  })
  it('sums age-group spots', () => {
    expect(
      totalCapacity({
        availabilityType: 'age_group',
        ageGroupSpots: [
          { ageGroupId: '6-9', spots: 5 },
          { ageGroupId: '10-13', spots: 3 },
        ],
      })
    ).toBe(8)
  })
})

describe('checkCapacityFit — single', () => {
  const cfg = { availabilityType: 'single', totalSpots: 2 }
  it('fits when within capacity', () => {
    const res = checkCapacityFit({
      config: cfg,
      campAgeGroups: AGE_GROUPS,
      sessionStart: SESSION_START,
      existingChildDobs: [YOUNG],
      incomingChildDobs: [OLD],
    })
    expect(res.fits).toBe(true)
    expect(res.remaining).toBe(1)
  })
  it('does not fit when it would oversell', () => {
    const res = checkCapacityFit({
      config: cfg,
      campAgeGroups: AGE_GROUPS,
      sessionStart: SESSION_START,
      existingChildDobs: [YOUNG, OLD],
      incomingChildDobs: [YOUNG],
    })
    expect(res.fits).toBe(false)
    expect(res.message).toMatch(/full/i)
  })
  it('treats null capacity as unlimited', () => {
    const res = checkCapacityFit({
      config: { availabilityType: 'single', totalSpots: null },
      campAgeGroups: AGE_GROUPS,
      sessionStart: SESSION_START,
      existingChildDobs: [YOUNG, OLD, YOUNG],
      incomingChildDobs: [OLD],
    })
    expect(res.fits).toBe(true)
  })
})

describe('checkCapacityFit — age group', () => {
  const cfg = {
    availabilityType: 'age_group',
    ageGroupSpots: [
      { ageGroupId: '6-9', spots: 1 },
      { ageGroupId: '10-13', spots: 2 },
    ],
  }
  it('enforces each group independently', () => {
    // 6-9 group already full (1/1); adding another young child must fail even
    // though the 10-13 group has room.
    const res = checkCapacityFit({
      config: cfg,
      campAgeGroups: AGE_GROUPS,
      sessionStart: SESSION_START,
      existingChildDobs: [YOUNG],
      incomingChildDobs: [YOUNG],
    })
    expect(res.fits).toBe(false)
    expect(res.message).toMatch(/6-9/)
  })
  it('fits when the incoming child lands in a group with room', () => {
    const res = checkCapacityFit({
      config: cfg,
      campAgeGroups: AGE_GROUPS,
      sessionStart: SESSION_START,
      existingChildDobs: [YOUNG],
      incomingChildDobs: [OLD],
    })
    expect(res.fits).toBe(true)
  })
})
